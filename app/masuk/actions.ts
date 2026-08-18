'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Profile } from '@/lib/types/database';

export type FormState = {
  error?: string;
} | null;

export async function loginAction(prevState: FormState, formData: FormData): Promise<FormState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email dan kata sandi wajib diisi.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: password.trim(),
  });

  if (error || !data.user) {
    return { error: 'Email atau kata sandi tidak valid. Silakan coba lagi.' };
  }

  // Ambil profil untuk menentukan peran pengguna
  const { data: profile, error: profileError } = (await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle()) as { data: Pick<Profile, 'role' | 'is_active'> | null; error: unknown };

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { error: 'Akun Anda belum terdaftar di sistem profil. Hubungi Admin.' };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return { error: 'Akun Anda dinonaktifkan. Hubungi Kepala Cabang atau Admin.' };
  }

  // Pengalihan berdasarkan peran
  if (profile.role === 'marketing') {
    redirect('/kunjungan');
  } else {
    redirect('/dasbor');
  }

  return null;
}
