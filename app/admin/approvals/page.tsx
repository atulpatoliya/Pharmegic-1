import { createClient } from '@/lib/supabase/server';
import { getTccApplications } from '@/services/db';
import ApprovalsDashboard from '@/components/ApprovalsDashboard';

export const revalidate = 0; // Live updates for admin approvals

export default async function ApprovalsPage() {
  const supabase = await createClient();
  
  // Fetch all applications
  const applications = await getTccApplications(supabase, 'all');

  return <ApprovalsDashboard initialApplications={applications as any} />;
}
