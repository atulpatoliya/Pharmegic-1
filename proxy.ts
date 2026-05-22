import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const path = url.pathname;

  // Static files, api routes, and public files should bypass proxy routing logic
  if (
    path.startsWith('/_next') ||
    path.startsWith('/static') ||
    path.startsWith('/favicon.ico') ||
    path.startsWith('/api/') ||
    path.startsWith('/verify/') // public PDF verification route
  ) {
    return response;
  }

  // Auth pages (Login, Forgot, Reset Password)
  const isAuthPage =
    path === '/login' ||
    path === '/forgot-password' ||
    path === '/reset-password';

  if (isAuthPage) {
    if (user) {
      const role = user.user_metadata?.role || 'CLIENT';
      if (role === 'MASTER_ADMIN' || role === 'STAFF') {
        return NextResponse.redirect(new URL('/admin', request.url));
      } else {
        return NextResponse.redirect(new URL('/client', request.url));
      }
    }
    return response;
  }

  // Protected paths
  const isAdminRoute = path.startsWith('/admin');
  const isClientRoute = path.startsWith('/client');

  if (isAdminRoute || isClientRoute) {
    if (!user) {
      // Redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', path);
      return NextResponse.redirect(loginUrl);
    }

    const role = user.user_metadata?.role || 'CLIENT';

    if (isAdminRoute && role !== 'MASTER_ADMIN' && role !== 'STAFF') {
      return NextResponse.redirect(new URL('/login?error=Unauthorized', request.url));
    }

    if (isClientRoute && role !== 'CLIENT') {
      return NextResponse.redirect(new URL('/login?error=Unauthorized', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
