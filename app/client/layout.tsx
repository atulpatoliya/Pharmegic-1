import Sidebar from '@/components/Sidebar';
import TopNavbar from '@/components/TopNavbar';
import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/api/auth/clear?error=SessionExpired');
  }
  if (session.role !== 'CLIENT') {
    redirect('/api/auth/clear?error=Unauthorized');
  }

  const adminSupabase = createAdminClient();
  let companyName = 'Partner Client';

  const [clientRes, notificationsRes] = await Promise.all([
    session.clientId
      ? adminSupabase.from('clients').select('company_name').eq('id', session.clientId).single()
      : Promise.resolve({ data: null, count: null }),
    adminSupabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId)
      .eq('read', false),
  ]);

  if (clientRes.data) companyName = clientRes.data.company_name;
  const notificationCount = notificationsRes.count;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50" suppressHydrationWarning>
      <Sidebar role={session.role} companyName={companyName} />
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <TopNavbar
          userEmail={session.email}
          role={session.role}
          notificationCount={notificationCount || 0}
        />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
