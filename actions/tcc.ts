'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { buildTccCertificateStoredFile } from '@/lib/tcc-pdf-data';
import {
  resolveTccCertificateDownloadFile,
  buildTccCertificatePdfInputFromCert,
} from '@/lib/tcc-certificate-pdf';
import { sendCertificateEmail as sendCertEmail } from '@/services/email';
import { buildCertificateRecipients } from '@/lib/certificate-email-recipients';
import { appendMailSentHistory } from '@/lib/certificate-mail-history';
import { buildTccSmtpConfig } from '@/lib/certificate-smtp-settings';
import { tccApplicationSchema } from '@/lib/validations';
import { uploadBoAttachment, validateBoAttachment } from '@/lib/tcc-attachments';
import { CERTIFICATES_BUCKET, ensureCertificatesBucket } from '@/lib/storage';
import { revalidatePath } from 'next/cache';
import { notifyAllAdmins, notifyUser } from '@/lib/notifications';
import { getRemainingQuota, getTonnageBandMaxQuota, sumApprovedExports } from '@/lib/quota';
import { isActiveReachCertificate, REACH_CERTIFICATE_TYPE } from '@/lib/reach-certificate';
import { canClientEditTccApplication } from '@/lib/tcc-application';
import { formatErrorMessage } from '@/lib/format-error';
import type { z } from 'zod';

type TccApplicationInput = z.infer<typeof tccApplicationSchema>;

function resolveEuImporterFields(data: TccApplicationInput) {
  return {
    eu_importer_company_name: data.eu_importer_company_name.trim(),
    eu_importer_address: data.eu_importer_address.trim(),
    purchase_order_number: data.purchase_order_number.trim(),
    invoice_number: data.invoice_number?.trim() || null,
  };
}

function tccSaveErrorMessage(err: unknown): string {
  const message = formatErrorMessage(err);
  if (
    message.includes('eu_importer') ||
    message.includes('purchase_order_number') ||
    message.includes('invoice_number') ||
    message.includes('PGRST204')
  ) {
    return 'Database is missing EU Importer columns. Run the latest database.sql migration in Supabase, then try again.';
  }
  return message || 'Failed to save application.';
}

function parseTccApplicationFormData(formData: FormData) {
  return tccApplicationSchema.safeParse({
    chemical_id: formData.get('chemical_id'),
    quantity_mt: formData.get('quantity_mt'),
    registration_number: formData.get('registration_number') ?? '',
    export_date: formData.get('export_date'),
    remarks: formData.get('remarks') ?? '',
    eu_importer_company_name: formData.get('eu_importer_company_name') ?? '',
    eu_importer_address: formData.get('eu_importer_address') ?? '',
    purchase_order_number: formData.get('purchase_order_number') ?? '',
    invoice_number: formData.get('invoice_number') ?? '',
  });
}

async function validateClientTccSubmission(
  adminSupabase: ReturnType<typeof createAdminClient>,
  clientId: string,
  data: {
    chemical_id: string;
    quantity_mt: number;
    export_date: string;
  }
) {
  const { data: authChem } = await adminSupabase
    .from('client_chemicals')
    .select('id, available_quantity, status, chemicals(tonnage_band)')
    .eq('client_id', clientId)
    .eq('chemical_id', data.chemical_id)
    .eq('status', 'active')
    .maybeSingle();

  if (!authChem) {
    return { ok: false as const, error: 'This chemical is not authorized for your company. Contact your administrator.' };
  }

  const { data: reachCert } = await adminSupabase
    .from('certificates')
    .select('id, certificate_number, chemical_id, status, expires_at, issued_at, type')
    .eq('client_id', clientId)
    .eq('chemical_id', data.chemical_id)
    .eq('type', REACH_CERTIFICATE_TYPE)
    .eq('status', 'active')
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!isActiveReachCertificate(reachCert)) {
    return {
      ok: false as const,
      error:
        'A valid REACH Compliance Certificate is required before applying for TCC. Contact your administrator to issue one for this substance.',
    };
  }

  if (data.export_date && reachCert?.expires_at) {
    const exportD = new Date(data.export_date);
    const reachExpiry = new Date(reachCert.expires_at);
    if (exportD > reachExpiry) {
      return {
        ok: false as const,
        error: `Expected export date exceeds REACH Compliance Certificate validity (${reachExpiry.toLocaleDateString()}).`,
      };
    }
  }

  const { data: approvedForChem } = await adminSupabase
    .from('tcc_applications')
    .select('chemical_id, quantity_mt, status, export_date, updated_at, created_at, certificates(issued_at)')
    .eq('client_id', clientId)
    .eq('chemical_id', data.chemical_id)
    .eq('status', 'approved');

  const exportedMt = sumApprovedExports(approvedForChem || [], data.chemical_id);
  const chem = Array.isArray(authChem.chemicals) ? authChem.chemicals[0] : authChem.chemicals;
  const tonnageBand = (chem as { tonnage_band?: string | null } | null)?.tonnage_band ?? null;
  const clientQuota = getRemainingQuota(Number(authChem.available_quantity ?? 0), exportedMt, tonnageBand);

  if (clientQuota < data.quantity_mt) {
    return {
      ok: false as const,
      error: `Insufficient quota. Requested: ${data.quantity_mt} MT, Available: ${clientQuota} MT.`,
    };
  }

  return { ok: true as const, authChem };
}

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

  const result = parseTccApplicationFormData(formData);

  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: issue.message || `Invalid ${issue.path.join('.') || 'input'}.`,
    };
  }

  const adminSupabase = createAdminClient();

  try {
    const validation = await validateClientTccSubmission(adminSupabase, clientId, result.data);
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }
    const authChem = validation.authChem;

    const [{ data: chemical }, euImporter] = await Promise.all([
      adminSupabase
        .from('chemicals')
        .select('chemical_name')
        .eq('id', result.data.chemical_id)
        .single(),
      resolveEuImporterFields(result.data),
    ]);

    if (!chemical) return { success: false, error: 'Chemical not found.' };

    const boFile = formData.get('bo_attachment');
    if (!(boFile instanceof File) || boFile.size === 0) {
      return { success: false, error: 'PO attachment is required.' };
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
        registration_number: result.data.registration_number || null,
        export_date: result.data.export_date,
        remarks: result.data.remarks || null,
        ...euImporter,
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
    const companyLabel = euImporter.eu_importer_company_name || 'A client';
    await notifyAllAdmins(
      adminSupabase,
      'New TCC application',
      `${companyLabel} submitted ${result.data.quantity_mt} MT for ${chemical.chemical_name}. Review in Approvals.`
    );

    revalidatePath('/client');
    revalidatePath('/client/apply');
    revalidatePath('/admin', 'layout');
    revalidatePath('/admin/approvals');
    return { success: true, message: 'TCC Application submitted. Status: Pending Review.' };
  } catch (err: unknown) {
    return { success: false, error: tccSaveErrorMessage(err) };
  }
}

// ============================================================================
// UPDATE TCC APPLICATION (Client — until admin approves)
// ============================================================================
export async function updateTccApplicationAction(prevState: unknown, formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== 'CLIENT') {
    return { success: false, error: 'Unauthorized. Clients only.' };
  }

  const clientId = session.clientId;
  if (!clientId) {
    return { success: false, error: 'User is not linked to a valid client organization.' };
  }

  const applicationId = String(formData.get('application_id') ?? '').trim();
  if (!applicationId) {
    return { success: false, error: 'Application ID is required.' };
  }

  const result = parseTccApplicationFormData(formData);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: issue.message || `Invalid ${issue.path.join('.') || 'input'}.`,
    };
  }

  const adminSupabase = createAdminClient();

  try {
    const { data: existing, error: loadError } = await adminSupabase
      .from('tcc_applications')
      .select('id, client_id, status, bo_attachment_url, bo_attachment_name')
      .eq('id', applicationId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (loadError) throw loadError;
    if (!existing) {
      return { success: false, error: 'Application not found.' };
    }
    if (!canClientEditTccApplication(existing.status)) {
      return { success: false, error: 'Approved applications cannot be edited.' };
    }

    const validation = await validateClientTccSubmission(adminSupabase, clientId, result.data);
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }
    const authChem = validation.authChem;

    const boFile = formData.get('bo_attachment');
    const hasNewBo = boFile instanceof File && boFile.size > 0;
    if (!hasNewBo && !existing.bo_attachment_url) {
      return { success: false, error: 'PO attachment is required.' };
    }

    if (hasNewBo) {
      const boValidation = validateBoAttachment(boFile);
      if (!boValidation.ok) {
        return { success: false, error: boValidation.error };
      }
    }

    const resetStatus = ['changes_required', 'modification_requested', 'rejected'].includes(existing.status);
    const euImporter = resolveEuImporterFields(result.data);

    const { error: updateError } = await adminSupabase
      .from('tcc_applications')
      .update({
        chemical_id: result.data.chemical_id,
        client_chemical_id: authChem.id,
        quantity_mt: result.data.quantity_mt,
        registration_number: result.data.registration_number || null,
        export_date: result.data.export_date,
        remarks: result.data.remarks || null,
        ...euImporter,
        ...(resetStatus ? { status: 'pending', rejection_reason: null } : {}),
      })
      .eq('id', applicationId);

    if (updateError) throw updateError;

    if (hasNewBo) {
      const { url: boUrl, name: boName } = await uploadBoAttachment(
        adminSupabase,
        boFile,
        clientId,
        applicationId
      );
      await adminSupabase
        .from('tcc_applications')
        .update({ bo_attachment_url: boUrl, bo_attachment_name: boName })
        .eq('id', applicationId);
    }

    await adminSupabase.from('audit_logs').insert({
      user_id: session.userId,
      action: 'UPDATE_TCC_APPLICATION',
      entity_type: 'tcc_applications',
      entity_id: applicationId,
      metadata: { quantity: result.data.quantity_mt },
    });

    revalidatePath('/client');
    revalidatePath('/client/apply');
    revalidatePath('/admin', 'layout');
    revalidatePath('/admin/approvals');
    return { success: true, message: 'TCC application updated successfully.' };
  } catch (err: unknown) {
    return { success: false, error: tccSaveErrorMessage(err) };
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
        clients (id, company_name, legal_name, email, phone, primary_contact_first_name, primary_contact_last_name, uuid_number, address, city, state, postal_code, country),
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

      // 6. Fetch REACH registration number for this substance
      const { data: reachCert } = await adminSupabase
        .from('certificates')
        .select('registration_number')
        .eq('client_id', app.client_id)
        .eq('chemical_id', app.chemical_id)
        .eq('type', REACH_CERTIFICATE_TYPE)
        .eq('status', 'active')
        .order('issued_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 7. Generate certificate file from TCC Word template
      const issueDate = new Date();
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      const certFile = await buildTccCertificateStoredFile({
        certNumber,
        client: app.clients,
        chemical: app.chemicals,
        application: app,
        registrationNumber: reachCert?.registration_number,
        validUntilDate: expiryDate.toISOString().split('T')[0],
        deliveryChallanNo: app.tracking_id,
      });

      // 8. Upload to Supabase Storage
      await ensureCertificatesBucket(adminSupabase);
      const { error: uploadError } = await adminSupabase.storage
        .from(CERTIFICATES_BUCKET)
        .upload(certFile.fileName, certFile.buffer, {
          contentType: certFile.contentType,
          upsert: true,
        });

      if (uploadError) throw new Error(`Certificate upload failed: ${uploadError.message}`);

      const {
        data: { publicUrl },
      } = adminSupabase.storage.from(CERTIFICATES_BUCKET).getPublicUrl(certFile.fileName);

      // 9. Register certificate in DB (NO email sent here)
      const { data: cert, error: certError } = await adminSupabase
        .from('certificates')
        .insert({
          client_id: app.client_id,
          chemical_id: app.chemical_id,
          tcc_application_id: applicationId,
          certificate_number: certNumber,
          registration_number: reachCert?.registration_number || null,
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
        chemicals (chemical_name, cas_number, ec_number, tonnage_band),
        tcc_applications (
          id, quantity_mt, registration_number, export_date, tracking_id, remarks,
          chemicals (chemical_name, cas_number, ec_number, tonnage_band)
        ),
        clients (
          id, company_name, email, cc_emails, uuid_number, address, city, state, postal_code, country,
          client_contacts (email)
        )
      `)
      .eq('id', certificateId)
      .eq('type', 'TCC')
      .single();

    if (error || !cert) throw new Error('Certificate not found');

    // Get SMTP settings from admin_settings
    const { data: settings } = await adminSupabase
      .from('admin_settings')
      .select('smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_cc_default')
      .eq('id', 1)
      .single();

    const contactEmails =
      cert.clients.client_contacts?.map((c: { email: string }) => c.email).filter(Boolean) || [];

    const recipients = buildCertificateRecipients({
      primaryEmail: cert.clients.email,
      contactEmails,
      defaultCcEmails: settings?.smtp_cc_default,
      senderEmail: settings?.smtp_from,
    });

    const pdfInput = buildTccCertificatePdfInputFromCert(cert as never);
    const certFile = await resolveTccCertificateDownloadFile(adminSupabase, pdfInput);

    // Send email
    await sendCertEmail({
      to: recipients.to,
      cc: recipients.cc,
      subject: `TCC Certificate Approved — ${cert.certificate_number}`,
      certificateNumber: cert.certificate_number,
      companyName: cert.clients.company_name,
      chemicalName: cert.tcc_applications?.chemicals?.chemical_name || 'N/A',
      pdfBuffer: certFile.buffer,
      pdfFileName: certFile.fileName,
      attachmentContentType: certFile.contentType,
      smtpConfig: buildTccSmtpConfig(settings),
    });

    // Update mail tracking
    const now = new Date().toISOString();
    await adminSupabase
      .from('certificates')
      .update({
        mail_sent: true,
        mail_sent_at: now,
        mail_sent_by: session.userId,
        mail_sent_history: [now],
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
    revalidatePath('/admin/approvals');
    revalidatePath(`/admin/clients/${cert.client_id}`);
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
        chemicals (chemical_name, cas_number, ec_number, tonnage_band),
        tcc_applications (
          quantity_mt, registration_number, export_date, tracking_id, remarks,
          chemicals (chemical_name, cas_number, ec_number, tonnage_band)
        ),
        clients (
          id, company_name, email, uuid_number, address, city, state, postal_code, country,
          client_contacts (email)
        )
      `)
      .eq('id', certificateId)
      .eq('type', 'TCC')
      .single();

    if (error || !cert) throw new Error('Certificate not found');
    if (!cert.mail_sent) throw new Error('Certificate has not been sent yet. Use Send Mail first.');

    const { data: settings } = await adminSupabase
      .from('admin_settings')
      .select('smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_cc_default')
      .eq('id', 1)
      .single();

    const contactEmails =
      cert.clients.client_contacts?.map((c: { email: string }) => c.email).filter(Boolean) || [];

    const recipients = buildCertificateRecipients({
      primaryEmail: cert.clients.email,
      contactEmails,
      defaultCcEmails: settings?.smtp_cc_default,
      senderEmail: settings?.smtp_from,
    });

    const pdfInput = buildTccCertificatePdfInputFromCert(cert as never);
    const certFile = await resolveTccCertificateDownloadFile(adminSupabase, pdfInput);

    await sendCertEmail({
      to: recipients.to,
      cc: recipients.cc,
      subject: `TCC Certificate (Resent) — ${cert.certificate_number}`,
      certificateNumber: cert.certificate_number,
      companyName: cert.clients.company_name,
      chemicalName: cert.tcc_applications?.chemicals?.chemical_name || 'N/A',
      pdfBuffer: certFile.buffer,
      pdfFileName: certFile.fileName,
      attachmentContentType: certFile.contentType,
      smtpConfig: buildTccSmtpConfig(settings),
    });

    const now = new Date().toISOString();
    await adminSupabase
      .from('certificates')
      .update({
        mail_resend_count: (cert.mail_resend_count || 0) + 1,
        last_resend_at: now,
        last_resend_by: session.userId,
        mail_sent_history: appendMailSentHistory(cert.mail_sent_history, now),
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
    revalidatePath('/admin/approvals');
    revalidatePath(`/admin/clients/${cert.client_id}`);
    return { success: true, message: 'Certificate email resent successfully.' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
