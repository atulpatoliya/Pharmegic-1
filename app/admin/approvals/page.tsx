import { createAdminClient } from '@/lib/supabase/admin';
import { getTccApplications } from '@/services/db';
import { purgeNotificationOnlyTccApplications } from '@/actions/tcc';
import ApprovalsDashboard from '@/components/ApprovalsDashboard';

export const revalidate = 0; // Live updates for admin approvals

export default async function ApprovalsPage() {
  await purgeNotificationOnlyTccApplications();

  const supabase = createAdminClient();

  const [applications, { data: adminSettings }] = await Promise.all([
    getTccApplications(supabase, 'all', { euReachOnly: true }),
    supabase.from('admin_settings').select('smtp_from, smtp_cc_default').eq('id', 1).maybeSingle(),
  ]);

  return (
    <ApprovalsDashboard
      initialApplications={applications as any}
      emailDefaults={{
        defaultCcEmails: adminSettings?.smtp_cc_default ?? null,
        senderEmail: adminSettings?.smtp_from ?? null,
      }}
    />
  );
}
