'use server';

import { createClient } from '@/lib/supabase/server';
import { updateTemplate } from '@/services/db';
import { revalidatePath } from 'next/cache';

export async function updateTemplateAction(templateId: string, data: {
  logo?: string | null;
  signature_image?: string | null;
  accent_color: string;
  footer_text: string;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (user.user_metadata?.role !== 'MASTER_ADMIN' && user.user_metadata?.role !== 'STAFF')) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    await updateTemplate(supabase, templateId, data);
    revalidatePath('/admin/templates');
    return { success: true, message: 'Document certificate template updated successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update template.' };
  }
}
