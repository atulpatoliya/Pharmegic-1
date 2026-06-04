'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, destroySession } from '@/lib/auth/session';
import { loginSchema } from '@/lib/validations';
import { redirect } from 'next/navigation';

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

  // 4. Create session cookie
  await createSession({
    userId: user.id,
    email: user.email,
    role: user.role as 'SUPER_ADMIN' | 'MASTER_ADMIN' | 'CLIENT',
    clientId: user.client_id ?? null,
  });

  return { success: true, role: user.role };
}

// ============================================================================
// LOGOUT
// ============================================================================
export async function logout() {
  await destroySession();
  redirect('/login');
}
