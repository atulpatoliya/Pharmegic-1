import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// ADMIN DASHBOARD SERVICES
// ============================================================================
export async function getAdminDashboardStats(supabase: SupabaseClient) {
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  // Run all 6 independent queries in parallel
  const [
    clientsRes,
    certificatesRes,
    pendingTccRes,
    chemicalsRes,
    renewalAlertsRes,
    approvedAppsRes
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('certificates').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('tcc_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('chemicals').select('exported_quantity'),
    supabase.from('certificates').select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .lte('expires_at', thirtyDaysLater.toISOString())
      .gte('expires_at', new Date().toISOString()),
    supabase.from('tcc_applications').select('quantity_mt, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
  ]);

  const totalClients = clientsRes.count;
  const activeCertificates = certificatesRes.count;
  const pendingTcc = pendingTccRes.count;
  const chemicals = chemicalsRes.data;
  const renewalAlerts = renewalAlertsRes.count;
  const approvedApps = approvedAppsRes.data;

  const totalExported = (chemicals || []).reduce((sum, chem) => sum + Number(chem.exported_quantity), 0);

  // Group by month
  const monthlyActivityMap: Record<string, number> = {};
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Pre-fill last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
    monthlyActivityMap[label] = 0;
  }

  (approvedApps || []).forEach((app) => {
    const d = new Date(app.created_at);
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
    if (monthlyActivityMap[label] !== undefined) {
      monthlyActivityMap[label] += Number(app.quantity_mt);
    }
  });

  const chartData = Object.entries(monthlyActivityMap).map(([name, quantity]) => ({
    name,
    quantity: parseFloat(quantity.toFixed(2)),
  }));

  return {
    stats: {
      totalClients: totalClients || 0,
      activeCertificates: activeCertificates || 0,
      pendingTcc: pendingTcc || 0,
      totalExported: parseFloat(totalExported.toFixed(2)),
      renewalAlerts: renewalAlerts || 0,
    },
    chartData,
  };
}

// ============================================================================
// CLIENT MANAGEMENT SERVICES (Admin Portal)
// ============================================================================
export interface ClientWizardInput {
  profile: {
    company_name: string;
    legal_name?: string;
    registration_number: string;
    uuid_number?: string;
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
      legal_name: input.profile.legal_name || input.profile.company_name,
      registration_number: input.profile.registration_number,
      uuid_number: input.profile.uuid_number || null,
      primary_contact_first_name: input.profile.primary_contact_first_name,
      primary_contact_last_name: input.profile.primary_contact_last_name,
      contact_person: `${input.profile.primary_contact_first_name} ${input.profile.primary_contact_last_name}`,
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
      person_name: `${c.first_name} ${c.last_name}`,
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
    query = query.or(`company_name.ilike.%${search}%,legal_name.ilike.%${search}%,email.ilike.%${search}%`);
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
  let query = supabase.from('chemicals').select('*');

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(`chemical_name.ilike.%${search}%,cas_number.ilike.%${search}%`);
  }

  const { data, error } = await query.order('chemical_name', { ascending: true });
  if (error) throw error;
  return data || [];
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

export async function deleteChemical(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('chemicals').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ============================================================================
// TCC APPLICATIONS & CERTIFICATE APPROVALS
// ============================================================================
export async function getTccApplications(supabase: SupabaseClient, statusFilter = 'all') {
  let query = supabase.from('tcc_applications').select(`
    *,
    clients (company_name, email),
    chemicals (chemical_name, cas_number, ec_number, validity_date, available_quantity),
    certificates!certificates_tcc_application_id_fkey (*)
  `);

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
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
    supabase.from('client_chemicals').select('chemical_id, chemicals (*)').eq('client_id', clientId),
    supabase.from('certificates').select('*, tcc_applications:tcc_applications!certificates_tcc_application_id_fkey (quantity_mt, chemicals (chemical_name, cas_number))').eq('client_id', clientId).order('issued_at', { ascending: false }).limit(10),
    supabase.from('users').select('id').eq('client_id', clientId).limit(1)
  ]);

  const activePermissions = activePermsRes.count;
  const approvedApps = approvedAppsRes.data;
  const mappings = mappingsRes.data;
  const certificates = certificatesRes.data;
  const userProfile = userProfileRes.data;

  const totalExported = (approvedApps || []).reduce((sum, app) => sum + Number(app.quantity_mt), 0);
  const authorizedSubstances = (mappings || []).map((m: { chemicals: Record<string, unknown> }) => m.chemicals);
  const remainingQuota = authorizedSubstances.reduce((sum: number, chem: Record<string, unknown>) => {
    const available = typeof chem.available_quantity === 'number' ? chem.available_quantity : 0;
    return sum + Number(available || 0);
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
    authorizedSubstances,
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

export async function updateTemplate(supabase: SupabaseClient, id: string, data: Record<string, unknown>) {
  const { error } = await supabase
    .from('templates')
    .update(data)
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}
