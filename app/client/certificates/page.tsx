import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import CertificatesList from '@/components/CertificatesList';
import { redirect } from 'next/navigation';

export const revalidate = 0;

export default async function CertificatesPage() {
  const session = await getSession();
  if (!session || session.role !== 'CLIENT') redirect('/login');

  const clientId = session.clientId;
  if (!clientId) {
    return (
      <div className="py-12 text-center text-sm font-semibold text-slate-400">
        Your user account is not linked to a registered client organization.
      </div>
    );
  }

  const adminSupabase = createAdminClient();
  const { data: certificates } = await adminSupabase
    .from('certificates')
    .select('*, tcc_applications(quantity_mt, chemicals(chemical_name, cas_number))')
    .eq('client_id', clientId)
    .order('issued_at', { ascending: false });

  return <CertificatesList initialCertificates={(certificates || []) as any} />;
}
