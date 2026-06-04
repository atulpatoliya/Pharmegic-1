'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

export async function updateTemplateAction(templateId: string, data: {
  logo?: string | null;
  signature_image?: string | null;
  accent_color: string;
  footer_text: string;
}) {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized.' };
  }

  const adminSupabase = createAdminClient();
  try {
    const { error } = await adminSupabase.from('templates').update(data).eq('id', templateId);
    if (error) throw error;
    revalidatePath('/admin/settings');
    return { success: true, message: 'Certificate template updated successfully.' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
