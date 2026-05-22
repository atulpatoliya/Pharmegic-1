import { createClient } from '@/lib/supabase/server';
import { getClients, getChemicals } from '@/services/db';
import ClientsDashboard from '@/components/ClientsDashboard';

export const revalidate = 0; // Ensure live data on reload

export default async function ClientsPage() {
  const supabase = await createClient();
  
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
