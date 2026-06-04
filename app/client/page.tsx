import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import ClientDashboardDetails from '@/app/admin/clients/[id]/ClientDashboardDetails';
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

  // 1. Fetch client profile
  const { data: client, error: clientError } = await adminSupabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError || !client) {
    return <div className="py-12 text-center text-sm font-semibold text-slate-400">Client profile not found.</div>;
  }

  // 2. Fetch linked user login profile
  const { data: user } = await adminSupabase
    .from('users')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();

  // 3. Fetch client assigned chemicals mapping
  const { data: clientChemicals } = await adminSupabase
    .from('client_chemicals')
    .select('*, chemicals(*)')
    .eq('client_id', clientId);

  // 4. Fetch all chemicals (we don't need this for client, but component expects array)
  const { data: allChemicals } = await adminSupabase
    .from('chemicals')
    .select('*')
    .eq('status', 'active')
    .order('chemical_name', { ascending: true });

  // 5. Fetch contacts
  const { data: contacts } = await adminSupabase
    .from('client_contacts')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  // 6. Fetch TCC Application history
  const { data: tccHistory } = await adminSupabase
    .from('tcc_applications')
    .select('*, chemicals(*), certificates(*)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  // 7. Fetch Certificates
  const { data: certificates } = await adminSupabase
    .from('certificates')
    .select('*, tcc_applications(*, chemicals(*))')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  // 8. Fetch Client Activity logs
  const { data: activityLogs } = await adminSupabase
    .from('activity_logs')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  return (
    <ClientDashboardDetails
      client={client}
      user={user}
      clientChemicals={clientChemicals || []}
      allChemicals={allChemicals || []}
      contacts={contacts || []}
      tccHistory={tccHistory || []}
      certificates={certificates || []}
      activityLogs={activityLogs || []}
      internalNotes={[]}
      currentUserId={session.userId}
      currentUserRole={session.role}
    />
  );
}
