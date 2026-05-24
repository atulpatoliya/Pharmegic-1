'use server';

import { createClient } from '@/lib/supabase/server';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

export async function login(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const result = loginSchema.safeParse({ email, password });
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0].message,
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  const authRole = data.user.user_metadata?.role || 'CLIENT';
  let role = authRole;

  // Get user profile from public users table to ensure user session is synced
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    // Self-healing: insert the profile using admin client (bypasses RLS since row is missing)
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminSupabase = createAdminClient();
    const { error: insertError } = await adminSupabase
      .from('users')
      .insert({
        id: data.user.id,
        email: data.user.email,
        role: authRole,
      });

    if (insertError) {
      console.error('[AUTH PROFILE RECREATION ERROR]:', insertError);
    }
  } else {
    role = profile.role;
  }

  // Force session sync in user metadata if not already there
  if (data.user.user_metadata?.role !== role) {
    await supabase.auth.updateUser({
      data: { role },
    });
  }

  return {
    success: true,
    role,
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function forgotPassword(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;

  const result = forgotPasswordSchema.safeParse({ email });
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0].message,
    };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
    message: 'Password reset link has been sent to your email.',
  };
}

export async function resetPassword(prevState: any, formData: FormData) {
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  const result = resetPasswordSchema.safeParse({ password, confirmPassword });
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0].message,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
    message: 'Your password has been successfully reset.',
  };
}
