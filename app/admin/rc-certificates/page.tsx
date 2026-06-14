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
      allocated_quantity,
      tonnage_band,
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

  const { data: tccHistoryRaw, error: tccError } = await adminSupabase
    .from('tcc_applications')
    .select('*, chemicals(*), certificates(*), client_chemicals(available_quantity)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[RC CERTIFICATES PAGE]', error);
  }
  if (tccError) {
    console.error('[RC CERTIFICATES PAGE TCC HISTORY]', tccError);
  }

  const normalized = (certificates || []).map((row) => ({
    ...row,
    clients: Array.isArray(row.clients) ? row.clients[0] : row.clients,
    chemicals: Array.isArray(row.chemicals) ? row.chemicals[0] : row.chemicals,
  }));

  const tccHistory = (tccHistoryRaw || []).map((row: any) => ({
    ...row,
    chemicals: Array.isArray(row.chemicals) ? row.chemicals[0] : row.chemicals,
    certificates: Array.isArray(row.certificates) ? row.certificates[0] ?? null : row.certificates,
    client_chemicals: Array.isArray(row.client_chemicals) ? row.client_chemicals[0] ?? null : row.client_chemicals,
  }));

  return <RcCertificatesDashboard initialCertificates={normalized as never} tccHistory={tccHistory} />;
}
