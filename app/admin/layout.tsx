import Sidebar from '@/components/Sidebar';
import TopNavbar from '@/components/TopNavbar';
import { getSession } from '@/lib/auth/session';
import { redirectToLoginPage, redirectToRoleHome } from '@/lib/auth/redirects';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirectToLoginPage('SessionExpired', '/admin');
  }

  if (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirectToRoleHome(session.role);
  }

  const adminSupabase = createAdminClient();
  const [{ count: notificationCount }, { data: notifications }] = await Promise.all([
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50" suppressHydrationWarning>
      <Sidebar role={session.role} />
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <TopNavbar
          userEmail={session.email}
          role={session.role}
          notificationCount={notificationCount || 0}
          notifications={(notifications || []) as any}
        />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
