import { createClient } from '@/lib/supabase/server';
import TccApplicationForm from '@/components/TccApplicationForm';
import { redirect } from 'next/navigation';

export const revalidate = 0; // Fresh substances quota mapping

export default async function ApplyPage() {
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

  // Fetch authorized chemicals for this client
  const { data: mappings } = await supabase
    .from('client_chemicals')
    .select('chemical_id, chemicals (*)')
    .eq('client_id', clientId);

  // Filter only active substances
  const authorizedSubstances = (mappings || [])
    .map((m: any) => m.chemicals)
    .filter((chem: any) => chem && chem.status === 'active');

  return (
    <TccApplicationForm
      authorizedSubstances={authorizedSubstances as any}
    />
  );
}
