'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, destroySession } from '@/lib/auth/session';
import { loginSchema } from '@/lib/validations';

// ============================================================================
// LOGIN
// ============================================================================
export async function login(prevState: unknown, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const result = loginSchema.safeParse({ email, password });
  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  const supabase = createAdminClient();

  // 1. Look up user by email
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, password_hash, role, client_id, is_disabled')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error || !user) {
    return { success: false, error: 'Invalid email or password.' };
  }

  // 2. Check if account is disabled
  if (user.is_disabled) {
    return { success: false, error: 'Your account has been disabled. Please contact the administrator.' };
  }

  // 3. Verify password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return { success: false, error: 'Invalid email or password.' };
  }

  await createSession({
    userId: user.id,
    email: user.email,
    role: user.role as 'SUPER_ADMIN' | 'MASTER_ADMIN' | 'CLIENT',
    clientId: user.client_id ?? null,
  });

  const requestedRedirect = String(formData.get('redirectTo') ?? '').trim();
  const roleHome = user.role === 'CLIENT' ? '/client' : '/admin';
  let redirectTo = roleHome;

  if (requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//')) {
    const isClientPath = requestedRedirect.startsWith('/client');
    const isAdminPath = requestedRedirect.startsWith('/admin');
    if (user.role === 'CLIENT' && isClientPath) {
      redirectTo = requestedRedirect;
    } else if (user.role !== 'CLIENT' && isAdminPath) {
      redirectTo = requestedRedirect;
    }
  }

  return { success: true as const, redirectTo };
}

// ============================================================================
// LOGOUT
// ============================================================================
export async function logout() {
  await destroySession();
  return { success: true as const };
}
