import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import ReachCertificatePreviewClient from '@/components/ReachCertificatePreviewClient';
import { REACH_CERTIFICATE_TYPE, getLastDateOfYear, getTodayDateString } from '@/lib/reach-certificate';
import { regenerateReachCertificateFile } from '@/actions/reach';
import { buildCertificateRecipients } from '@/lib/certificate-email-recipients';
import {
  loadCertificateMailSentHistory,
  REACH_MAIL_LOG_ACTIONS,
} from '@/lib/certificate-mail-history';

export const revalidate = 0;

export default async function ReachCertificatePreviewPage({
  params,
}: {
  params: Promise<{ id: string; chemicalId: string }>;
}) {
  const { id: clientId, chemicalId } = await params;
  const session = await getSession();

  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  const adminSupabase = createAdminClient();

  const [
    { data: client },
    { data: chemical },
    { data: clientChem },
    { data: cert },
    { data: contacts },
    { data: adminSettings },
  ] = await Promise.all([
      adminSupabase
        .from('clients')
        .select('id, company_name, email, uuid_number, address, city, state, postal_code, country')
        .eq('id', clientId)
        .single(),
      adminSupabase
        .from('chemicals')
        .select('id, chemical_name, cas_number, ec_number, tonnage_band')
        .eq('id', chemicalId)
        .single(),
      adminSupabase
        .from('client_chemicals')
        .select('id, validity_date, status')
        .eq('client_id', clientId)
        .eq('chemical_id', chemicalId)
        .eq('status', 'active')
        .maybeSingle(),
      adminSupabase
        .from('certificates')
        .select(
          'id, certificate_number, registration_number, issued_at, expires_at, status, file_url, type, mail_sent, mail_sent_at, mail_resend_count, last_resend_at, mail_sent_history'
        )
        .eq('client_id', clientId)
        .eq('chemical_id', chemicalId)
        .eq('type', REACH_CERTIFICATE_TYPE)
        .order('issued_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminSupabase
        .from('client_contacts')
        .select('email')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      adminSupabase
        .from('admin_settings')
        .select('rc_smtp_from, rc_smtp_cc_default')
        .eq('id', 1)
        .maybeSingle(),
    ]);

  if (!client || !chemical || !clientChem) {
    redirect(`/admin/clients/${clientId}/rc-certificates`);
  }

  if (cert) {
    await regenerateReachCertificateFile(cert.id);
  }

  const contactEmails = (contacts || []).map((c) => c.email).filter(Boolean);
  const mailSentHistory = cert
    ? await loadCertificateMailSentHistory(adminSupabase, cert.id, cert, REACH_MAIL_LOG_ACTIONS)
    : [];
  const mailRecipients = client.email
    ? buildCertificateRecipients({
        primaryEmail: client.email,
        contactEmails,
        defaultCcEmails: adminSettings?.rc_smtp_cc_default,
        senderEmail: adminSettings?.rc_smtp_from,
      })
    : null;

  const defaults = {
    registrationNumber: cert?.registration_number?.trim() || '',
    issuedDate: cert?.issued_at
      ? cert.issued_at.split('T')[0]
      : getTodayDateString(),
    validatedDate:
      cert?.expires_at?.split('T')[0] ||
      clientChem.validity_date?.split('T')[0] ||
      getLastDateOfYear(),
  };

  return (
    <ReachCertificatePreviewClient
      clientId={clientId}
      chemicalId={chemicalId}
      client={{
        company_name: client.company_name,
        email: client.email,
        uuid_number: client.uuid_number,
      }}
      chemical={{
        chemical_name: chemical.chemical_name,
        cas_number: chemical.cas_number,
        ec_number: chemical.ec_number,
        tonnage_band: chemical.tonnage_band,
      }}
      cert={cert ?? null}
      defaults={defaults}
      mailRecipients={mailRecipients}
      mailSentHistory={mailSentHistory}
    />
  );
}
