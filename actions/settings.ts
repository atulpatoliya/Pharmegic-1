'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getAdminSettingsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (user.user_metadata?.role !== 'MASTER_ADMIN' && user.user_metadata?.role !== 'STAFF')) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const { data: settings, error } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      // If table row doesn't exist, insert the default one
      const { data: inserted, error: insertError } = await supabase
        .from('admin_settings')
        .insert({ id: 1, email: user.email })
        .select()
        .single();
      
      if (insertError) throw insertError;
      return { success: true, settings: inserted };
    }

    return { success: true, settings };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch settings.' };
  }
}

export async function updateAdminProfileSettingsAction(profileData: {
  full_name?: string;
  mobile_number?: string;
  timezone?: string;
  cc_emails?: string;
  bcc_emails?: string;
  profile_image?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (user.user_metadata?.role !== 'MASTER_ADMIN' && user.user_metadata?.role !== 'STAFF')) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const { error } = await supabase
      .from('admin_settings')
      .update({
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    if (error) throw error;
    
    revalidatePath('/admin/settings');
    return { success: true, message: 'Admin profile updated successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update profile settings.' };
  }
}

export async function updateAdminAuthAction(data: { email?: string; password?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== 'MASTER_ADMIN') {
    return { success: false, error: 'Unauthorized. Only Master Admins can update auth credentials.' };
  }

  try {
    const updates: any = {};
    if (data.email) updates.email = data.email;
    if (data.password) updates.password = data.password;

    const { error } = await supabase.auth.updateUser(updates);
    if (error) throw error;

    return { success: true, message: 'Authentication credentials updated successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update authentication details.' };
  }
}
