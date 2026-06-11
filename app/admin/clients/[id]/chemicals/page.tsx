import { redirect } from 'next/navigation';
import ClientDashboardDetails from '../ClientDashboardDetails';
import { loadClientProfileData } from '../load-client-data';

export const revalidate = 0;

export default async function ClientChemicalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadClientProfileData(id);
  const { session, ...profile } = data;

  if (session.role === 'MASTER_ADMIN') {
    redirect(`/admin/clients/${id}`);
  }

  return (
    <ClientDashboardDetails
      {...profile}
      currentUserId={session.userId}
      currentUserRole={session.role}
      viewMode="chemicals"
    />
  );
}
