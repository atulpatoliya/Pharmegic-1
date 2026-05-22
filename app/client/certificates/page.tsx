import { createClient } from '@/lib/supabase/server';
import CertificatesList from '@/components/CertificatesList';
import { redirect } from 'next/navigation';

export const revalidate = 0; // Live compliance records refresh

export default async function CertificatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const clientId = user.user_metadata?.client_id;
  if (!clientId) {
    return (
      <div className="py-12 text-center text-sm font-semibold text-slate-400">
        Your user account is not linked to a registered client organization.
      </div>
    );
  }

  // Fetch certificates for the logged-in client
  const { data: certificates } = await supabase
    .from('certificates')
    .select('*, tcc_applications (quantity_mt, chemicals (chemical_name, cas_number))')
    .eq('client_id', clientId)
    .order('issued_at', { ascending: false });

  return (
    <CertificatesList
      initialCertificates={(certificates || []) as any}
    />
  );
}
