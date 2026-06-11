import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export async function loadClientProfileData(clientId: string) {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  const adminSupabase = createAdminClient();

  const { data: client, error: clientError } = await adminSupabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError || !client) {
    redirect('/admin/clients');
  }

  const [
    { data: user },
    { data: clientChemicals },
    { data: allChemicals },
    { data: contacts },
    { data: tccHistoryRaw },
    { data: certificates },
    { data: activityLogs },
    { data: internalNotesData },
    { data: adminSettings },
  ] = await Promise.all([
    adminSupabase.from('users').select('*').eq('client_id', clientId).maybeSingle(),
    adminSupabase.from('client_chemicals').select('*, chemicals(*)').eq('client_id', clientId),
    adminSupabase.from('chemicals').select('*').eq('status', 'active').order('chemical_name', { ascending: true }),
    adminSupabase.from('client_contacts').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    adminSupabase
      .from('tcc_applications')
      .select('*, chemicals(*), certificates(*), client_chemicals(available_quantity)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    adminSupabase
      .from('certificates')
      .select('*, chemicals(chemical_name, cas_number, ec_number, tonnage_band), tcc_applications(*, chemicals(*))')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    adminSupabase.from('activity_logs').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    adminSupabase
      .from('internal_notes')
      .select('*, users!internal_notes_author_id_fkey(email)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    adminSupabase.from('admin_settings').select('smtp_from, smtp_cc_default').eq('id', 1).maybeSingle(),
  ]);

  const tccHistory = (tccHistoryRaw || []).map((row: { chemicals?: unknown; certificates?: unknown; client_chemicals?: unknown }) => ({
    ...row,
    chemicals: Array.isArray(row.chemicals) ? row.chemicals[0] : row.chemicals,
    certificates: Array.isArray(row.certificates) ? row.certificates[0] ?? null : row.certificates,
    client_chemicals: Array.isArray(row.client_chemicals) ? row.client_chemicals[0] ?? null : row.client_chemicals,
  }));

  const internalNotes = (internalNotesData || []).map((note: { id: string; note: string; created_at: string; users?: { email?: string } | null }) => ({
    id: note.id,
    note: note.note,
    created_at: note.created_at,
    author_email: note.users?.email || 'System',
  }));

  const normalizedCertificates = (certificates || []).map((row: { chemicals?: unknown; tcc_applications?: unknown }) => ({
    ...row,
    chemicals: Array.isArray(row.chemicals) ? row.chemicals[0] : row.chemicals,
    tcc_applications: Array.isArray(row.tcc_applications)
      ? row.tcc_applications[0] ?? null
      : row.tcc_applications,
  }));

  const normalizedClientChemicals = (clientChemicals || []).map((row: { chemicals?: unknown }) => ({
    ...row,
    chemicals: Array.isArray(row.chemicals) ? row.chemicals[0] : row.chemicals,
  }));

  return {
    session,
    client,
    user,
    clientChemicals: normalizedClientChemicals,
    allChemicals: allChemicals || [],
    contacts: contacts || [],
    tccHistory,
    certificates: normalizedCertificates,
    activityLogs: activityLogs || [],
    internalNotes,
    emailDefaults: {
      defaultCcEmails: adminSettings?.smtp_cc_default ?? null,
      senderEmail: adminSettings?.smtp_from ?? null,
      contactEmails: (contacts || [])
        .map((c: { email?: string }) => c.email)
        .filter((email): email is string => Boolean(email)),
    },
  };
}

export type ClientProfileViewMode = 'overview' | 'chemicals' | 'certificates' | 'rc-certificates';
