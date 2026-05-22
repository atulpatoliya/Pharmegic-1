import { createClient } from '@/lib/supabase/server';
import { getClientDashboardStats } from '@/services/db';
import ClientDashboard from '@/components/ClientDashboard';
import { redirect } from 'next/navigation';

export const revalidate = 0; // Disable server caching for client feeds

export default async function ClientDashboardPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  const clientId = user.user_metadata?.client_id;
  if (!clientId) {
    return (
      <div className="py-12 text-center text-sm font-semibold text-slate-400">
        Your user account is not linked to a registered client organization. Please contact your system administrator.
      </div>
    );
  }

  const { stats, authorizedSubstances, certificates, notifications } = 
    await getClientDashboardStats(supabase, clientId);

  return (
    <ClientDashboard
      stats={stats}
      authorizedSubstances={authorizedSubstances as any}
      certificates={certificates as any}
      notifications={notifications as any}
    />
  );
}
