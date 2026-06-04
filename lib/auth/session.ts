import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { SESSION_COOKIE, SESSION_MAX_AGE, getAuthSecret } from '@/lib/auth/constants';

export interface SessionPayload {
  userId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'MASTER_ADMIN' | 'CLIENT';
  clientId?: string | null;
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const secret = getAuthSecret();
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

async function reconcileSessionWithDatabase(
  session: SessionPayload
): Promise<SessionPayload | null> {
  const supabase = createAdminClient();

  let user: {
    id: string;
    email: string;
    role: string;
    client_id: string | null;
    is_disabled: boolean;
  } | null = null;

  const { data: userById } = await supabase
    .from('users')
    .select('id, email, role, client_id, is_disabled')
    .eq('id', session.userId)
    .maybeSingle();

  user = userById;

  // After DB reset/reseed, JWT may still hold an old user id — match by email
  if (!user) {
    const { data: userByEmail } = await supabase
      .from('users')
      .select('id, email, role, client_id, is_disabled')
      .eq('email', session.email.toLowerCase().trim())
      .maybeSingle();
    user = userByEmail;
  }

  if (!user || user.is_disabled) return null;

  const validated: SessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as SessionPayload['role'],
    clientId: user.client_id ?? null,
  };

  // Do not call createSession here — layouts/pages cannot modify cookies during render.
  // Return reconciled user for this request; proxy clears stale cookies on redirect to /login.
  return validated;
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const secret = getAuthSecret();
    const { payload } = await jwtVerify(token, secret);
    const jwtSession = payload as unknown as SessionPayload;

    return await reconcileSessionWithDatabase(jwtSession);
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
