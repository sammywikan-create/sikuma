'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
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
  const visitsTable = supabase.from('visits') as unknown as {
    update: (data: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error: updateErr } = await visitsTable
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
  const auditTable = supabase.from('audit_log') as unknown as {
    insert: (data: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };

  await auditTable.insert({
    actor_id: user.id,
    action: actionName,
    entity: 'visits',
    entity_id: visitId,
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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Sesi berakhir.' };
  }

  const { data: profile } = (await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()) as { data: Pick<Profile, 'role'> | null };

  if (!profile || profile.role !== 'admin') {
    return { error: 'Hanya Admin yang dapat menambah pengguna baru.' };
  }

  const adminClient = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const password = payload.password || 'Password123!';

  // 1. Buat auth user
  const { data: newAuthUser, error: authErr } = await adminClient.auth.admin.createUser({
    email: payload.email.trim(),
    password: password.trim(),
    email_confirm: true,
  });

  if (authErr || !newAuthUser.user) {
    return { error: `Gagal membuat akun auth: ${authErr?.message || 'Error'}` };
  }

  // 2. Buat profil di tabel profiles
  const { error: profileErr } = await adminClient.from('profiles').insert({
    id: newAuthUser.user.id,
    full_name: payload.full_name.trim(),
    marketing_code: payload.marketing_code.trim().toUpperCase() || null,
    role: payload.role,
    is_active: true,
  });

  if (profileErr) {
    return { error: `Gagal membuat data profil: ${profileErr.message}` };
  }

  // 3. Catat audit_log
  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'user_created',
    entity: 'profiles',
    entity_id: newAuthUser.user.id,
    payload: {
      email: payload.email,
      full_name: payload.full_name,
      marketing_code: payload.marketing_code,
      role: payload.role,
    },
  });

  revalidatePath('/dasbor/pengguna');
  return { success: true };
}

export async function toggleUserStatusAction(userId: string, currentStatus: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Sesi berakhir.' };
  }

  const { data: profile } = (await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()) as { data: Pick<Profile, 'role'> | null };

  if (!profile || profile.role !== 'admin') {
    return { error: 'Hanya Admin yang dapat mengubah status akun.' };
  }

  const adminClient = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const newStatus = !currentStatus;

  const { error: updateErr } = await adminClient
    .from('profiles')
    .update({ is_active: newStatus })
    .eq('id', userId);

  if (updateErr) {
    return { error: `Gagal mengubah status pengguna: ${updateErr.message}` };
  }

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: newStatus ? 'user_activated' : 'user_deactivated',
    entity: 'profiles',
    entity_id: userId,
    payload: { is_active: newStatus },
  });

  revalidatePath('/dasbor/pengguna');
  return { success: true };
}
