import { createAdminClient } from '@/lib/supabase/admin';
import { getClients, getChemicals, getActiveSubstanceCountsByClient } from '@/services/db';
import { getSession } from '@/lib/auth/session';
import ClientsDashboard from '@/components/ClientsDashboard';

export const revalidate = 0;

export default async function ClientsPage() {
  const supabase = createAdminClient();
  const session = await getSession();

  // Load initial clients (limit 1000 for full visibility in registry)
  const { clients } = await getClients(supabase, '', 'all', 1000, 0);
  const substanceCounts = await getActiveSubstanceCountsByClient(
    supabase,
    clients.map((client) => client.id)
  );
  const clientsWithSubstanceCounts = clients.map((client) => ({
    ...client,
    substance_count: substanceCounts[client.id] || 0,
  }));

  // Load active chemicals for substance allocation
  const chemicals = await getChemicals(supabase, '', 'active');

  return (
    <ClientsDashboard
      initialClients={clientsWithSubstanceCounts as any}
      chemicals={chemicals as any}
      adminRole={session?.role ?? null}
    />
  );
}

