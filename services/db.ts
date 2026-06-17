import { SupabaseClient } from '@supabase/supabase-js';
import { computeTccQuotaForExportDate } from '@/lib/quota';
import { REACH_CERTIFICATE_TYPE, getReachCertificateYear } from '@/lib/reach-certificate';
import {
  REGULATORY_REGISTRATIONS,
  normalizeRegulatoryRegistrations,
} from '@/lib/regulatory-registrations';

// ============================================================================
// ADMIN DASHBOARD SERVICES
// ============================================================================
export async function getAdminDashboardStats(supabase: SupabaseClient) {
  // Run all 3 independent queries in parallel
  const [
    clientsRes,
    pendingTccRes,
    activeClientsRes,
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase
      .from('tcc_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .or('regulatory_framework.is.null,regulatory_framework.eq.eu_reach'),
    supabase
      .from('clients')
      .select('country, regulatory_registrations, status')
      .eq('status', 'active'),
  ]);

  const totalClients = clientsRes.count;
  const pendingTcc = pendingTccRes.count;
  const activeClients = activeClientsRes.data || [];
  const activeClientCount = activeClients.length || totalClients || 0;

  const reachStats = [
    {
      key: REGULATORY_REGISTRATIONS.EU_REACH,
      label: 'EU REACH',
      color: '#2563eb',
      bgColor: 'bg-sky-50',
      textColor: 'text-sky-600',
    },
    {
      key: REGULATORY_REGISTRATIONS.UK_REACH,
      label: 'UK REACH',
      color: '#059669',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
    {
      key: REGULATORY_REGISTRATIONS.TURKEY_KKDIK,
      label: 'Turkey REACH (KKDIK)',
      color: '#b45309',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
    },
  ].map((item) => {
    const clientsInReach = activeClients.filter((client) =>
      normalizeRegulatoryRegistrations(client.regulatory_registrations).includes(item.key)
    );
    const count = clientsInReach.length;
    const percent = activeClientCount > 0 ? Math.round((count / activeClientCount) * 100) : 0;

    const countryMap = new Map<string, number>();
    clientsInReach.forEach((client) => {
      const country = client.country?.trim() || 'Unknown';
      countryMap.set(country, (countryMap.get(country) || 0) + 1);
    });
    const countryChartData = Array.from(countryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { ...item, count, percent, countryChartData };
  });

  return {
    stats: {
      totalClients: totalClients || 0,
      pendingTcc: pendingTcc || 0,
    },
    reachStats,
  };
}

// ============================================================================
// CLIENT MANAGEMENT SERVICES (Admin Portal)
// ============================================================================
export interface ClientWizardInput {
  profile: {
    company_name: string;
    uuid_number: string;
    primary_contact_first_name: string;
    primary_contact_last_name: string;
    email: string;
    password?: string;
    owner_name?: string;
    phone?: string;
    cc_emails?: string;
    cc_phones?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    status: 'active' | 'inactive' | 'pending';
  };
  contacts: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    role?: string;
  }[];
  authorizedChemicalIds: string[];
}

export async function createClientWizard(supabase: SupabaseClient, input: ClientWizardInput) {
  // 1. Insert Client Profile
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      company_name: input.profile.company_name,
      legal_name: null,
      registration_number: null,
      uuid_number: input.profile.uuid_number.trim(),
      primary_contact_first_name: input.profile.primary_contact_first_name,
      primary_contact_last_name: input.profile.primary_contact_last_name,
      email: input.profile.email,
      owner_name: input.profile.owner_name || 'Company Representative',
      phone: input.profile.phone || null,
      cc_emails: input.profile.cc_emails || null,
      cc_phones: input.profile.cc_phones || null,
      address: input.profile.address || null,
      city: input.profile.city || null,
      state: input.profile.state || null,
      country: input.profile.country || null,
      postal_code: input.profile.postal_code || null,
      status: input.profile.status,
    })
    .select()
    .single();

  if (clientError) throw new Error(`Failed to create client: ${clientError.message}`);

  // 2. Insert Client Contacts
  if (input.contacts.length > 0) {
    const contactsData = input.contacts.map((c) => ({
      client_id: client.id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone || null,
      role: c.role || null,
    }));
    const { error: contactsError } = await supabase
      .from('client_contacts')
      .insert(contactsData);

    if (contactsError) throw new Error(`Failed to create contacts: ${contactsError.message}`);
  }

  // 3. Insert Client Chemical Authorizations
  if (input.authorizedChemicalIds.length > 0) {
    const authData = input.authorizedChemicalIds.map((chemId) => ({
      client_id: client.id,
      chemical_id: chemId,
    }));
    const { error: authError } = await supabase
      .from('client_chemicals')
      .insert(authData);

    if (authError) throw new Error(`Failed to map chemicals: ${authError.message}`);
  }

  return client;
}

export async function getClients(
  supabase: SupabaseClient,
  search = '',
  status = 'all',
  limit = 10,
  offset = 0
) {
  let query = supabase.from('clients').select('*', { count: 'exact' });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(`company_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    clients: data || [],
    totalCount: count || 0,
  };
}

export async function getActiveSubstanceCountsByClient(
  supabase: SupabaseClient,
  clientIds: string[]
): Promise<Record<string, number>> {
  if (clientIds.length === 0) return {};

  const { data, error } = await supabase
    .from('client_chemicals')
    .select('client_id')
    .in('client_id', clientIds)
    .eq('status', 'active');

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    counts[row.client_id] = (counts[row.client_id] || 0) + 1;
  }
  return counts;
}

export async function updateClient(
  supabase: SupabaseClient,
  clientId: string,
  profile: Partial<ClientWizardInput['profile']>,
  authorizedChemicalIds?: string[]
) {
  // Update Profile
  const { error: profileError } = await supabase
    .from('clients')
    .update(profile)
    .eq('id', clientId);

  if (profileError) throw profileError;

  // Sync Chemicals if provided
  if (authorizedChemicalIds !== undefined) {
    // Delete existing
    const { error: deleteError } = await supabase
      .from('client_chemicals')
      .delete()
      .eq('client_id', clientId);

    if (deleteError) throw deleteError;

    // Add new ones
    if (authorizedChemicalIds.length > 0) {
      const authData = authorizedChemicalIds.map((chemId) => ({
        client_id: clientId,
        chemical_id: chemId,
      }));
      const { error: insertError } = await supabase
        .from('client_chemicals')
        .insert(authData);

      if (insertError) throw insertError;
    }
  }

  return { success: true };
}

export async function deleteClient(supabase: SupabaseClient, clientId: string) {
  // Trigger deletes CASCADE client_contacts, client_chemicals, tcc_applications, certificates
  const { error } = await supabase.from('clients').delete().eq('id', clientId);
  if (error) throw error;
  return { success: true };
}

// ============================================================================
// CHEMICAL INVENTORY SERVICES
// ============================================================================
export async function getChemicals(supabase: SupabaseClient, search = '', status = 'all') {
  let query = supabase.from('chemicals').select(`
    *,
    client_chemicals (
      status,
      available_quantity,
      clients ( company_name )
    )
  `).in('status', ['active', 'inactive']);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(`chemical_name.ilike.%${search}%,cas_number.ilike.%${search}%`);
  }

  const { data, error } = await query.order('chemical_name', { ascending: true });
  if (error) throw error;

  const rows = data || [];
  const chemicalIds = rows.map((r) => r.id as string);

  const exportedByChemicalId: Record<string, number> = {};
  if (chemicalIds.length > 0) {
    const { data: approvedTccs, error: tccError } = await supabase
      .from('tcc_applications')
      .select('chemical_id, quantity_mt')
      .eq('status', 'approved')
      .in('chemical_id', chemicalIds);

    if (tccError) throw tccError;

    for (const tcc of approvedTccs || []) {
      const id = tcc.chemical_id as string;
      exportedByChemicalId[id] =
        (exportedByChemicalId[id] || 0) + Number(tcc.quantity_mt ?? 0);
    }
  }

  return rows.map((row) => {
    const links = (row.client_chemicals || []) as {
      status: string;
      available_quantity: number;
      clients: { company_name: string } | null;
    }[];
    const activeLinks = links.filter((cc) => cc.status !== 'trashed');

    const company_names = [
      ...new Set(
        activeLinks
          .filter((cc) => cc.clients?.company_name)
          .map((cc) => cc.clients!.company_name)
      ),
    ].sort((a, b) => a.localeCompare(b));

    const remaining_quota = activeLinks.reduce(
      (sum, cc) => sum + Number(cc.available_quantity ?? 0),
      0
    );
    const exported_mt = exportedByChemicalId[row.id as string] ?? 0;
    const total_quota = remaining_quota + exported_mt;

    const { client_chemicals: _omit, ...chem } = row as Record<string, unknown> & {
      client_chemicals?: unknown;
    };
    return {
      ...chem,
      company_names,
      remaining_quota,
      exported_mt,
      total_quota,
    };
  });
}

export async function createChemical(supabase: SupabaseClient, data: Record<string, unknown>) {
  const { data: chem, error } = await supabase
    .from('chemicals')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return chem;
}

export async function updateChemical(supabase: SupabaseClient, id: string, data: Record<string, unknown>) {
  const { error } = await supabase.from('chemicals').update(data).eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function getTrashedChemicals(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('chemicals')
    .select('id, chemical_name, cas_number, ec_number, tonnage_band, validity_date, status, created_at')
    .eq('status', 'trashed')
    .order('chemical_name', { ascending: true });

  // 22P02 = enum value 'trashed' not added yet — run database.sql migration in Supabase
  if (error) {
    if (error.code === '22P02') return [];
    throw error;
  }
  return data || [];
}

export async function deleteChemical(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('chemicals').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ============================================================================
// TCC APPLICATIONS & CERTIFICATE APPROVALS
// ============================================================================
const REACH_QUOTA_CERT_SELECT =
  'id, certificate_number, client_id, chemical_id, status, expires_at, issued_at, type, allocated_quantity, tonnage_band, registration_number';

const TCC_APPROVED_EXPORT_SELECT =
  'id, client_id, chemical_id, quantity_mt, status, export_date, reach_certificate_id, updated_at, created_at, certificates!certificates_tcc_application_id_fkey(issued_at)';

async function enrichTccApplicationsWithRcQuota(
  supabase: SupabaseClient,
  applications: Record<string, unknown>[]
) {
  if (!applications.length) return applications;

  const clientIds = [...new Set(applications.map((app) => app.client_id as string))];

  const [{ data: reachCerts }, { data: approvedApps }] = await Promise.all([
    supabase
      .from('certificates')
      .select(REACH_QUOTA_CERT_SELECT)
      .in('client_id', clientIds)
      .eq('type', REACH_CERTIFICATE_TYPE)
      .neq('status', 'revoked'),
    supabase
      .from('tcc_applications')
      .select(TCC_APPROVED_EXPORT_SELECT)
      .in('client_id', clientIds)
      .eq('status', 'approved'),
  ]);

  return applications.map((app) => {
    if (!app.export_date) {
      return { ...app, rc_remaining_quota: null, rc_period_certificate: null, rc_tonnage_band: null, rc_registration_number: null, rc_certificate_year: null };
    }

    const chem = Array.isArray(app.chemicals) ? app.chemicals[0] : app.chemicals;
    const quota = computeTccQuotaForExportDate({
      reachCertificates: (reachCerts || []).filter((cert) => cert.client_id === app.client_id),
      approvedApplications: approvedApps || [],
      chemicalId: app.chemical_id as string,
      exportDate: app.export_date as string,
      tonnageBand: (chem as { tonnage_band?: string | null } | null)?.tonnage_band ?? null,
      excludeApplicationId: app.status === 'approved' ? undefined : (app.id as string),
    });

    return {
      ...app,
      rc_remaining_quota: quota.remainingQuota,
      rc_period_certificate: quota.reachCert?.certificate_number ?? null,
      rc_tonnage_band: quota.reachCert?.tonnage_band ?? null,
      rc_registration_number: quota.reachCert?.registration_number ?? null,
      rc_certificate_year: getReachCertificateYear(quota.reachCert?.issued_at ?? null),
    };
  });
}

export async function getTccApplications(
  supabase: SupabaseClient,
  statusFilter = 'all',
  options?: { euReachOnly?: boolean }
) {
  let query = supabase.from('tcc_applications').select(`
    *,
    clients (company_name, email),
    chemicals (chemical_name, cas_number, ec_number, tonnage_band, validity_date, available_quantity),
    client_chemicals (available_quantity),
    certificates!certificates_tcc_application_id_fkey (*)
  `);

  if (options?.euReachOnly) {
    query = query.or('regulatory_framework.is.null,regulatory_framework.eq.eu_reach');
  }

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return enrichTccApplicationsWithRcQuota(supabase, data || []);
}

export async function processTccApplication(
  supabase: SupabaseClient,
  applicationId: string,
  status: 'approved' | 'rejected' | 'modification_requested',
  adminUserId: string,
  rejectionReason = ''
) {
  // Start transaction / update
  const { data: app, error: appFetchError } = await supabase
    .from('tcc_applications')
    .select('*, chemicals(*), clients(*)')
    .eq('id', applicationId)
    .single();

  if (appFetchError) throw appFetchError;

  if (status === 'approved') {
    // 1. Quota check
    const newAvailable = Number(app.chemicals.available_quantity) - Number(app.quantity_mt);
    const newExported = Number(app.chemicals.exported_quantity) + Number(app.quantity_mt);

    if (newAvailable < 0) {
      throw new Error(`Insufficient available quantity. Remaining: ${app.chemicals.available_quantity} MT.`);
    }

    // 2. Deduct inventory quota
    const { error: chemUpdateError } = await supabase
      .from('chemicals')
      .update({
        available_quantity: newAvailable,
        exported_quantity: newExported,
      })
      .eq('id', app.chemical_id);

    if (chemUpdateError) throw chemUpdateError;
  }

  // 3. Update application status
  const { error: appUpdateError } = await supabase
    .from('tcc_applications')
    .update({
      status,
      rejection_reason: status !== 'approved' ? rejectionReason : null,
      approved_by: adminUserId,
    })
    .eq('id', applicationId);

  if (appUpdateError) throw appUpdateError;

  return app;
}

// ============================================================================
// CLIENT DASHBOARD SERVICES
// ============================================================================
export async function getClientDashboardStats(supabase: SupabaseClient, clientId: string) {
  // Run all independent queries in parallel
  const [
    activePermsRes,
    approvedAppsRes,
    mappingsRes,
    certificatesRes,
    userProfileRes
  ] = await Promise.all([
    supabase.from('client_chemicals').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
    supabase.from('tcc_applications').select('quantity_mt').eq('client_id', clientId).eq('status', 'approved'),
    supabase.from('client_chemicals').select('chemical_id, available_quantity, chemicals (*)').eq('client_id', clientId).eq('status', 'active'),
    supabase.from('certificates').select('*, tcc_applications:tcc_applications!certificates_tcc_application_id_fkey (quantity_mt, chemicals (chemical_name, cas_number))').eq('client_id', clientId).order('issued_at', { ascending: false }).limit(10),
    supabase.from('users').select('id').eq('client_id', clientId).limit(1)
  ]);

  const activePermissions = activePermsRes.count;
  const approvedApps = approvedAppsRes.data;
  const mappings = mappingsRes.data;
  const certificates = certificatesRes.data;
  const userProfile = userProfileRes.data;

  const totalExported = (approvedApps || []).reduce((sum, app) => sum + Number(app.quantity_mt), 0);
  const remainingQuota = (mappings || []).reduce((sum: number, row: { available_quantity?: number }) => {
    return sum + Number(row.available_quantity ?? 0);
  }, 0);


  let notifications: Record<string, unknown>[] = [];
  if (userProfile && userProfile.length > 0) {
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userProfile[0].id)
      .order('created_at', { ascending: false })
      .limit(10);
    notifications = notifs || [];
  }

  return {
    stats: {
      activePermissions: activePermissions || 0,
      totalExported: parseFloat(totalExported.toFixed(2)),
      remainingQuota: parseFloat(remainingQuota.toFixed(2)),
    },
    certificates: certificates || [],
    notifications,
  };
}

// ============================================================================
// TEMPLATE SERVICES
// ============================================================================
export async function getActiveTemplate(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

export async function getActiveRcTemplateKey(supabase: SupabaseClient) {
  const template = await getActiveTemplate(supabase);
  return template?.rc_template_key === 'template_2' ? 'template_2' : 'template_1';
}

export async function updateTemplate(supabase: SupabaseClient, id: string, data: Record<string, unknown>) {
  const { error } = await supabase
    .from('templates')
    .update(data)
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}
