import type { SupabaseClient } from '@supabase/supabase-js';

export const CERTIFICATES_BUCKET = 'certificates';

/**
 * Ensures the public storage bucket exists (creates it with service role if missing).
 */
export async function ensureCertificatesBucket(supabase: SupabaseClient): Promise<void> {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(
      `Cannot access Supabase Storage. Create a public bucket named "${CERTIFICATES_BUCKET}" in the Supabase Dashboard → Storage. (${listError.message})`
    );
  }

  const exists = (buckets ?? []).some((b) => b.name === CERTIFICATES_BUCKET);
  if (exists) return;

  const { error: createError } = await supabase.storage.createBucket(CERTIFICATES_BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
  });

  if (createError) {
    const msg = createError.message.toLowerCase();
    if (msg.includes('already exists') || msg.includes('duplicate')) return;
    throw new Error(
      `Storage bucket "${CERTIFICATES_BUCKET}" not found. In Supabase Dashboard → Storage → New bucket, name it "${CERTIFICATES_BUCKET}" and set it to Public. (${createError.message})`
    );
  }
}
