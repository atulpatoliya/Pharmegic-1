'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { generateCertificatePdf } from '@/services/pdf';
import { sendCertificateEmail as sendCertEmail } from '@/services/email';
import { tccApplicationSchema } from '@/lib/validations';
import { uploadBoAttachment, validateBoAttachment } from '@/lib/tcc-attachments';
import { CERTIFICATES_BUCKET, ensureCertificatesBucket } from '@/lib/storage';
import { revalidatePath } from 'next/cache';
import { notifyAllAdmins, notifyUser } from '@/lib/notifications';
import { getRemainingQuota, getTonnageBandMaxQuota, sumApprovedExports } from '@/lib/quota';
import { isActiveReachCertificate, REACH_CERTIFICATE_TYPE } from '@/lib/reach-certificate';

// ============================================================================
// APPLY FOR TCC (Client Action)
// ============================================================================
export async function applyForTccAction(prevState: unknown, formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== 'CLIENT') {
    return { success: false, error: 'Unauthorized. Clients only.' };
  }

  const clientId = session.clientId;
  if (!clientId) {
    return { success: false, error: 'User is not linked to a valid client organization.' };
  }

  const result = tccApplicationSchema.safeParse({
    chemical_id: formData.get('chemical_id'),
    quantity_mt: formData.get('quantity_mt'),
    kkdik_reg_no: formData.get('kkdik_reg_no') ?? '',
    export_date: formData.get('export_date'),
    remarks: formData.get('remarks') ?? '',
  });

  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: issue.message || `Invalid ${issue.path.join('.') || 'input'}.`,
    };
  }

  const adminSupabase = createAdminClient();

  try {
    // 1. Verify chemical is authorized for this client
    const { data: authChem } = await adminSupabase
      .from('client_chemicals')
      .select('id, available_quantity, status, chemicals(tonnage_band)')
      .eq('client_id', clientId)
      .eq('chemical_id', result.data.chemical_id)
      .eq('status', 'active')
      .maybeSingle();

    if (!authChem) {
      return { success: false, error: 'This chemical is not authorized for your company. Contact your administrator.' };
    }

    const { data: reachCert } = await adminSupabase
      .from('certificates')
      .select('id, certificate_number, chemical_id, status, expires_at, issued_at, type')
      .eq('client_id', clientId)
      .eq('chemical_id', result.data.chemical_id)
      .eq('type', REACH_CERTIFICATE_TYPE)
      .eq('status', 'active')
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!isActiveReachCertificate(reachCert)) {
      return {
        success: false,
        error:
          'A valid REACH Compliance Certificate is required before applying for TCC. Contact your administrator to issue one for this substance.',
      };
    }

    if (result.data.export_date && reachCert?.expires_at) {
      const exportD = new Date(result.data.export_date);
      const reachExpiry = new Date(reachCert.expires_at);
      if (exportD > reachExpiry) {
        return {
          success: false,
          error: `Expected export date exceeds REACH Compliance Certificate validity (${reachExpiry.toLocaleDateString()}).`,
        };
      }
    }

    const { data: approvedForChem } = await adminSupabase
      .from('tcc_applications')
      .select('chemical_id, quantity_mt, status, export_date, updated_at, created_at, certificates(issued_at)')
      .eq('client_id', clientId)
      .eq('chemical_id', result.data.chemical_id)
      .eq('status', 'approved');

    const exportedMt = sumApprovedExports(approvedForChem || [], result.data.chemical_id);
    const chem = Array.isArray(authChem.chemicals) ? authChem.chemicals[0] : authChem.chemicals;
    const tonnageBand = (chem as { tonnage_band?: string | null } | null)?.tonnage_band ?? null;
    const clientQuota = getRemainingQuota(Number(authChem.available_quantity ?? 0), exportedMt, tonnageBand);
    if (clientQuota < result.data.quantity_mt) {
      return {
        success: false,
        error: `Insufficient quota. Requested: ${result.data.quantity_mt} MT, Available: ${clientQuota} MT.`,
      };
    }

    const [{ data: chemical }, { data: client }] = await Promise.all([
      adminSupabase
        .from('chemicals')
        .select('chemical_name')
        .eq('id', result.data.chemical_id)
        .single(),
      adminSupabase.from('clients').select('company_name').eq('id', clientId).single(),
    ]);

    if (!chemical) return { success: false, error: 'Chemical not found.' };

    const boFile = formData.get('bo_attachment');
    if (!(boFile instanceof File) || boFile.size === 0) {
      return { success: false, error: 'BO attachment is required.' };
    }

    const boValidation = validateBoAttachment(boFile);
    if (!boValidation.ok) {
      return { success: false, error: boValidation.error };
    }

    // 3. Create TCC application
    const { data: app, error: appError } = await adminSupabase
      .from('tcc_applications')
      .insert({
        client_id: clientId,
        chemical_id: result.data.chemical_id,
        client_chemical_id: authChem.id,
        quantity_mt: result.data.quantity_mt,
        kkdik_reg_no: result.data.kkdik_reg_no || null,
        export_date: result.data.export_date,
        remarks: result.data.remarks || null,
        status: 'pending',
      })
      .select()
      .single();

    if (appError) throw appError;

    const { url: boUrl, name: boName } = await uploadBoAttachment(adminSupabase, boFile, clientId, app.id);
    await adminSupabase
      .from('tcc_applications')
      .update({ bo_attachment_url: boUrl, bo_attachment_name: boName })
      .eq('id', app.id);

    // 4. Audit log
    await adminSupabase.from('audit_logs').insert({
      user_id: session.userId,
      action: 'CREATE_TCC_APPLICATION',
      entity_type: 'tcc_applications',
      entity_id: app.id,
      metadata: { quantity: result.data.quantity_mt, chemical: chemical.chemical_name },
    });

    // 5. Notify admins of new pending application
    const companyLabel = client?.company_name || 'A client';
    await notifyAllAdmins(
      adminSupabase,
      'New TCC application',
      `${companyLabel} submitted ${result.data.quantity_mt} MT for ${chemical.chemical_name}. Review in Approvals.`
    );

    revalidatePath('/client');
    revalidatePath('/admin', 'layout');
    return { success: true, message: 'TCC Application submitted. Status: Pending Review.' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || 'Failed to submit application.' };
  }
}

// ============================================================================
// PROCESS TCC APPLICATION (Admin Action)
// ============================================================================
export async function processTccAction(
  applicationId: string,
  status: 'approved' | 'rejected' | 'changes_required',
  rejectionReason = ''
) {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized.' };
  }

  const adminSupabase = createAdminClient();

  try {
    // 1. Fetch application with relations
    const { data: app, error: fetchError } = await adminSupabase
      .from('tcc_applications')
      .select(`
        *,
        clients (id, company_name, legal_name, email, phone, primary_contact_first_name, primary_contact_last_name),
        chemicals (id, chemical_name, cas_number, ec_number, tonnage_band, available_quantity, exported_quantity)
      `)
      .eq('id', applicationId)
      .single();

    if (fetchError || !app) throw new Error('Application not found');

    if (status === 'approved') {
      const { data: approvedForChem } = await adminSupabase
        .from('tcc_applications')
        .select('chemical_id, quantity_mt, status, export_date, updated_at, created_at, certificates(issued_at)')
        .eq('client_id', app.client_id)
        .eq('chemical_id', app.chemical_id)
        .eq('status', 'approved')
        .neq('id', applicationId);

      const exportedMt = sumApprovedExports(approvedForChem || [], app.chemical_id);
      const bandMax = getTonnageBandMaxQuota(app.chemicals.tonnage_band);
      const requested = Number(app.quantity_mt);

      if (bandMax != null && exportedMt + requested > bandMax) {
        return {
          success: false,
          error: `Cannot approve: ${exportedMt} MT already issued this year. Limit is ${bandMax} MT — only ${Math.max(0, bandMax - exportedMt)} MT remaining.`,
        };
      }
    }

    // 2. Update application status
    const { error: updateError } = await adminSupabase
      .from('tcc_applications')
      .update({
        status,
        rejection_reason: rejectionReason || null,
        approved_by: session.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (updateError) throw updateError;

    if (status === 'approved') {
      // 3. Deduct client-assigned quota (admin allocation on client_chemicals)
      let clientChemId = app.client_chemical_id as string | null;
      let clientChemAvailable: number | null = null;

      if (clientChemId) {
        const { data: clientChem } = await adminSupabase
          .from('client_chemicals')
          .select('available_quantity')
          .eq('id', clientChemId)
          .single();
        if (clientChem) clientChemAvailable = Number(clientChem.available_quantity);
      } else {
        const { data: clientChem } = await adminSupabase
          .from('client_chemicals')
          .select('id, available_quantity')
          .eq('client_id', app.client_id)
          .eq('chemical_id', app.chemical_id)
          .eq('status', 'active')
          .maybeSingle();
        if (clientChem) {
          clientChemId = clientChem.id;
          clientChemAvailable = Number(clientChem.available_quantity);
        }
      }

      if (clientChemId && clientChemAvailable != null) {
        const tonnageBand = app.chemicals.tonnage_band as string | null;
        const { data: allApproved } = await adminSupabase
          .from('tcc_applications')
          .select('chemical_id, quantity_mt, status, export_date, updated_at, created_at, certificates(issued_at)')
          .eq('client_id', app.client_id)
          .eq('chemical_id', app.chemical_id)
          .eq('status', 'approved');

        const exportedAfter = sumApprovedExports(allApproved || [], app.chemical_id);
        const syncedAvailable = getRemainingQuota(0, exportedAfter, tonnageBand);

        await adminSupabase
          .from('client_chemicals')
          .update({ available_quantity: syncedAvailable })
          .eq('id', clientChemId);

        if (!app.client_chemical_id) {
          await adminSupabase
            .from('tcc_applications')
            .update({ client_chemical_id: clientChemId })
            .eq('id', applicationId);
        }
      }

      const newExported = Number(app.chemicals.exported_quantity) + Number(app.quantity_mt);
      await adminSupabase
        .from('chemicals')
        .update({ exported_quantity: newExported })
        .eq('id', app.chemical_id);

      // 4. Record quota transaction
      await adminSupabase.from('quota_transactions').insert({
        client_id: app.client_id,
        chemical_id: app.chemical_id,
        tcc_application_id: applicationId,
        quantity_mt: app.quantity_mt,
        transaction_type: 'deduct',
        performed_by: session.userId,
        notes: `TCC approved — ${app.chemicals.chemical_name}`,
      });

      // 5. Generate unique certificate number
      const randStr = Math.random().toString(36).substring(2, 8).toUpperCase();
      const certNumber = `TCC-${new Date().getFullYear()}-${randStr}`;

      // 6. Get branding template
      const { data: branding } = await adminSupabase
        .from('templates')
        .select('*')
        .limit(1)
        .maybeSingle();

      // 7. Generate PDF
      const issueDate = new Date();
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      const pdfBuffer = await generateCertificatePdf({
        certificateNumber: certNumber,
        companyName: app.clients.company_name,
        legalName: app.clients.company_name,
        chemicalName: app.chemicals.chemical_name,
        casNumber: app.chemicals.cas_number,
        ecNumber: app.chemicals.ec_number || '',
        tonnageBand: app.chemicals.tonnage_band || 'N/A',
        quantityMt: Number(app.quantity_mt),
        issueDate: issueDate.toISOString().split('T')[0],
        expiryDate: expiryDate.toISOString().split('T')[0],
        logoUrl: branding?.logo || null,
        signatureUrl: branding?.signature_image || null,
        footerText: branding?.footer_text || null,
        accentColor: branding?.accent_color || '#064e3b',
      });

      // 8. Upload PDF to Supabase Storage
      await ensureCertificatesBucket(adminSupabase);
      const fileName = `${certNumber}.pdf`;
      const { error: uploadError } = await adminSupabase.storage
        .from(CERTIFICATES_BUCKET)
        .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true });

      if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);

      const { data: { publicUrl } } = adminSupabase.storage.from(CERTIFICATES_BUCKET).getPublicUrl(fileName);

      // 9. Register certificate in DB (NO email sent here)
      const { data: cert, error: certError } = await adminSupabase
        .from('certificates')
        .insert({
          client_id: app.client_id,
          tcc_application_id: applicationId,
          certificate_number: certNumber,
          type: 'TCC',
          file_url: publicUrl,
          issued_at: issueDate.toISOString(),
          expires_at: expiryDate.toISOString(),
          status: 'active',
          mail_sent: false,
          mail_resend_count: 0,
        })
        .select()
        .single();

      if (certError) throw certError;

      // 10. Activity log
      await adminSupabase.from('activity_logs').insert({
        client_id: app.client_id,
        user_id: session.userId,
        action: 'TCC_APPROVED',
        entity_type: 'tcc_applications',
        entity_id: applicationId,
        description: `TCC approved — Certificate ${certNumber} generated`,
      });

      // 11. Notify client
      const { data: clientUser } = await adminSupabase
        .from('users')
        .select('id')
        .eq('client_id', app.client_id)
        .maybeSingle();
      if (clientUser) {
        await notifyUser(
          adminSupabase,
          clientUser.id,
          'TCC Certificate Issued',
          `Your certificate ${certNumber} has been issued for ${app.chemicals.chemical_name}.`
        );
      }

      revalidatePath('/admin/approvals');
      revalidatePath('/admin', 'layout');
      revalidatePath('/client', 'layout');

      // Return certificate ID so frontend can redirect to preview
      return { success: true, message: 'Application approved. Certificate generated.', certificateId: cert.id };
    } else {
      // Rejected or Changes Required
      const { data: clientUser } = await adminSupabase
        .from('users')
        .select('id')
        .eq('client_id', app.client_id)
        .maybeSingle();
      if (clientUser) {
        await notifyUser(
          adminSupabase,
          clientUser.id,
          status === 'rejected' ? 'TCC Application Rejected' : 'TCC Changes Required',
          rejectionReason || `Your TCC application for ${app.chemicals.chemical_name} requires attention.`
        );
      }

      revalidatePath('/client', 'layout');

      await adminSupabase.from('activity_logs').insert({
        client_id: app.client_id,
        user_id: session.userId,
        action: status === 'rejected' ? 'TCC_REJECTED' : 'TCC_CHANGES_REQUIRED',
        entity_type: 'tcc_applications',
        entity_id: applicationId,
        description: rejectionReason || status,
      });

      revalidatePath('/admin/approvals');
      return { success: true, message: `Application ${status}.` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[TCC PROCESS ERROR]:', err);
    return { success: false, error: message };
  }
}

// ============================================================================
// SEND CERTIFICATE EMAIL (First send — admin manual trigger)
// ============================================================================
export async function sendCertificateEmailAction(certificateId: string) {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized.' };
  }

  const adminSupabase = createAdminClient();

  try {
    // Fetch certificate with all relations
    const { data: cert, error } = await adminSupabase
      .from('certificates')
      .select(`
        *,
        tcc_applications (
          id, quantity_mt, kkdik_reg_no,
          chemicals (chemical_name, cas_number, ec_number)
        ),
        clients (
          id, company_name, email, cc_emails,
          client_contacts (email)
        )
      `)
      .eq('id', certificateId)
      .single();

    if (error || !cert) throw new Error('Certificate not found');

    // Get SMTP settings from admin_settings
    const { data: settings } = await adminSupabase
      .from('admin_settings')
      .select('smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_cc_default, email')
      .eq('id', 1)
      .single();

    // Build CC list: secondary contacts + default CC
    const ccList: string[] = [];
    if (cert.clients.client_contacts) {
      cert.clients.client_contacts.forEach((c: { email: string }) => {
        if (c.email) ccList.push(c.email);
      });
    }
    if (settings?.smtp_cc_default) ccList.push(settings.smtp_cc_default);
    if (settings?.email) ccList.push(settings.email);

    // Download PDF from storage for attachment
    const { data: pdfData, error: pdfError } = await adminSupabase.storage
      .from('certificates')
      .download(`${cert.certificate_number}.pdf`);

    if (pdfError || !pdfData) throw new Error('Could not retrieve certificate PDF from storage');
    const pdfBuffer = Buffer.from(await pdfData.arrayBuffer());

    // Send email
    await sendCertEmail({
      to: cert.clients.email,
      cc: ccList,
      subject: `TCC Certificate Approved — ${cert.certificate_number}`,
      certificateNumber: cert.certificate_number,
      companyName: cert.clients.company_name,
      chemicalName: cert.tcc_applications?.chemicals?.chemical_name || 'N/A',
      pdfBuffer,
      pdfFileName: `${cert.certificate_number}.pdf`,
      smtpConfig: settings || undefined,
    });

    // Update mail tracking
    const now = new Date().toISOString();
    await adminSupabase
      .from('certificates')
      .update({
        mail_sent: true,
        mail_sent_at: now,
        mail_sent_by: session.userId,
      })
      .eq('id', certificateId);

    await adminSupabase.from('activity_logs').insert({
      client_id: cert.client_id,
      user_id: session.userId,
      action: 'CERTIFICATE_EMAIL_SENT',
      entity_type: 'certificates',
      entity_id: certificateId,
      description: `Certificate email sent to ${cert.clients.email}`,
    });

    revalidatePath(`/admin/certificate-preview/${certificateId}`);
    return { success: true, message: `Certificate email sent to ${cert.clients.email}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[SEND CERT EMAIL ERROR]:', err);
    return { success: false, error: message };
  }
}

// ============================================================================
// RESEND CERTIFICATE EMAIL
// ============================================================================
export async function resendCertificateEmailAction(certificateId: string) {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized.' };
  }

  const adminSupabase = createAdminClient();

  try {
    const { data: cert, error } = await adminSupabase
      .from('certificates')
      .select(`
        *,
        tcc_applications (chemicals (chemical_name)),
        clients (id, company_name, email, client_contacts (email))
      `)
      .eq('id', certificateId)
      .single();

    if (error || !cert) throw new Error('Certificate not found');
    if (!cert.mail_sent) throw new Error('Certificate has not been sent yet. Use Send Mail first.');

    const { data: settings } = await adminSupabase
      .from('admin_settings')
      .select('smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_cc_default, email')
      .eq('id', 1)
      .single();

    const ccList: string[] = [];
    if (cert.clients.client_contacts) {
      cert.clients.client_contacts.forEach((c: { email: string }) => {
        if (c.email) ccList.push(c.email);
      });
    }
    if (settings?.smtp_cc_default) ccList.push(settings.smtp_cc_default);
    if (settings?.email) ccList.push(settings.email);

    const { data: pdfData, error: pdfError } = await adminSupabase.storage
      .from('certificates')
      .download(`${cert.certificate_number}.pdf`);

    if (pdfError || !pdfData) throw new Error('Could not retrieve certificate PDF');
    const pdfBuffer = Buffer.from(await pdfData.arrayBuffer());

    await sendCertEmail({
      to: cert.clients.email,
      cc: ccList,
      subject: `TCC Certificate (Resent) — ${cert.certificate_number}`,
      certificateNumber: cert.certificate_number,
      companyName: cert.clients.company_name,
      chemicalName: cert.tcc_applications?.chemicals?.chemical_name || 'N/A',
      pdfBuffer,
      pdfFileName: `${cert.certificate_number}.pdf`,
      smtpConfig: settings || undefined,
    });

    const now = new Date().toISOString();
    await adminSupabase
      .from('certificates')
      .update({
        mail_resend_count: (cert.mail_resend_count || 0) + 1,
        last_resend_at: now,
        last_resend_by: session.userId,
      })
      .eq('id', certificateId);

    await adminSupabase.from('activity_logs').insert({
      client_id: cert.client_id,
      user_id: session.userId,
      action: 'CERTIFICATE_EMAIL_RESENT',
      entity_type: 'certificates',
      entity_id: certificateId,
      description: `Certificate email resent (${(cert.mail_resend_count || 0) + 1}x)`,
    });

    revalidatePath(`/admin/certificate-preview/${certificateId}`);
    return { success: true, message: 'Certificate email resent successfully.' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
