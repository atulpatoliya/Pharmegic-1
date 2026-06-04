import { createAdminClient } from '@/lib/supabase/admin';
import { getChemicals, getTrashedChemicals } from '@/services/db';
import ChemicalsDashboard from '@/components/ChemicalsDashboard';

export const revalidate = 0; // Disable server caching for live inventory

export default async function ChemicalsPage() {
  const supabase = createAdminClient();
  
  const [chemicals, trashedChemicals] = await Promise.all([
    getChemicals(supabase, '', 'all'),
    getTrashedChemicals(supabase),
  ]);

  return (
    <ChemicalsDashboard
      initialChemicals={chemicals as any}
      initialTrashedChemicals={trashedChemicals as any}
    />
  );
}
