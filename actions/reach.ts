'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { generateReachCertificatePdf } from '@/services/pdf';
import { CERTIFICATES_BUCKET, ensureCertificatesBucket } from '@/lib/storage';
import { revalidatePath } from 'next/cache';
import { notifyUser } from '@/lib/notifications';
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

  const { data: branding } = await adminSupabase.from('templates').select('*').limit(1).maybeSingle();

  const issueDate = new Date(issuedDate);
  const expiryDate = new Date(validatedDate);
  const randStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const certNumber = `RC-${issueDate.getFullYear()}-${randStr}`;

  const pdfBuffer = await generateReachCertificatePdf({
    certificateNumber: certNumber,
    registrationNumber: registrationNumber.trim(),
    companyName: client.company_name,
    companyAddress: [client.address, client.city, client.state, client.postal_code, client.country]
      .filter(Boolean)
      .join(', '),
    uuidNumber: client.uuid_number || '',
    chemicalName: chemical.chemical_name,
    casNumber: chemical.cas_number,
    ecNumber: chemical.ec_number || '',
    tonnageBand: chemical.tonnage_band || 'N/A',
    issueDate: issuedDate,
    expiryDate: validatedDate,
    logoUrl: branding?.logo || null,
    signatureUrl: branding?.signature_image || null,
    footerText: branding?.footer_text || null,
    accentColor: branding?.accent_color || '#064e3b',
  });

  await ensureCertificatesBucket(adminSupabase);
  const fileName = `${certNumber}.pdf`;
  const { error: uploadError } = await adminSupabase.storage
    .from(CERTIFICATES_BUCKET)
    .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true });

  if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = adminSupabase.storage.from(CERTIFICATES_BUCKET).getPublicUrl(fileName);

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
