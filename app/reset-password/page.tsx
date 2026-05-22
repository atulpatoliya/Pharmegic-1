'use client';

import { resetPassword } from '@/actions/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/store/toast';
import { Shield, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password !== confirmPassword) {
      setErrorMsg("Passwords don't match.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    const formData = new FormData();
    formData.append('password', password);
    formData.append('confirmPassword', confirmPassword);

    startTransition(async () => {
      const res = await resetPassword(null, formData);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to reset password.');
        toast.error(res.error || 'Reset failed.');
      } else {
        setIsSuccess(true);
        toast.success('Password updated successfully!');
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 bg-linear-to-tr from-slate-900 via-slate-800 to-primary">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(16,185,129,0.1),transparent)] pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-white mb-3 shadow-md">
            <Shield className="h-6 w-6 text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Configure Password</h2>
          <p className="text-sm text-slate-500 text-center mt-1">
            Establish new password credentials for your account
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-lg bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-600">
            {errorMsg}
          </div>
        )}

        {isSuccess ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
            </div>
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700">
              Your password has been successfully configured. You may now sign in using your new credentials.
            </div>
            <Link
              href="/login"
              className="block w-full text-center bg-primary text-white rounded-md h-10 flex items-center justify-center text-sm font-semibold hover:bg-primary-hover transition-colors"
            >
              Sign In to Dashboard
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              type="password"
              label="New Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              required
            />

            <Input
              type="password"
              label="Confirm New Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isPending}
              required
            />

            <Button type="submit" className="w-full" isLoading={isPending}>
              Update Credentials
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
