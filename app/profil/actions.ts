'use server';

import { createClient } from '@/lib/supabase/server';

export type PasswordFormState = {
  success?: boolean;
  error?: string;
} | null;

export async function changePasswordAction(
  prevState: PasswordFormState,
  formData: FormData
): Promise<PasswordFormState> {
  const currentPassword = formData.get('current_password') as string;
  const newPassword = formData.get('new_password') as string;
  const confirmPassword = formData.get('confirm_password') as string;

  // Validasi input
  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'Semua kolom wajib diisi.' };
  }

  if (newPassword.length < 8) {
    return { error: 'Password baru minimal 8 karakter.' };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'Konfirmasi password tidak cocok.' };
  }

  if (currentPassword === newPassword) {
    return { error: 'Password baru tidak boleh sama dengan password lama.' };
  }

  const supabase = await createClient();

  // Verifikasi user terautentikasi
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
  }

  // Re-authenticate: verifikasi password lama benar
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return { error: 'Password lama salah. Silakan coba lagi.' };
  }

  // Ganti password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: `Gagal mengubah password: ${updateError.message}` };
  }

  // Catat ke audit_log
  const { writeAuditLog } = await import('@/lib/audit/log');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await writeAuditLog(supabase as any, {
    actorId: user.id,
    action: 'password_changed',
    entity: 'profiles',
    entityId: user.id,
    payload: { email: user.email },
  });

  return { success: true };
}
