'use server';

import { authenticateUser } from '@/lib/auth/authenticate-user';
import { resolveLoginRedirect } from '@/lib/auth/resolve-login-redirect';
import { createSession, destroySession } from '@/lib/auth/session';

// ============================================================================
// LOGIN
// ============================================================================
export async function login(prevState: unknown, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const auth = await authenticateUser(email, password);
  if (!auth.ok) {
    return { success: false as const, error: auth.error };
  }

  await createSession(auth.session);

  const redirectTo = resolveLoginRedirect(
    auth.session.role,
    String(formData.get('redirectTo') ?? '')
  );

  return { success: true as const, redirectTo };
}

// ============================================================================
// LOGOUT
// ============================================================================
export async function logout() {
  await destroySession();
  return { success: true as const };
}
