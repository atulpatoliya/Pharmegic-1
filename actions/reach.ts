'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { generateReachCertificatePdf } from '@/services/pdf';
import { CERTIFICATES_BUCKET, ensureCertificatesBucket } from '@/lib/storage';
import { revalidatePath } from 'next/cache';
import { notifyUser } from '@/lib/notifications';
import {
  REACH_CERTIFICATE_TYPE,
  addOneYear,
  isActiveReachCertificate,
} from '@/lib/reach-certificate';

async function requireAdmin() {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return null;
  }
  return session;
}

// ============================================================================
// ISSUE REACH COMPLIANCE CERTIFICATE (Admin — per client + chemical, 1 year)
// ============================================================================
export async function issueReachCertificateAction(clientId: string, chemicalId: string) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();

  try {
    const [{ data: client }, { data: clientChem }, { data: chemical }] = await Promise.all([
      adminSupabase.from('clients').select('id, company_name, email').eq('id', clientId).single(),
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

    if (!client) return { success: false, error: 'Client not found.' };
    if (!clientChem) {
      return {
        success: false,
        error: 'This substance is not actively assigned to the client. Assign it first.',
      };
    }
    if (!chemical) return { success: false, error: 'Chemical not found.' };

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
        success: false,
        error: `An active REACH Compliance Certificate already exists for ${chemical.chemical_name}. Renew after it expires.`,
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

    const issueDate = new Date();
    const expiryDate = addOneYear(issueDate);
    const randStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const certNumber = `REACH-${issueDate.getFullYear()}-${randStr}`;

    const pdfBuffer = await generateReachCertificatePdf({
      certificateNumber: certNumber,
      companyName: client.company_name,
      chemicalName: chemical.chemical_name,
      casNumber: chemical.cas_number,
      ecNumber: chemical.ec_number || '',
      tonnageBand: chemical.tonnage_band || 'N/A',
      issueDate: issueDate.toISOString().split('T')[0],
      expiryDate: expiryDate.toISOString().split('T')[0],
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
      user_id: session.userId,
      action: 'REACH_CERTIFICATE_ISSUED',
      entity_type: 'certificates',
      entity_id: cert.id,
      description: `REACH Compliance Certificate ${certNumber} issued for ${chemical.chemical_name}`,
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
        'REACH Compliance Certificate Issued',
        `Your REACH certificate ${certNumber} for ${chemical.chemical_name} is valid until ${expiryDate.toLocaleDateString()}. You may now apply for TCC permits for this substance.`
      );
    }

    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath('/client');
    return {
      success: true,
      message: `REACH Compliance Certificate issued for ${chemical.chemical_name}. Valid for 1 year.`,
      certificateId: cert.id,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
