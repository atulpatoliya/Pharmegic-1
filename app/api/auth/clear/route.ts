import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';
import { SESSION_COOKIE_OPTIONS } from '@/lib/auth/cookie-options';

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get('error');
  const loginUrl = new URL('/login', request.url);
  if (error) loginUrl.searchParams.set('error', error);

  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete({ name: SESSION_COOKIE, path: SESSION_COOKIE_OPTIONS.path });
  return response;
}
