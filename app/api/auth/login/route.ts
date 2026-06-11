import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth/authenticate-user';
import { SESSION_COOKIE } from '@/lib/auth/constants';
import { SESSION_COOKIE_OPTIONS } from '@/lib/auth/cookie-options';
import { resolveLoginRedirect } from '@/lib/auth/resolve-login-redirect';
import { signSessionToken } from '@/lib/auth/sign-session';

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string; redirectTo?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const email = String(body.email ?? '');
  const password = String(body.password ?? '');

  const auth = await authenticateUser(email, password);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const redirectTo = resolveLoginRedirect(auth.session.role, body.redirectTo);
  const token = await signSessionToken(auth.session);

  const response = NextResponse.json({ success: true, redirectTo });
  response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return response;
}
