import { createClient } from '@supabase/supabase-js';

export const createAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE || 'placeholder-service-role',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};
