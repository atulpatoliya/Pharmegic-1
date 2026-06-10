'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { buildReachCertificateStoredFile } from '@/lib/reach-pdf-data';
import { buildCertificateRecipients } from '@/lib/certificate-email-recipients';
import { CERTIFICATES_BUCKET, ensureCertificatesBucket } from '@/lib/storage';
import { revalidatePath } from 'next/cache';
import { notifyUser } from '@/lib/notifications';
import { sendCertificateEmail as sendCertEmail } from '@/services/email';
import {
  REACH_CERTIFICATE_TYPE,
  getLastDateOfYear,
  getTodayDateString,
  isActiveReachCertificate,
} from '@/lib/reach-certificate';

async function requireAdmin() {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return null;
  }
  return session;
}

export type CreateReachCertificateInput = {
  clientId: string;
  chemicalId: string;
  userId: string;
  registrationNumber: string;
  issuedDate: string;
  validatedDate: string;
};

export async function createReachCertificate(input: CreateReachCertificateInput) {
  const { clientId, chemicalId, userId, registrationNumber, issuedDate, validatedDate } = input;
  const adminSupabase = createAdminClient();

  if (!registrationNumber.trim()) {
    return { success: false as const, error: 'Registration number is required.' };
  }
  if (!issuedDate || !validatedDate) {
    return { success: false as const, error: 'Issued date and validated date are required.' };
  }
  if (new Date(validatedDate) < new Date(issuedDate)) {
    return { success: false as const, error: 'Validated date cannot be before issued date.' };
  }

  const [{ data: client }, { data: clientChem }, { data: chemical }] = await Promise.all([
    adminSupabase
      .from('clients')
      .select('id, company_name, email, uuid_number, address, city, state, postal_code, country')
      .eq('id', clientId)
      .single(),
    adminSupabase
      .from('client_chemicals')
      .select('id, status')
      .eq('client_id', clientId)
      .eq('chemical_id', chemicalId)
      .eq('status', 'active')
      .maybeSingle(),
    adminSupabase
      .from('chemicals')
      .select('id, chemical_name, cas_number, ec_number, tonnage_band')
      .eq('id', chemicalId)
      .single(),
  ]);

  if (!client) return { success: false as const, error: 'Client not found.' };
  if (!clientChem) {
    return {
      success: false as const,
      error: 'This substance is not actively assigned to the client. Assign it first.',
    };
  }
  if (!chemical) return { success: false as const, error: 'Chemical not found.' };

  const { data: existingReach } = await adminSupabase
    .from('certificates')
    .select('id, certificate_number, chemical_id, status, expires_at, issued_at, type')
    .eq('client_id', clientId)
    .eq('chemical_id', chemicalId)
    .eq('type', REACH_CERTIFICATE_TYPE)
    .eq('status', 'active')
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (isActiveReachCertificate(existingReach)) {
    return {
      success: false as const,
      error: `An active RC Certificate already exists for ${chemical.chemical_name}. Renew after it expires.`,
    };
  }

  await adminSupabase
    .from('certificates')
    .update({ status: 'expired' })
    .eq('client_id', clientId)
    .eq('chemical_id', chemicalId)
    .eq('type', REACH_CERTIFICATE_TYPE)
    .eq('status', 'active');

  const issueDate = new Date(issuedDate);
  const expiryDate = new Date(validatedDate);
  const randStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const certNumber = `RC-${issueDate.getFullYear()}-${randStr}`;

  const certFile = await buildReachCertificateStoredFile(client, chemical, certNumber, {
    registrationNumber: registrationNumber.trim(),
    issuedDate,
    validatedDate,
  });

  await ensureCertificatesBucket(adminSupabase);
  const { error: uploadError } = await adminSupabase.storage
    .from(CERTIFICATES_BUCKET)
    .upload(certFile.fileName, certFile.buffer, {
      contentType: certFile.contentType,
      upsert: true,
    });

  if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = adminSupabase.storage.from(CERTIFICATES_BUCKET).getPublicUrl(certFile.fileName);

  const { data: cert, error: certError } = await adminSupabase
    .from('certificates')
    .insert({
      client_id: clientId,
      chemical_id: chemicalId,
      certificate_number: certNumber,
      registration_number: registrationNumber.trim(),
      type: REACH_CERTIFICATE_TYPE,
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

  await adminSupabase.from('activity_logs').insert({
    client_id: clientId,
    user_id: userId,
    action: 'REACH_CERTIFICATE_ISSUED',
    entity_type: 'certificates',
    entity_id: cert.id,
    description: `RC Certificate ${certNumber} issued for ${chemical.chemical_name}`,
  });

  const { data: clientUser } = await adminSupabase
    .from('users')
    .select('id')
    .eq('client_id', clientId)
    .maybeSingle();

  if (clientUser) {
    await notifyUser(
      adminSupabase,
      clientUser.id,
      'RC Compliance Certificate Issued',
      `Your RC certificate ${certNumber} for ${chemical.chemical_name} is valid until ${expiryDate.toLocaleDateString()}. You may now apply for TCC permits for this substance.`
    );
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}/rc-certificates`);
  revalidatePath('/client');

  return {
    success: true as const,
    message: `RC Certificate issued for ${chemical.chemical_name}.`,
    certificateId: cert.id,
    certNumber,
  };
}

export async function regenerateReachCertificateFile(certId: string) {
  const adminSupabase = createAdminClient();

  const { data: cert } = await adminSupabase
    .from('certificates')
    .select(
      'id, certificate_number, registration_number, issued_at, expires_at, client_id, chemical_id, type'
    )
    .eq('id', certId)
    .eq('type', REACH_CERTIFICATE_TYPE)
    .single();

  if (!cert?.client_id || !cert.chemical_id) return { success: false as const, error: 'Certificate not found.' };

  const [{ data: client }, { data: chemical }] = await Promise.all([
    adminSupabase
      .from('clients')
      .select('id, company_name, uuid_number, address, city, state, postal_code, country')
      .eq('id', cert.client_id)
      .single(),
    adminSupabase
      .from('chemicals')
      .select('id, chemical_name, cas_number, ec_number, tonnage_band')
      .eq('id', cert.chemical_id)
      .single(),
  ]);

  if (!client || !chemical || !cert.registration_number) {
    return { success: false as const, error: 'Missing certificate data for regeneration.' };
  }

  const certFile = await buildReachCertificateStoredFile(client, chemical, cert.certificate_number, {
    registrationNumber: cert.registration_number,
    issuedDate: cert.issued_at.split('T')[0],
    validatedDate: cert.expires_at?.split('T')[0] || getLastDateOfYear(),
  });

  await ensureCertificatesBucket(adminSupabase);
  const { error: uploadError } = await adminSupabase.storage
    .from(CERTIFICATES_BUCKET)
    .upload(certFile.fileName, certFile.buffer, {
      contentType: certFile.contentType,
      upsert: true,
    });

  if (uploadError) return { success: false as const, error: uploadError.message };

  const {
    data: { publicUrl },
  } = adminSupabase.storage.from(CERTIFICATES_BUCKET).getPublicUrl(certFile.fileName);

  await adminSupabase.from('certificates').update({ file_url: publicUrl }).eq('id', certId);

  return { success: true as const, fileUrl: publicUrl };
}

export async function issueReachCertificateFromPreviewAction(
  clientId: string,
  chemicalId: string,
  data: { registrationNumber: string; issuedDate: string; validatedDate: string }
) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  try {
    const result = await createReachCertificate({
      clientId,
      chemicalId,
      userId: session.userId,
      registrationNumber: data.registrationNumber,
      issuedDate: data.issuedDate,
      validatedDate: data.validatedDate,
    });

    if (!result.success) return result;
    return {
      success: true,
      message: result.message,
      certificateId: result.certificateId,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// ISSUE RC CERTIFICATE (Admin — renew from substance table)
// ============================================================================
export async function issueReachCertificateAction(clientId: string, chemicalId: string) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const endOfYear = getLastDateOfYear();
  const today = getTodayDateString();
  const adminSupabase = createAdminClient();

  const { data: prevCert } = await adminSupabase
    .from('certificates')
    .select('registration_number')
    .eq('client_id', clientId)
    .eq('chemical_id', chemicalId)
    .eq('type', REACH_CERTIFICATE_TYPE)
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!prevCert?.registration_number) {
    return {
      success: false,
      error: 'Registration number not found. Re-assign the substance with registration details.',
    };
  }

  try {
    const result = await createReachCertificate({
      clientId,
      chemicalId,
      userId: session.userId,
      registrationNumber: prevCert.registration_number,
      issuedDate: today,
      validatedDate: endOfYear,
    });

    if (!result.success) return result;
    return {
      success: true,
      message: result.message,
      certificateId: result.certificateId,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

async function fetchReachCertificateMailContext(certificateId: string) {
  const adminSupabase = createAdminClient();

  const [{ data: cert, error }, { data: settings }] = await Promise.all([
    adminSupabase
      .from('certificates')
      .select(`
        *,
        chemicals (chemical_name),
        clients (
          id,
          company_name,
          email,
          client_contacts (email)
        )
      `)
      .eq('id', certificateId)
      .eq('type', REACH_CERTIFICATE_TYPE)
      .single(),
    adminSupabase
      .from('admin_settings')
      .select('smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, cc_emails, bcc_emails')
      .eq('id', 1)
      .single(),
  ]);

  if (error || !cert) throw new Error('REACH certificate not found.');
  if (!cert.clients?.email) throw new Error('Client primary email is not configured.');

  const contactEmails =
    cert.clients.client_contacts?.map((c: { email: string }) => c.email).filter(Boolean) || [];

  const recipients = buildCertificateRecipients({
    primaryEmail: cert.clients.email,
    contactEmails,
    adminCcEmails: settings?.cc_emails,
    adminBccEmails: settings?.bcc_emails,
  });

  const attachment = await downloadReachCertificateAttachment(
    adminSupabase,
    cert.certificate_number
  );

  return {
    cert,
    settings,
    recipients,
    attachment,
    chemicalName: cert.chemicals?.chemical_name || 'N/A',
  };
}

async function downloadReachCertificateAttachment(
  adminSupabase: ReturnType<typeof createAdminClient>,
  certificateNumber: string
) {
  const candidates = [
    { fileName: `${certificateNumber}.pdf`, contentType: 'application/pdf' },
    {
      fileName: `${certificateNumber}.docx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  ];

  for (const candidate of candidates) {
    const { data, error } = await adminSupabase.storage
      .from(CERTIFICATES_BUCKET)
      .download(candidate.fileName);

    if (!error && data) {
      return {
        buffer: Buffer.from(await data.arrayBuffer()),
        fileName: candidate.fileName,
        contentType: candidate.contentType,
      };
    }
  }

  throw new Error('Could not retrieve certificate file from storage.');
}

export async function sendReachCertificateEmailAction(certificateId: string) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();

  try {
    const { cert, settings, recipients, attachment, chemicalName } =
      await fetchReachCertificateMailContext(certificateId);

    await sendCertEmail({
      to: recipients.to,
      cc: recipients.cc,
      bcc: recipients.bcc,
      subject: `REACH Compliance Certificate Issued — ${cert.certificate_number}`,
      certificateNumber: cert.certificate_number,
      companyName: cert.clients.company_name,
      chemicalName,
      pdfBuffer: attachment.buffer,
      pdfFileName: attachment.fileName,
      attachmentContentType: attachment.contentType,
      smtpConfig: settings || undefined,
      certificateType: 'REACH',
    });

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
      action: 'REACH_CERTIFICATE_EMAIL_SENT',
      entity_type: 'certificates',
      entity_id: certificateId,
      description: `RC certificate email sent to ${recipients.to}`,
    });

    revalidatePath(`/admin/clients/${cert.client_id}/rc-certificates`);
    revalidatePath(`/admin/clients/${cert.client_id}/rc-preview/${cert.chemical_id}`);

    return {
      success: true,
      message: `Certificate email sent to ${recipients.to}`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[SEND REACH CERT EMAIL ERROR]:', err);
    return { success: false, error: message };
  }
}

export async function resendReachCertificateEmailAction(certificateId: string) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();

  try {
    const { cert, settings, recipients, attachment, chemicalName } =
      await fetchReachCertificateMailContext(certificateId);

    if (!cert.mail_sent) {
      return { success: false, error: 'Certificate has not been sent yet. Use Send Mail first.' };
    }

    await sendCertEmail({
      to: recipients.to,
      cc: recipients.cc,
      bcc: recipients.bcc,
      subject: `REACH Compliance Certificate (Resent) — ${cert.certificate_number}`,
      certificateNumber: cert.certificate_number,
      companyName: cert.clients.company_name,
      chemicalName,
      pdfBuffer: attachment.buffer,
      pdfFileName: attachment.fileName,
      attachmentContentType: attachment.contentType,
      smtpConfig: settings || undefined,
      certificateType: 'REACH',
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
      action: 'REACH_CERTIFICATE_EMAIL_RESENT',
      entity_type: 'certificates',
      entity_id: certificateId,
      description: `RC certificate email resent (${(cert.mail_resend_count || 0) + 1}x)`,
    });

    revalidatePath(`/admin/clients/${cert.client_id}/rc-certificates`);
    revalidatePath(`/admin/clients/${cert.client_id}/rc-preview/${cert.chemical_id}`);

    return { success: true, message: 'Certificate email resent successfully.' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
