import Sidebar from '@/components/Sidebar';
import TopNavbar from '@/components/TopNavbar';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
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
  if (role !== 'MASTER_ADMIN' && role !== 'STAFF') {
    redirect('/login?error=Unauthorized');
  }

  // Self-healing database user profile:
  // If the admin deleted all data in public.users but their auth.users account still exists,
  // we automatically re-insert them into the public.users database table to restore RLS policies access.
  const { data: dbProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!dbProfile) {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminSupabase = createAdminClient();
    await adminSupabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email,
        role: role,
      });
  }

  // Count pending notifications (or general mock notification count if not configured)
  const { count: notificationCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Sidebar Navigation */}
      <Sidebar role={role} />

      {/* Primary Workspace */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Header toolbar */}
        <TopNavbar
          userEmail={user.email || 'directoratulpatoliya@gmail.com'}
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
