'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) return null;
  return session;
}

// ============================================================================
// GET ADMIN SETTINGS
// ============================================================================
export async function getAdminSettingsAction() {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();
  try {
    const { data: settings, error } = await adminSupabase
      .from('admin_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      const { data: inserted, error: insertError } = await adminSupabase
        .from('admin_settings')
        .insert({ id: 1, email: session.email })
        .select()
        .single();
      if (insertError) throw insertError;
      return { success: true, settings: inserted };
    }

    return { success: true, settings };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// UPDATE PROFILE SETTINGS
// ============================================================================
export async function updateAdminProfileSettingsAction(profileData: {
  full_name?: string;
  mobile_number?: string;
  timezone?: string;
  cc_emails?: string;
  bcc_emails?: string;
  profile_image?: string | null;
}) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();
  try {
    const { error } = await adminSupabase
      .from('admin_settings')
      .upsert({ id: 1, ...profileData, updated_at: new Date().toISOString() }, { onConflict: 'id' });

    if (error) throw error;
    revalidatePath('/admin/settings');
    return { success: true, message: 'Profile settings updated successfully.' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// UPDATE SMTP SETTINGS
// ============================================================================
export async function updateSmtpSettingsAction(smtpData: {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from?: string;
  smtp_cc_default?: string;
}) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();
  try {
    const { error } = await adminSupabase
      .from('admin_settings')
      .upsert({ id: 1, ...smtpData, updated_at: new Date().toISOString() }, { onConflict: 'id' });

    if (error) throw error;
    revalidatePath('/admin/settings');
    return { success: true, message: 'SMTP settings saved. Certificate emails will now use these settings.' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// UPDATE ADMIN AUTH (email + password via custom auth)
// ============================================================================
export async function updateAdminAuthAction(data: { email?: string; password?: string }) {
  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized.' };

  const adminSupabase = createAdminClient();
  try {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (data.email) {
      const emailLower = data.email.toLowerCase();
      // Check email not taken
      const { data: existing } = await adminSupabase
        .from('users')
        .select('id')
        .eq('email', emailLower)
        .neq('id', session.userId)
        .maybeSingle();
      if (existing) return { success: false, error: 'Email already in use.' };
      updates.email = emailLower;
    }

    if (data.password) {
      if (data.password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };
      updates.password_hash = await hashPassword(data.password);
    }

    const { error } = await adminSupabase
      .from('users')
      .update(updates)
      .eq('id', session.userId);

    if (error) throw error;
    return { success: true, message: 'Credentials updated. Please log in again if you changed your email.' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
