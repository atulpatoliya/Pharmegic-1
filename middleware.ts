import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'pharmegic_session';

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || 'pharmegic-fallback-secret-change-in-production';
  return new TextEncoder().encode(secret);
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'MASTER_ADMIN'];
const CLIENT_ROLE = 'CLIENT';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — always accessible
  if (
    pathname.startsWith('/verify') ||
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    // If logged in and visiting /login, redirect to dashboard
    if (pathname === '/login') {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      if (token) {
        try {
          const { payload } = await jwtVerify(token, getSecret());
          const role = payload.role as string;
          if (ADMIN_ROLES.includes(role)) {
            return NextResponse.redirect(new URL('/admin', request.url));
          }
          if (role === CLIENT_ROLE) {
            return NextResponse.redirect(new URL('/client', request.url));
          }
        } catch {
          // invalid token — let them see login
        }
      }
    }
    return NextResponse.next();
  }

  // Protected admin routes
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const role = payload.role as string;
      if (!ADMIN_ROLES.includes(role)) {
        return NextResponse.redirect(new URL('/login?error=Unauthorized', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // Protected client routes
  if (pathname.startsWith('/client')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const role = payload.role as string;
      if (role !== CLIENT_ROLE) {
        return NextResponse.redirect(new URL('/login?error=Unauthorized', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // Root — redirect based on session
  if (pathname === '/') {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, getSecret());
        const role = payload.role as string;
        if (ADMIN_ROLES.includes(role)) {
          return NextResponse.redirect(new URL('/admin', request.url));
        }
        if (role === CLIENT_ROLE) {
          return NextResponse.redirect(new URL('/client', request.url));
        }
      } catch {
        // bad token
      }
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/admin/:path*', '/client/:path*', '/verify/:path*'],
};
