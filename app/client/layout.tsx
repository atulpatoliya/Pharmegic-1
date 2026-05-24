import Sidebar from '@/components/Sidebar';
import TopNavbar from '@/components/TopNavbar';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = user.user_metadata?.role;
  if (role !== 'CLIENT') {
    redirect('/login?error=Unauthorized');
  }

  const clientId = user.user_metadata?.client_id;
  let companyName = 'Partner Client';

  // Fetch client details and notifications count in parallel
  const [clientRes, notificationsRes] = await Promise.all([
    clientId
      ? supabase.from('clients').select('company_name').eq('id', clientId).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
  ]);

  if (clientRes.data) {
    companyName = clientRes.data.company_name;
  }
  const notificationCount = notificationsRes.count;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Sidebar Navigation */}
      <Sidebar role={role} companyName={companyName} />

      {/* Primary Workspace */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Header toolbar */}
        <TopNavbar
          userEmail={user.email || 'officer@client.com'}
          role={role}
          notificationCount={notificationCount || 0}
        />

        {/* Dynamic content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
