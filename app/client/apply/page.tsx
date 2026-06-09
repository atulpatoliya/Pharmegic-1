import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import TccApplicationForm from '@/components/TccApplicationForm';
import { redirect } from 'next/navigation';

export const revalidate = 0;

import { getRemainingQuota, sumApprovedExports } from '@/lib/quota';

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

  const [{ data: mappings }, { data: approvedTccs }] = await Promise.all([
    adminSupabase
      .from('client_chemicals')
      .select('chemical_id, available_quantity, validity_date, chemicals(*)')
      .eq('client_id', clientId)
      .eq('status', 'active'),
    adminSupabase
      .from('tcc_applications')
      .select('chemical_id, quantity_mt, status, export_date, updated_at, created_at, certificates(issued_at)')
      .eq('client_id', clientId)
      .eq('status', 'approved'),
  ]);

  const authorizedSubstances = (mappings || [])
    .map((m: { chemical_id: string; available_quantity?: number; validity_date?: string | null; chemicals?: unknown }) => {
      const chem = Array.isArray(m.chemicals) ? m.chemicals[0] : m.chemicals;
      if (!chem || (chem as { status?: string }).status !== 'active') return null;
      const tonnageBand = (chem as { tonnage_band?: string | null }).tonnage_band ?? null;
      const exported = sumApprovedExports(approvedTccs || [], m.chemical_id);
      return {
        ...chem,
        id: m.chemical_id,
        available_quantity: getRemainingQuota(Number(m.available_quantity ?? 0), exported, tonnageBand),
        validity_date: m.validity_date ?? (chem as { validity_date?: string | null }).validity_date ?? null,
      };
    })
    .filter(Boolean);

  return <TccApplicationForm authorizedSubstances={authorizedSubstances as any} />;
}
