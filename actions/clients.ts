'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { clientWizardSchema, assignChemicalSchema, internalNoteSchema, changeEmailSchema, changePasswordSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

// ============================================================================
// HELPER: Verify admin session
// ============================================================================
async function requireAdmin() {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return null;
  }
  return session;
}

// ============================================================================
// CREATE CLIENT
// ============================================================================
export async function createClientAction(prevState: unknown, data: unknown) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized. Admins only.' };

  const parsed = clientWizardSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const adminSupabase = createAdminClient();
  const { profile, contacts } = parsed.data;

  try {
    // 1. Check email uniqueness
    const { data: existing } = await adminSupabase
      .from('clients')
      .select('id')
      .eq('email', profile.email.toLowerCase())
      .maybeSingle();
    if (existing) return { success: false, error: 'A client with this email already exists.' };

    // 2. Hash password
    const password_hash = await hashPassword(profile.password);

    // 3. Create client record
    const { data: client, error: clientError } = await adminSupabase
      .from('clients')
      .insert({
        company_name: profile.company_name,
        legal_name: profile.legal_name || null,
        registration_number: profile.registration_number,
        uuid_number: profile.uuid_number || null,
        owner_name: profile.owner_name || null,
        email: profile.email.toLowerCase(),
        phone: profile.phone || null,
        primary_contact_first_name: profile.primary_contact_first_name,
        primary_contact_last_name: profile.primary_contact_last_name,
        cc_emails: profile.cc_emails || null,
        cc_phones: profile.cc_phones || null,
        address: profile.address || null,
        city: profile.city || null,
        state: profile.state || null,
        country: profile.country || 'Turkey',
        postal_code: profile.postal_code || null,
        status: profile.status,
      })
      .select()
      .single();

    if (clientError || !client) throw clientError || new Error('Failed to create client');

    // 4. Create user login record
    const { data: user, error: userError } = await adminSupabase
      .from('users')
      .insert({
        email: profile.email.toLowerCase(),
        password_hash,
        role: 'CLIENT',
        client_id: client.id,
        is_disabled: false,
      })
      .select()
      .single();

    if (userError || !user) {
      await adminSupabase.from('clients').delete().eq('id', client.id);
      throw userError || new Error('Failed to create user login record');
    }

    // 5. Insert secondary contacts
    if (contacts.length > 0) {
      const contactRows = contacts.map((c) => ({
        client_id: client.id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        phone: c.phone || null,
        role: c.role || null,
      }));
      await adminSupabase.from('client_contacts').insert(contactRows);
    }

    // 6. Activity log
    await adminSupabase.from('activity_logs').insert({
      client_id: client.id,
      user_id: session.userId,
      action: 'CLIENT_CREATED',
      entity_type: 'clients',
      entity_id: client.id,
      description: `Client ${client.company_name} created by admin`,
    });

    revalidatePath('/admin/clients');
    return { success: true, message: 'Client created and login credentials set successfully.', clientId: client.id };
  } catch (err) {
    console.error('[CLIENT CREATE ERROR]:', err);
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || 'An unexpected error occurred.' };
  }
}

// ============================================================================
// UPDATE CLIENT PROFILE
// ============================================================================
export async function updateClientAction(clientId: string, profile: Record<string, unknown>, chemicalIds?: string[]) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();
  try {
    const { error } = await adminSupabase
      .from('clients')
      .update({ ...profile, updated_at: new Date().toISOString() })
      .eq('id', clientId);

    if (error) throw error;

    if (chemicalIds !== undefined) {
      // Sync client chemicals
      await adminSupabase.from('client_chemicals').delete().eq('client_id', clientId);
      if (chemicalIds.length > 0) {
        const insertRows = chemicalIds.map(cid => ({
          client_id: clientId,
          chemical_id: cid,
          available_quantity: 0, // Assigned via client detail page later or default to 0
          status: 'active'
        }));
        await adminSupabase.from('client_chemicals').insert(insertRows);
      }
    }

    await adminSupabase.from('activity_logs').insert({
      client_id: clientId,
      user_id: session.userId,
      action: 'CLIENT_UPDATED',
      entity_type: 'clients',
      entity_id: clientId,
      description: 'Client profile updated by admin',
    });

    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath('/admin/clients');
    return { success: true, message: 'Client profile updated successfully.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}


// ============================================================================
// CHANGE CLIENT EMAIL (Admin only)
// ============================================================================
export async function changeClientEmailAction(clientId: string, newEmail: string) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const parsed = changeEmailSchema.safeParse({ new_email: newEmail });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const adminSupabase = createAdminClient();
  try {
    const emailLower = newEmail.toLowerCase();

    // Check uniqueness in clients and users
    const { data: dupClient } = await adminSupabase.from('clients').select('id').eq('email', emailLower).neq('id', clientId).maybeSingle();
    if (dupClient) return { success: false, error: 'Email already in use by another client.' };

    // Update clients table
    const { error: cErr } = await adminSupabase.from('clients').update({ email: emailLower }).eq('id', clientId);
    if (cErr) throw cErr;

    // Update users table
    const { error: uErr } = await adminSupabase.from('users').update({ email: emailLower }).eq('client_id', clientId);
    if (uErr) throw uErr;

    await adminSupabase.from('activity_logs').insert({
      client_id: clientId,
      user_id: session.userId,
      action: 'EMAIL_CHANGED',
      entity_type: 'clients',
      entity_id: clientId,
      description: `Client email changed to ${emailLower}`,
    });

    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true, message: 'Client email updated successfully.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// CHANGE CLIENT PASSWORD (Admin only)
// ============================================================================
export async function changeClientPasswordAction(clientId: string, newPassword: string) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const parsed = changePasswordSchema.safeParse({ new_password: newPassword });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const adminSupabase = createAdminClient();
  try {
    const password_hash = await hashPassword(newPassword);
    const { error } = await adminSupabase.from('users').update({ password_hash }).eq('client_id', clientId);
    if (error) throw error;

    await adminSupabase.from('activity_logs').insert({
      client_id: clientId,
      user_id: session.userId,
      action: 'PASSWORD_CHANGED',
      entity_type: 'users',
      entity_id: clientId,
      description: 'Client password changed by admin',
    });

    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true, message: 'Password updated successfully.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// TOGGLE CLIENT LOGIN (Enable / Disable)
// ============================================================================
export async function toggleClientLoginAction(clientId: string, disable: boolean) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();
  try {
    const { error } = await adminSupabase.from('users').update({ is_disabled: disable }).eq('client_id', clientId);
    if (error) throw error;

    await adminSupabase.from('activity_logs').insert({
      client_id: clientId,
      user_id: session.userId,
      action: disable ? 'LOGIN_DISABLED' : 'LOGIN_ENABLED',
      entity_type: 'users',
      entity_id: clientId,
      description: disable ? 'Client login disabled by admin' : 'Client login re-enabled by admin',
    });

    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true, message: disable ? 'Client login disabled.' : 'Client login enabled.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// ARCHIVE CLIENT
// ============================================================================
export async function archiveClientAction(clientId: string) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();
  try {
    const { error } = await adminSupabase.from('clients').update({ status: 'inactive' }).eq('id', clientId);
    if (error) throw error;

    await adminSupabase.from('activity_logs').insert({
      client_id: clientId,
      user_id: session.userId,
      action: 'CLIENT_ARCHIVED',
      entity_type: 'clients',
      entity_id: clientId,
      description: 'Client archived by admin',
    });

    revalidatePath('/admin/clients');
    return { success: true, message: 'Client archived successfully.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// DELETE CLIENT
// ============================================================================
export async function deleteClientAction(clientId: string) {
  const session = await requireAdmin();
  if (!session || session.role !== 'SUPER_ADMIN') return { success: false, error: 'Unauthorized. Super Admin only.' };

  const adminSupabase = createAdminClient();
  try {
    // Delete user first (FK constraint)
    await adminSupabase.from('users').delete().eq('client_id', clientId);
    await adminSupabase.from('clients').delete().eq('id', clientId);

    revalidatePath('/admin/clients');
    return { success: true, message: 'Client deleted successfully.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// ASSIGN CHEMICAL TO CLIENT
// ============================================================================
export async function assignChemicalToClientAction(clientId: string, data: unknown) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const parsed = assignChemicalSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const adminSupabase = createAdminClient();
  try {
    const { error } = await adminSupabase
      .from('client_chemicals')
      .upsert({
        client_id: clientId,
        chemical_id: parsed.data.chemical_id,
        available_quantity: parsed.data.available_quantity,
        validity_date: parsed.data.validity_date,
        status: parsed.data.status,
        assigned_by: session.userId,
      }, { onConflict: 'client_id,chemical_id' });

    if (error) throw error;

    await adminSupabase.from('activity_logs').insert({
      client_id: clientId,
      user_id: session.userId,
      action: 'CHEMICAL_ASSIGNED',
      entity_type: 'client_chemicals',
      entity_id: clientId,
      description: `Chemical assigned to client`,
    });

    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true, message: 'Chemical assigned successfully.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// REMOVE CHEMICAL FROM CLIENT
// ============================================================================
export async function removeChemicalFromClientAction(clientId: string, chemicalId: string) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();
  try {
    const { error } = await adminSupabase
      .from('client_chemicals')
      .delete()
      .eq('client_id', clientId)
      .eq('chemical_id', chemicalId);

    if (error) throw error;
    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true, message: 'Chemical removed.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// SECONDARY CONTACTS CRUD
// ============================================================================
export async function addContactAction(clientId: string, contact: { first_name: string; last_name: string; email: string; phone?: string; role?: string }) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();
  try {
    const { error } = await adminSupabase.from('client_contacts').insert({ client_id: clientId, ...contact });
    if (error) throw error;
    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true, message: 'Contact added.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function deleteContactAction(contactId: string, clientId: string) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();
  try {
    const { error } = await adminSupabase.from('client_contacts').delete().eq('id', contactId);
    if (error) throw error;
    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true, message: 'Contact removed.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// INTERNAL NOTES
// ============================================================================
export async function addInternalNoteAction(clientId: string, note: string) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const parsed = internalNoteSchema.safeParse({ note });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const adminSupabase = createAdminClient();
  try {
    const { error } = await adminSupabase.from('internal_notes').insert({
      client_id: clientId,
      author_id: session.userId,
      note: parsed.data.note,
    });
    if (error) throw error;
    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true, message: 'Note added.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function deleteInternalNoteAction(noteId: string, clientId: string) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();
  try {
    const { error } = await adminSupabase.from('internal_notes').delete().eq('id', noteId);
    if (error) throw error;
    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true, message: 'Note deleted.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
