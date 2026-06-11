import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { REACH_CERTIFICATE_TYPE } from '@/lib/reach-certificate';
import RcCertificatesDashboard from '@/components/RcCertificatesDashboard';

export const revalidate = 0;

export default async function AdminRcCertificatesPage() {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  const adminSupabase = createAdminClient();

  const { data: certificates, error } = await adminSupabase
    .from('certificates')
    .select(`
      id,
      client_id,
      chemical_id,
      certificate_number,
      registration_number,
      issued_at,
      expires_at,
      status,
      mail_sent,
      mail_sent_at,
      clients (
        id,
        company_name,
        email,
        uuid_number
      ),
      chemicals (
        chemical_name,
        cas_number,
        ec_number,
        tonnage_band
      )
    `)
    .eq('type', REACH_CERTIFICATE_TYPE)
    .order('issued_at', { ascending: false });

  if (error) {
    console.error('[RC CERTIFICATES PAGE]', error);
  }

  const normalized = (certificates || []).map((row) => ({
    ...row,
    clients: Array.isArray(row.clients) ? row.clients[0] : row.clients,
    chemicals: Array.isArray(row.chemicals) ? row.chemicals[0] : row.chemicals,
  }));

  return <RcCertificatesDashboard initialCertificates={normalized as never} />;
}
