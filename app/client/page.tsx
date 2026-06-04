import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import ClientDashboard from '@/components/ClientDashboard';
import { redirect } from 'next/navigation';

export const revalidate = 0;

export default async function ClientDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== 'CLIENT') redirect('/login');

  const clientId = session.clientId;
  if (!clientId) {
    return (
      <div className="py-12 text-center text-sm font-semibold text-slate-400">
        Your user account is not linked to a registered client organization. Please contact your system administrator.
      </div>
    );
  }

  const adminSupabase = createAdminClient();

  const [statsRes, substancesRes, certsRes, notifRes] = await Promise.all([
    adminSupabase
      .from('tcc_applications')
      .select('status', { count: 'exact' })
      .eq('client_id', clientId),
    adminSupabase
      .from('client_chemicals')
      .select('*, chemicals(*)')
      .eq('client_id', clientId)
      .eq('status', 'active'),
    adminSupabase
      .from('certificates')
      .select('*, tcc_applications(quantity_mt, chemicals(chemical_name, cas_number))')
      .eq('client_id', clientId)
      .order('issued_at', { ascending: false })
      .limit(10),
    adminSupabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const substances = substancesRes.data || [];
  const activePermissions = substances.length;
  const remainingQuota = substances.reduce((sum, item) => sum + Number(item.available_quantity || 0), 0);

  // Get total exported from approved applications
  const { data: approvedApps } = await adminSupabase
    .from('tcc_applications')
    .select('quantity_mt')
    .eq('client_id', clientId)
    .eq('status', 'approved');

  const totalExported = (approvedApps || []).reduce((sum, item) => sum + Number(item.quantity_mt || 0), 0);

  const stats = {
    activePermissions,
    totalExported,
    remainingQuota
  };

  return (
    <ClientDashboard
      stats={stats}
      authorizedSubstances={(substancesRes.data || []) as any}
      certificates={(certsRes.data || []) as any}
      notifications={(notifRes.data || []) as any}
    />
  );

}
