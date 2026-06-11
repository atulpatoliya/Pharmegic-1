import { createAdminClient } from '@/lib/supabase/admin';
import { getTccApplications } from '@/services/db';
import ApprovalsDashboard from '@/components/ApprovalsDashboard';

export const revalidate = 0; // Live updates for admin approvals

export default async function ApprovalsPage() {
  const supabase = createAdminClient();

  const [applications, { data: adminSettings }] = await Promise.all([
    getTccApplications(supabase, 'all'),
    supabase.from('admin_settings').select('cc_emails, bcc_emails').eq('id', 1).maybeSingle(),
  ]);

  return (
    <ApprovalsDashboard
      initialApplications={applications as any}
      emailDefaults={{
        adminCcEmails: adminSettings?.cc_emails ?? null,
        adminBccEmails: adminSettings?.bcc_emails ?? null,
      }}
    />
  );
}
