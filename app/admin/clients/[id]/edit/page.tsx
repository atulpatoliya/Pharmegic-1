import { createAdminClient } from '@/lib/supabase/admin';
import { getChemicals } from '@/services/db';
import { redirect } from 'next/navigation';
import EditClientClient from './EditClientClient';

export const revalidate = 0;

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  
  // 1. Fetch client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();

  if (clientError || !client) {
    redirect('/admin/clients');
  }

  // 2. Fetch chemicals
  const chemicals = await getChemicals(supabase, '', 'active');

  // 3. Fetch client chemicals mapping
  const { data: clientChemicals, error: chemError } = await supabase
    .from('client_chemicals')
    .select('chemical_id')
    .eq('client_id', id);

  const initialChemicalIds = clientChemicals ? clientChemicals.map(c => c.chemical_id) : [];

  return (
    <div className="space-y-6 animate-slide-in">
       <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Edit Client: {client.company_name}</h1>
          <p className="text-sm text-slate-500 font-medium">Update company profile, contact details, and authorized substances.</p>
       </div>
       <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
           <EditClientClient 
             client={client as any} 
             chemicals={chemicals as any} 
             initialChemicalIds={initialChemicalIds} 
           />
       </div>
    </div>
  );
}