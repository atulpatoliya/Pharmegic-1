import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE, getAuthSecret } from '@/lib/auth/constants';

const ADMIN_ROLES = ['SUPER_ADMIN', 'MASTER_ADMIN'];
const CLIENT_ROLE = 'CLIENT';

function redirectToLogin(request: NextRequest, query?: string, clearCookie = false) {
  const path = query ? `/login?${query}` : '/login';
  const response = NextResponse.redirect(new URL(path, request.url));
  if (clearCookie) {
    response.cookies.delete(SESSION_COOKIE);
  }
  return response;
}

function redirectToRoleHome(request: NextRequest, role: string) {
  if (ADMIN_ROLES.includes(role)) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }
  if (role === CLIENT_ROLE) {
    return NextResponse.redirect(new URL('/client', request.url));
  }
  return redirectToLogin(request, 'error=Unauthorized', true);
}

type SessionReadResult =
  | { status: 'ok'; session: { role?: string; userId?: string; email?: string } }
  | { status: 'missing' }
  | { status: 'invalid' };

async function readSessionFromRequest(request: NextRequest): Promise<SessionReadResult> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return { status: 'missing' };

  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    return {
      status: 'ok',
      session: payload as { role?: string; userId?: string; email?: string },
    };
  } catch {
    return { status: 'invalid' };
  }
}

function requireSession(
  request: NextRequest,
  result: SessionReadResult
): NextResponse | null {
  if (result.status === 'ok') return null;
  const clearCookie = result.status === 'invalid';
  return redirectToLogin(request, 'error=SessionExpired', clearCookie);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — always accessible (do not auto-bounce /login → /admin; layout validates DB user)
  if (
    pathname.startsWith('/verify') ||
    pathname === '/login' ||
    pathname.startsWith('/api/auth/clear') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Protected admin routes
  if (pathname.startsWith('/admin')) {
    const result = await readSessionFromRequest(request);
    const denied = requireSession(request, result);
    if (denied || result.status !== 'ok') return denied!;
    const role = result.session.role as string;
    if (!ADMIN_ROLES.includes(role)) {
      return redirectToRoleHome(request, role);
    }
    return NextResponse.next();
  }

  // Protected client routes
  if (pathname.startsWith('/client')) {
    const result = await readSessionFromRequest(request);
    const denied = requireSession(request, result);
    if (denied || result.status !== 'ok') return denied!;
    const role = result.session.role as string;
    if (role !== CLIENT_ROLE) {
      return redirectToRoleHome(request, role);
    }
    return NextResponse.next();
  }

  // Root — redirect based on session
  if (pathname === '/') {
    const result = await readSessionFromRequest(request);
    if (result.status === 'ok') {
      const role = result.session.role as string;
      if (ADMIN_ROLES.includes(role)) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      if (role === CLIENT_ROLE) {
        return NextResponse.redirect(new URL('/client', request.url));
      }
    }
    return redirectToLogin(request, undefined, result.status === 'invalid');
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/admin/:path*', '/client/:path*', '/verify/:path*'],
};
