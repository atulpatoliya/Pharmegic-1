'use client';

import { login } from '@/actions/auth';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { toast } from '@/store/toast';
import { Shield, Lock, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '';
  const errorParam = searchParams.get('error');
  const initialError =
    errorParam === 'SessionExpired'
      ? 'Your session expired. Please sign in again.'
      : errorParam === 'Unauthorized'
        ? 'You are not authorized to access that area.'
        : errorParam || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState(initialError);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);

    startTransition(async () => {
      const res = await login(null, formData);
      if (!res.success) {
        setErrorMsg(res.error || 'Invalid credentials.');
        toast.error(res.error || 'Login failed.');
      } else {
        toast.success('Successfully logged in!');
        router.refresh();

        if (redirectTo) {
          router.push(redirectTo);
        } else if (res.role === 'MASTER_ADMIN' || res.role === 'SUPER_ADMIN') {
          router.push('/admin');
        } else {
          router.push('/client');
        }
      }
    });
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8" suppressHydrationWarning>

      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-white mb-4 shadow-lg">
          <Shield className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Pharmegic Portal</h1>
        <p className="text-sm text-slate-500 text-center mt-1.5 font-medium">
          Compliance &amp; TCC Certificate Management System
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-600 flex items-start gap-2">
          <span className="text-rose-400 mt-0.5">⚠</span>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="w-full flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-slate-400" /> Corporate Email
          </label>
          <input
            type="email"
            id="login-email"
            placeholder="officer@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            required
            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          />
        </div>

        <div className="w-full flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-slate-400" /> Password
          </label>
          <input
            type="password"
            id="login-password"
            placeholder="••••••••"
            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
            required
          />
        </div>

        <Button type="submit" id="login-submit" className="w-full h-11 text-sm font-bold" isLoading={isPending}>
          Authenticate Session
        </Button>
      </form>
    </div>
  );
}
