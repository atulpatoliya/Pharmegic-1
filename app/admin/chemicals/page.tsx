import { createAdminClient } from '@/lib/supabase/admin';
import { getChemicals } from '@/services/db';
import ChemicalsDashboard from '@/components/ChemicalsDashboard';

export const revalidate = 0; // Disable server caching for live inventory

export default async function ChemicalsPage() {
  const supabase = createAdminClient();
  
  // Load all chemical substances (active and inactive)
  const chemicals = await getChemicals(supabase, '', 'all');

  return <ChemicalsDashboard initialChemicals={chemicals as any} />;
}
