import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import TccApplicationForm from '@/components/TccApplicationForm';
import { redirect } from 'next/navigation';

export const revalidate = 0;

export default async function ApplyPage() {
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

  // Fetch only authorized + active chemicals for this client
  const { data: mappings } = await adminSupabase
    .from('client_chemicals')
    .select('chemical_id, available_quantity, validity_date, chemicals(*)')
    .eq('client_id', clientId)
    .eq('status', 'active');

  const authorizedSubstances = (mappings || [])
    .map((m: any) => ({ ...m.chemicals, authorized_quantity: m.available_quantity }))
    .filter((chem: any) => chem && chem.status === 'active');

  return <TccApplicationForm authorizedSubstances={authorizedSubstances as any} />;
}
