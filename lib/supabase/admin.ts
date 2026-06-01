import { createClient } from '@supabase/supabase-js';

export const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl) {
    throw new Error('Environment variable NEXT_PUBLIC_SUPABASE_URL is required for the Supabase admin client.');
  }

  if (!serviceRoleKey || serviceRoleKey.startsWith('your-') || serviceRoleKey === 'placeholder-service-role') {
    throw new Error('Environment variable SUPABASE_SERVICE_ROLE must be set to your Supabase service role key.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
