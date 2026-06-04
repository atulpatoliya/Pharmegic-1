import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE, getAuthSecret } from '@/lib/auth/constants';

const ADMIN_ROLES = ['SUPER_ADMIN', 'MASTER_ADMIN'];
const CLIENT_ROLE = 'CLIENT';

function redirectToLogin(request: NextRequest, query?: string) {
  const path = query ? `/login?${query}` : '/login';
  const response = NextResponse.redirect(new URL(path, request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

async function readSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    return payload as { role?: string; userId?: string; email?: string };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
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
    const session = await readSessionFromRequest(request);
    if (!session) {
      return redirectToLogin(request);
    }
    const role = session.role as string;
    if (!ADMIN_ROLES.includes(role)) {
      return redirectToLogin(request, 'error=Unauthorized');
    }
    return NextResponse.next();
  }

  // Protected client routes
  if (pathname.startsWith('/client')) {
    const session = await readSessionFromRequest(request);
    if (!session) {
      return redirectToLogin(request);
    }
    const role = session.role as string;
    if (role !== CLIENT_ROLE) {
      return redirectToLogin(request, 'error=Unauthorized');
    }
    return NextResponse.next();
  }

  // Root — redirect based on session
  if (pathname === '/') {
    const session = await readSessionFromRequest(request);
    if (session) {
      const role = session.role as string;
      if (ADMIN_ROLES.includes(role)) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      if (role === CLIENT_ROLE) {
        return NextResponse.redirect(new URL('/client', request.url));
      }
    }
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/admin/:path*', '/client/:path*', '/verify/:path*'],
};
