import Sidebar from '@/components/Sidebar';
import TopNavbar from '@/components/TopNavbar';
import { getSession } from '@/lib/auth/session';
import { redirectToLoginPage, redirectToRoleHome } from '@/lib/auth/redirects';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirectToLoginPage(undefined, '/client');
  }
  if (session.role !== 'CLIENT') {
    redirectToRoleHome(session.role);
  }

  const adminSupabase = createAdminClient();
  let companyName = 'Partner Client';

  const [clientRes, notificationsCountRes, notificationsListRes] = await Promise.all([
    session.clientId
      ? adminSupabase.from('clients').select('company_name').eq('id', session.clientId).single()
      : Promise.resolve({ data: null }),
    adminSupabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId)
      .eq('read', false),
    adminSupabase
      .from('notifications')
      .select('id, title, message, read, created_at')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  if (clientRes.data) companyName = clientRes.data.company_name;
  const notificationCount = notificationsCountRes.count;
  const notifications = notificationsListRes.data || [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50" suppressHydrationWarning>
      <Sidebar role={session.role} companyName={companyName} />
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <TopNavbar
          userEmail={session.email}
          role={session.role}
          notificationCount={notificationCount || 0}
          notifications={notifications as any}
        />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
