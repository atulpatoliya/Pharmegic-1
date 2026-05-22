import { createClient } from '@/lib/supabase/server';
import { getActiveTemplate } from '@/services/db';
import BrandingDashboard from '@/components/BrandingDashboard';
import { redirect } from 'next/navigation';

export const revalidate = 0; // Live templates reload

export default async function BrandingPage() {
  const supabase = await createClient();
  const template = await getActiveTemplate(supabase);

  if (!template) {
    // If somehow seed is missing, redirect or throw
    return (
      <div className="py-12 text-center text-sm font-semibold text-slate-400">
        Template database record could not be found. Please check database seeding status.
      </div>
    );
  }

  return <BrandingDashboard template={template as any} />;
}
