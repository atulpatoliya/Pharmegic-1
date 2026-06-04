import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminDashboardStats } from '@/services/db';
import AdminDashboard from '@/components/AdminDashboard';

export const revalidate = 0; // Disable server caching for live dashboard feeds

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();
  const { stats, chartData } = await getAdminDashboardStats(supabase);

  return <AdminDashboard stats={stats} chartData={chartData} />;
}
