import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import TccApplicationForm from '@/components/TccApplicationForm';
import { redirect } from 'next/navigation';

export const revalidate = 0;

import { getRemainingQuota, sumApprovedExports } from '@/lib/quota';
import {
  isActiveReachCertificate,
  mapLatestReachByChemical,
  REACH_CERTIFICATE_TYPE,
  getReachCertificateStatus,
} from '@/lib/reach-certificate';
import { canClientEditTccApplication } from '@/lib/tcc-application';

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== 'CLIENT') redirect('/login');

  const clientId = session.clientId;
  if (!clientId) {
    return (
      <div className="py-12 text-center text-sm font-semibold text-slate-400">
        Your user account is not linked to a registered client organization.
      </div>
    );
  }

  const { edit: editId } = await searchParams;
  const adminSupabase = createAdminClient();

  const [{ data: mappings }, { data: approvedTccs }, { data: reachCerts }] =
    await Promise.all([
      adminSupabase
        .from('client_chemicals')
        .select('chemical_id, available_quantity, validity_date, chemicals(*)')
        .eq('client_id', clientId)
        .eq('status', 'active'),
      adminSupabase
        .from('tcc_applications')
        .select('chemical_id, quantity_mt, status, export_date, updated_at, created_at, certificates(issued_at)')
        .eq('client_id', clientId)
        .eq('status', 'approved'),
      adminSupabase
        .from('certificates')
        .select('id, chemical_id, certificate_number, issued_at, expires_at, status, type, file_url')
        .eq('client_id', clientId)
        .eq('type', REACH_CERTIFICATE_TYPE)
        .order('issued_at', { ascending: false }),
    ]);

  let editApplication = null;
  if (editId) {
    const { data: existingApp } = await adminSupabase
      .from('tcc_applications')
      .select(
        'id, chemical_id, quantity_mt, export_date, eu_importer_company_name, eu_importer_address, purchase_order_number, invoice_number, bo_attachment_url, bo_attachment_name, status'
      )
      .eq('id', editId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (existingApp && canClientEditTccApplication(existingApp.status)) {
      editApplication = existingApp;
    }
  }

  const reachByChemical = mapLatestReachByChemical(reachCerts || []);

  const authorizedSubstances = (mappings || [])
    .map((m: { chemical_id: string; available_quantity?: number; validity_date?: string | null; chemicals?: unknown }) => {
      const chem = Array.isArray(m.chemicals) ? m.chemicals[0] : m.chemicals;
      if (!chem || (chem as { status?: string }).status !== 'active') return null;
      const tonnageBand = (chem as { tonnage_band?: string | null }).tonnage_band ?? null;
      const exported = sumApprovedExports(approvedTccs || [], m.chemical_id);
      const reachCert = reachByChemical.get(m.chemical_id) ?? null;
      const reachStatus = getReachCertificateStatus(reachCert);
      const hasValidReach = isActiveReachCertificate(reachCert);
      return {
        ...chem,
        id: m.chemical_id,
        available_quantity: getRemainingQuota(Number(m.available_quantity ?? 0), exported, tonnageBand),
        validity_date: m.validity_date ?? (chem as { validity_date?: string | null }).validity_date ?? null,
        reach_certificate: reachCert
          ? {
              id: reachCert.id,
              certificate_number: reachCert.certificate_number,
              expires_at: reachCert.expires_at,
              file_url: reachCert.file_url,
              status: reachStatus,
            }
          : null,
        has_valid_reach: hasValidReach,
      };
    })
    .filter(Boolean);

  return (
    <TccApplicationForm
      authorizedSubstances={authorizedSubstances as any}
      editApplication={editApplication}
    />
  );
}
