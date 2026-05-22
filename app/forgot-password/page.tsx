'use client';

import { forgotPassword } from '@/actions/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/store/toast';
import { Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    const formData = new FormData();
    formData.append('email', email);

    startTransition(async () => {
      const res = await forgotPassword(null, formData);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to request reset.');
        toast.error(res.error || 'Request failed.');
      } else {
        setIsSubmitted(true);
        toast.success('Password reset link sent!');
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
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Forgot Password</h2>
          <p className="text-sm text-slate-500 text-center mt-1">
            Provide your email to receive a recovery link
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-lg bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-600">
            {errorMsg}
          </div>
        )}

        {isSubmitted ? (
          <div className="text-center space-y-6">
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700">
              A recovery link has been dispatched to your corporate email. Please check your inbox and spam folders.
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              type="email"
              label="Corporate Email Address"
              placeholder="officer@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              required
            />

            <Button type="submit" className="w-full" isLoading={isPending}>
              Dispatch Recovery Link
            </Button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
