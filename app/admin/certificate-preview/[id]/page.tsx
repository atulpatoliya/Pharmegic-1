import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import CertificatePreviewClient from '@/components/CertificatePreview';

export const revalidate = 0;

export default async function CertificatePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  const adminSupabase = createAdminClient();

  const { data: cert, error } = await adminSupabase
    .from('certificates')
    .select(`
      id,
      certificate_number,
      file_url,
      issued_at,
      expires_at,
      status,
      mail_sent,
      mail_sent_at,
      mail_resend_count,
      last_resend_at,
      clients (
        company_name,
        legal_name,
        email,
        registration_number
      ),
      tcc_applications (
        quantity_mt,
        kkdik_reg_no,
        export_date,
        chemicals (
          chemical_name,
          cas_number,
          ec_number,
          tonnage_band
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error || !cert) {
    redirect('/admin/approvals');
  }

  return <CertificatePreviewClient cert={cert as any} />;
}
