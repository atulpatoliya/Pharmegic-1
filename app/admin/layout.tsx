import Sidebar from '@/components/Sidebar';
import TopNavbar from '@/components/TopNavbar';
import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirect('/login?error=Unauthorized');
  }

  // Count unread notifications (admin-level — by user id)
  const adminSupabase = createAdminClient();
  const { count: notificationCount } = await adminSupabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.userId)
    .eq('read', false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50" suppressHydrationWarning>
      <Sidebar role={session.role} />
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
