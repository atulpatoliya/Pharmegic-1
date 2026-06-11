import { redirect } from 'next/navigation';
import type { SessionPayload } from '@/lib/auth/session';

export function redirectToLoginPage(error?: string): never {
  redirect(error ? `/login?error=${error}` : '/login');
}

export function redirectToRoleHome(role: SessionPayload['role']): never {
  if (role === 'MASTER_ADMIN' || role === 'SUPER_ADMIN') {
    redirect('/admin');
  }
  if (role === 'CLIENT') {
    redirect('/client');
  }
  redirectToLoginPage('Unauthorized');
}
