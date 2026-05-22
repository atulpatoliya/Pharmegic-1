'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processTccApplication, getActiveTemplate } from '@/services/db';
import { sendEmail } from '@/services/email';
import { getTccApprovalEmail, getTccRejectionEmail } from '@/emails/templates';
import { generateCertificatePdf } from '@/services/pdf';
import { tccApplicationSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

// ============================================================================
// APPLY FOR TCC (Client Action)
// ============================================================================
export async function applyForTccAction(prevState: any, formData: FormData) {
  const chemical_id = formData.get('chemical_id') as string;
  const quantity_mt = formData.get('quantity_mt') as string;
  const kkdik_reg_no = formData.get('kkdik_reg_no') as string;
  const export_date = formData.get('export_date') as string;

  const result = tccApplicationSchema.safeParse({
    chemical_id,
    quantity_mt,
    kkdik_reg_no,
    export_date,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0].message,
    };
  }

  const supabase = await createClient();

  // Get logged-in user profile
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== 'CLIENT') {
    return { success: false, error: 'Unauthorized. Clients only.' };
  }

  const clientId = user.user_metadata?.client_id;
  if (!clientId) {
    return { success: false, error: 'User is not linked to a valid client organization.' };
  }

  try {
    // 1. Verify chemical is authorized for this client
    const { data: authChem, error: authCheckError } = await supabase
      .from('client_chemicals')
      .select('*')
      .eq('client_id', clientId)
      .eq('chemical_id', result.data.chemical_id)
      .limit(1)
      .maybeSingle();

    if (authCheckError || !authChem) {
      return {
        success: false,
        error: 'This chemical substance is not authorized for your company. Please contact support.',
      };
    }

    // 2. Quota check: Verify chemical has enough available quantity
    const { data: chemical } = await supabase
      .from('chemicals')
      .select('available_quantity, chemical_name')
      .eq('id', result.data.chemical_id)
      .single();

    if (!chemical) {
      return { success: false, error: 'Chemical substance not found in inventory.' };
    }

    if (Number(chemical.available_quantity) < result.data.quantity_mt) {
      return {
        success: false,
        error: `Insufficient quota. Requested: ${result.data.quantity_mt} MT, Available: ${chemical.available_quantity} MT.`,
      };
    }

    // 3. Create TCC application
    const { data: app, error: appError } = await supabase
      .from('tcc_applications')
      .insert({
        client_id: clientId,
        chemical_id: result.data.chemical_id,
        quantity_mt: result.data.quantity_mt,
        kkdik_reg_no: result.data.kkdik_reg_no,
        export_date: result.data.export_date,
        status: 'pending',
      })
      .select()
      .single();

    if (appError) throw appError;

    // 4. Create Audit Log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'CREATE_TCC_APPLICATION',
      entity_type: 'tcc_applications',
      entity_id: app.id,
      metadata: { quantity: result.data.quantity_mt, chemical: chemical.chemical_name },
    });

    revalidatePath('/client');
    revalidatePath('/client/certificates');
    return {
      success: true,
      message: 'TCC Application submitted successfully. Status is currently pending review.',
    };
  } catch (err: any) {
    console.error('[TCC APPLICATION ERROR]:', err);
    return {
      success: false,
      error: err.message || 'Failed to submit application.',
    };
  }
}

// ============================================================================
// PROCESS TCC APPLICATION (Admin Action)
// ============================================================================
export async function processTccAction(
  applicationId: string,
  status: 'approved' | 'rejected' | 'modification_requested',
  rejectionReason = ''
) {
  const userSupabase = await createClient();

  // Verify Admin/Staff Role
  const { data: { user: adminUser } } = await userSupabase.auth.getUser();
  if (!adminUser || (adminUser.user_metadata?.role !== 'MASTER_ADMIN' && adminUser.user_metadata?.role !== 'STAFF')) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    // 1. Process application in database (deducts chemical quantity if approved)
    const app = await processTccApplication(userSupabase, applicationId, status, adminUser.id, rejectionReason);

    const adminSupabase = createAdminClient();

    if (status === 'approved') {
      // 2. Generate unique TCC Certificate number
      const randStr = Math.random().toString(36).substring(2, 8).toUpperCase();
      const certNumber = `TCC-${new Date().getFullYear()}-${randStr}`;

      // 3. Get certificate branding template config
      const branding = await getActiveTemplate(userSupabase);

      // 4. Compile TCC PDF document buffer
      const issueDate = new Date();
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year validity

      const formattedIssueDate = issueDate.toISOString().split('T')[0];
      const formattedExpiryDate = expiryDate.toISOString().split('T')[0];

      const pdfBuffer = await generateCertificatePdf({
        certificateNumber: certNumber,
        companyName: app.clients.company_name,
        legalName: app.clients.legal_name || app.clients.company_name,
        chemicalName: app.chemicals.chemical_name,
        casNumber: app.chemicals.cas_number,
        ecNumber: app.chemicals.ec_number || '',
        tonnageBand: app.chemicals.tonnage_band || 'N/A',
        quantityMt: Number(app.quantity_mt),
        issueDate: formattedIssueDate,
        expiryDate: formattedExpiryDate,
        logoUrl: branding?.logo || null,
        signatureUrl: branding?.signature_image || null,
        footerText: branding?.footer_text || null,
        accentColor: branding?.accent_color || '#064e3b',
      });

      // 5. Upload PDF into Supabase Storage Bucket
      const fileName = `${certNumber}.pdf`;
      const { error: uploadError } = await adminSupabase.storage
        .from('certificates')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error('[STORAGE UPLOAD ERROR]:', uploadError);
        throw new Error(`Failed to upload certificate PDF: ${uploadError.message}`);
      }

      // Get PDF public URL
      const { data: { publicUrl } } = adminSupabase.storage
        .from('certificates')
        .getPublicUrl(fileName);

      // 6. Register Certificate in table
      const { data: cert, error: certError } = await userSupabase
        .from('certificates')
        .insert({
          client_id: app.client_id,
          application_id: applicationId,
          certificate_number: certNumber,
          type: 'TCC',
          file_url: publicUrl,
          issued_at: issueDate.toISOString(),
          expires_at: expiryDate.toISOString(),
          status: 'active',
        })
        .select()
        .single();

      if (certError) throw certError;

      // 7. Dispatch Notification to client contacts / dashboard
      const clientUserId = await getClientUserId(userSupabase, app.client_id);
      if (clientUserId) {
        await userSupabase.from('notifications').insert({
          user_id: clientUserId,
          title: 'TCC Certificate Issued',
          message: `Your T tonnage compliance certificate ${certNumber} has been issued for ${app.chemicals.chemical_name}.`,
          read: false,
        });
      }

      // 8. Send TCC Approval email via SMTP
      const emailHtml = getTccApprovalEmail(
        app.clients.company_name,
        app.chemicals.chemical_name,
        certNumber,
        publicUrl
      );
      await sendEmail({
        to: app.clients.email,
        subject: `APPROVED: Tonnage Compliance Certificate — ${certNumber}`,
        html: emailHtml,
      });
    } else {
      // TCC Rejected / Modification Requested
      const clientUserId = await getClientUserId(userSupabase, app.client_id);
      if (clientUserId) {
        await userSupabase.from('notifications').insert({
          user_id: clientUserId,
          title: 'TCC Action Required',
          message: `Your TCC application for ${app.chemicals.chemical_name} was reviewed. Action details: ${rejectionReason}`,
          read: false,
        });
      }

      // Send rejection/modification email
      const emailHtml = getTccRejectionEmail(
        app.clients.company_name,
        app.chemicals.chemical_name,
        rejectionReason
      );
      await sendEmail({
        to: app.clients.email,
        subject: `ACTION REQUIRED: TCC Application substance — ${app.chemicals.chemical_name}`,
        html: emailHtml,
      });
    }

    // 9. Write audit log
    await userSupabase.from('audit_logs').insert({
      user_id: adminUser.id,
      action: `PROCESS_TCC_${status.toUpperCase()}`,
      entity_type: 'tcc_applications',
      entity_id: applicationId,
      metadata: { status, rejectionReason },
    });

    revalidatePath('/admin/approvals');
    revalidatePath('/admin');
    return { success: true, message: `Application status set to ${status}.` };
  } catch (err: any) {
    console.error('[TCC PROCESS ACTION ERROR]:', err);
    return { success: false, error: err.message || 'Failed to process application.' };
  }
}

// Helper to look up a user_id linked to a client
async function getClientUserId(supabase: any, clientId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('client_id', clientId)
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}
