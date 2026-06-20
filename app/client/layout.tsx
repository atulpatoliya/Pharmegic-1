import { Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import { getSession } from '@/lib/auth/session';
import { redirectToLoginPage, redirectToRoleHome } from '@/lib/auth/redirects';
import { createAdminClient } from '@/lib/supabase/admin';
import { ClientTopBar } from '@/components/layout/ClientTopBar';
import { TopNavbarSkeleton } from '@/components/layout/TopNavbarSkeleton';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirectToLoginPage(undefined, '/client');
  }
  if (session.role !== 'CLIENT') {
    redirectToRoleHome(session.role);
  }

  let companyName = 'Partner Client';
  if (session.clientId) {
    const adminSupabase = createAdminClient();
    const { data } = await adminSupabase
      .from('clients')
      .select('company_name')
      .eq('id', session.clientId)
      .single();
    if (data?.company_name) companyName = data.company_name;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50" suppressHydrationWarning>
      <Sidebar role={session.role} companyName={companyName} />
      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        <Suspense fallback={<TopNavbarSkeleton />}>
          <ClientTopBar session={session} />
        </Suspense>
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
