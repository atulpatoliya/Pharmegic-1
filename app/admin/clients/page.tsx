import { createAdminClient } from '@/lib/supabase/admin';
import { getClients, getChemicals } from '@/services/db';
import ClientsDashboard from '@/components/ClientsDashboard';

export const revalidate = 0;

export default async function ClientsPage() {
  const supabase = createAdminClient();

  // Load initial clients (limit 1000 for full visibility in registry)
  const { clients } = await getClients(supabase, '', 'all', 1000, 0);

  // Load active chemicals for substance allocation
  const chemicals = await getChemicals(supabase, '', 'active');

  return (
    <ClientsDashboard
      initialClients={clients as any}
      chemicals={chemicals as any}
    />
  );
}

