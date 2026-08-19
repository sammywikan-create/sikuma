'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { checkRateLimit } from '@/lib/security/rate-limit';
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

  const normalizedEmail = email.trim().toLowerCase();

  // Pembatasan laju: maks 5 percobaan gagal per 15 menit per email
  const rateLimit = checkRateLimit(`login_${normalizedEmail}`, 5, 900000);
  if (!rateLimit.isAllowed) {
    return { error: 'Terlalu banyak percobaan masuk. Coba lagi dalam beberapa menit.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
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
  } else if (profile.role === 'penagihan') {
    redirect('/penagihan');
  } else {
    redirect('/dasbor');
  }

  return null;
}
