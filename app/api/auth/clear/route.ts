import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get('error');
  const loginUrl = new URL('/login', request.url);
  if (error) loginUrl.searchParams.set('error', error);

  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
