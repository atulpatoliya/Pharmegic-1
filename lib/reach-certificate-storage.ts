import type { SupabaseClient } from '@supabase/supabase-js';
import { CERTIFICATES_BUCKET } from '@/lib/storage';

/** Remove cached certificate files so stale Template 1 PDFs cannot be served. */
export async function clearReachCertificateStorageFiles(
  supabase: SupabaseClient,
  certificateNumber: string
): Promise<void> {
  await supabase.storage
    .from(CERTIFICATES_BUCKET)
    .remove([`${certificateNumber}.pdf`, `${certificateNumber}.docx`]);
}
