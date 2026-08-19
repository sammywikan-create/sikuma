'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { writeAuditLog } from '@/lib/audit/log';
import type { VerificationStatus, Profile, UserRole } from '@/lib/types/database';

export async function verifyVisitAction(
  visitId: string,
  status: VerificationStatus,
  verifierNote?: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Sesi Anda telah berakhir.' };
  }

  const { data: profile } = (await supabase
    .from('profiles')
    .select('role, is_active, full_name')
    .eq('id', user.id)
    .single()) as { data: Pick<Profile, 'role' | 'is_active' | 'full_name'> | null };

  if (!profile || !profile.is_active || (profile.role !== 'kacab' && profile.role !== 'admin')) {
    return { error: 'Hanya Kepala Cabang atau Admin yang berhak melakukan verifikasi.' };
  }

  const now = new Date().toISOString();

  // 1. Update kolom verifikasi pada tabel visits (RLS mengizinkan update kolom ini)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase as any)
    .from('visits')
    .update({
      verification_status: status,
      verified_by: user.id,
      verified_at: now,
      verifier_note: verifierNote?.trim() || null,
    })
    .eq('id', visitId);

  if (updateErr) {
    return { error: `Gagal memperbarui status: ${updateErr.message}` };
  }

  // 2. Catat ke tabel audit_log
  const actionName = status === 'verified' ? 'visit_verified' : 'visit_rejected';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await writeAuditLog(supabase as any, {
    actorId: user.id,
    action: actionName,
    entity: 'visits',
    entityId: visitId,
    payload: {
      status,
      verifier_name: profile.full_name,
      verifier_role: profile.role,
      verifier_note: verifierNote?.trim() || null,
      timestamp: now,
    },
  });

  revalidatePath('/dasbor');
  revalidatePath('/dasbor/anomali');
  revalidatePath('/kunjungan');

  return { success: true };
}

export async function createMarketingUserAction(payload: {
  email: string;
  password?: string;
  full_name: string;
  marketing_code: string;
  role: UserRole;
}) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    const { data: profile } = (await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()) as { data: Pick<Profile, 'role'> | null };

    if (!profile || (profile.role !== 'admin' && profile.role !== 'kacab')) {
      return { error: 'Hanya Kepala Cabang atau Admin yang berhak menambah pengguna baru.' };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return {
        error:
          'Kunci SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di Environment Variables server.',
      };
    }

    const adminClient = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const emailTrimmed = payload.email.trim().toLowerCase();
    const codeTrimmed = payload.marketing_code?.trim().toUpperCase() || null;

    // Cek apakah kode petugas sudah dipakai
    if (codeTrimmed) {
      const { data: existingCode } = await adminClient
        .from('profiles')
        .select('marketing_code')
        .eq('marketing_code', codeTrimmed)
        .maybeSingle();

      if (existingCode) {
        return { error: `Kode petugas "${codeTrimmed}" sudah digunakan oleh staf lain.` };
      }
    }

    const password = payload.password?.trim() || crypto.randomUUID().slice(0, 16) + '!A';

    // 1. Buat auth user di Supabase Auth
    const { data: newAuthUser, error: authErr } = await adminClient.auth.admin.createUser({
      email: emailTrimmed,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.full_name.trim(),
        role: payload.role,
      },
    });

    if (authErr || !newAuthUser?.user) {
      return {
        error: `Gagal membuat akun: ${authErr?.message || 'Email mungkin sudah terdaftar.'}`,
      };
    }

    // 2. Buat profil di tabel profiles
    const { error: profileErr } = await adminClient.from('profiles').insert({
      id: newAuthUser.user.id,
      full_name: payload.full_name.trim(),
      marketing_code: codeTrimmed,
      role: payload.role,
      is_active: true,
    });

    if (profileErr) {
      // Bersihkan user auth jika pembuatan profil gagal
      await adminClient.auth.admin.deleteUser(newAuthUser.user.id);
      return { error: `Gagal menyimpan profil: ${profileErr.message}` };
    }

    // 3. Catat audit_log (adminClient dipakai karena policy actor_id = auth.uid()
    //    dan adminClient bypass RLS)
    const { error: auditErr } = await adminClient.from('audit_log').insert({
      actor_id: user.id,
      action: 'user_created',
      entity: 'profiles',
      entity_id: newAuthUser.user.id,
      payload: {
        email: emailTrimmed,
        full_name: payload.full_name.trim(),
        marketing_code: codeTrimmed,
        role: payload.role,
        created_by_role: profile.role,
      },
    });

    if (auditErr) {
      console.error(`[AUDIT] Gagal menulis log user_created: ${auditErr.message}`);
    }

    revalidatePath('/dasbor/pengguna');
    return { success: true, generatedPassword: password };
  } catch (err: unknown) {
    console.error('Error in createMarketingUserAction:', err);
    return { error: `Terjadi galat server: ${(err as Error).message}` };
  }
}

export async function toggleUserStatusAction(userId: string, currentStatus: boolean) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Sesi Anda telah berakhir.' };
    }

    const { data: profile } = (await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()) as { data: Pick<Profile, 'role'> | null };

    if (!profile || (profile.role !== 'admin' && profile.role !== 'kacab')) {
      return { error: 'Hanya Kepala Cabang atau Admin yang berhak mengubah status akun.' };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return {
        error:
          'Kunci SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di Environment Variables server.',
      };
    }

    const adminClient = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Cegah penonaktifan akun Kepala Cabang dan Admin
    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (targetProfile && (targetProfile.role === 'kacab' || targetProfile.role === 'admin') && currentStatus) {
      return {
        error: 'Akun Kepala Cabang dan Administrator tidak dapat dinonaktifkan demi keamanan operasional sistem.',
      };
    }

    const newStatus = !currentStatus;

    const { error: updateErr } = await adminClient
      .from('profiles')
      .update({ is_active: newStatus })
      .eq('id', userId);

    if (updateErr) {
      return { error: `Gagal mengubah status pengguna: ${updateErr.message}` };
    }

    const { error: auditErr } = await adminClient.from('audit_log').insert({
      actor_id: user.id,
      action: newStatus ? 'user_activated' : 'user_deactivated',
      entity: 'profiles',
      entity_id: userId,
      payload: { is_active: newStatus },
    });

    if (auditErr) {
      console.error(`[AUDIT] Gagal menulis log toggle status: ${auditErr.message}`);
    }

    revalidatePath('/dasbor/pengguna');
    return { success: true };
  } catch (err: unknown) {
    console.error('Error in toggleUserStatusAction:', err);
    return { error: `Terjadi galat server: ${(err as Error).message}` };
  }
}

export async function resetUserPasswordAction(userId: string, newPassword?: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Sesi Anda telah berakhir.' };
    }

    const { data: profile } = (await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()) as { data: Pick<Profile, 'role' | 'full_name'> | null };

    if (!profile || (profile.role !== 'admin' && profile.role !== 'kacab')) {
      return { error: 'Hanya Kepala Cabang atau Admin yang berhak mereset kata sandi pengguna.' };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return {
        error: 'Kunci SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.',
      };
    }

    const adminClient = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const password = newPassword?.trim() || crypto.randomUUID().slice(0, 16) + '!A';

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(userId, {
      password: password,
    });

    if (updateErr) {
      return { error: `Gagal mereset kata sandi: ${updateErr.message}` };
    }

    // Catat ke audit_log
    const { error: auditErr } = await adminClient.from('audit_log').insert({
      actor_id: user.id,
      action: 'user_password_reset',
      entity: 'profiles',
      entity_id: userId,
      payload: {
        reset_by_name: profile.full_name,
        reset_by_role: profile.role,
      },
    });

    if (auditErr) {
      console.error(`[AUDIT] Gagal menulis log user_password_reset: ${auditErr.message}`);
    }

    return { success: true, newPassword: password };
  } catch (err: unknown) {
    console.error('Error in resetUserPasswordAction:', err);
    return { error: `Terjadi galat server: ${(err as Error).message}` };
  }
}

/**
 * Mengambil 1 detail kunjungan lengkap beserta signed URL fotonya on-demand saat modal dibuka
 */
export async function getVisitDetailAction(visitId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Sesi Anda telah berakhir.' };
    }

    const { data: profile } = (await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()) as { data: Pick<Profile, 'role'> | null };

    if (!profile) {
      return { error: 'Profil tidak ditemukan.' };
    }

    const adminClient = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const client = profile.role === 'kacab' || profile.role === 'admin' ? adminClient : supabase;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: visit, error: visitErr } = await (client as any)
      .from('visits')
      .select(`
        *,
        marketing:profiles!marketing_id (full_name, marketing_code),
        visit_photos (*)
      `)
      .eq('id', visitId)
      .maybeSingle();

    if (visitErr || !visit) {
      return { error: 'Data kunjungan tidak ditemukan.' };
    }

    if (profile.role === 'marketing' || profile.role === 'penagihan') {
      if (visit.marketing_id !== user.id) {
        return { error: 'Akses ditolak.' };
      }
    }

    // Buat signed URL (berlaku 1 jam) untuk setiap foto secara paralel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photosWithSignedUrls = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (visit.visit_photos || []).map(async (photo: any) => {
        if (!photo.storage_path) return { ...photo, signedUrl: null };
        const { data: signed } = await adminClient.storage
          .from('kunjungan')
          .createSignedUrl(photo.storage_path, 3600);
        return {
          ...photo,
          signedUrl: signed?.signedUrl || null,
        };
      })
    );

    return {
      data: {
        ...visit,
        visit_photos: photosWithSignedUrls,
      },
    };
  } catch (err: unknown) {
    console.error('Error in getVisitDetailAction:', err);
    return { error: `Gagal memuat detail foto: ${(err as Error).message}` };
  }
}

