'use client';

import { login } from '@/actions/auth';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { toast } from '@/store/toast';
import { Shield } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '';
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState(errorParam || '');
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
        
        // Refresh router state to update middleware cookies
        router.refresh();

        // Redirect based on role
        if (redirectTo) {
          router.push(redirectTo);
        } else if (res.role === 'MASTER_ADMIN' || res.role === 'STAFF') {
          router.push('/admin');
        } else {
          router.push('/client');
        }
      }
    });
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-white mb-3 shadow-md">
          <Shield className="h-6 w-6 text-accent" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Pharmegic Portal</h2>
        <p className="text-sm text-slate-500 text-center mt-1">
          Compliance and Tonnage Compliance Certificate Registry
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-lg bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-600">
          {errorMsg}
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          type="email"
          label="Corporate Email"
          placeholder="officer@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          required
        />

        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Secure Password
            </span>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
            >
              Forgot?
            </Link>
          </div>
          <input
            type="password"
            placeholder="••••••••"
            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
            required
          />
        </div>

        <Button type="submit" className="w-full" isLoading={isPending}>
          Authenticate Session
        </Button>
      </form>

      {/* Info Panel */}
      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        <span className="text-xs text-slate-400 font-medium">
          Protected Compliance System
        </span>
      </div>
    </div>
  );
}
