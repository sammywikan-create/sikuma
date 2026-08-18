'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import type { Profile, VisitPhoto, Visit } from '@/lib/types/database';

export async function cleanExpiredPhotosAction() {
  const supabase = await createClient();

  // 1. Verifikasi Admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Sesi berakhir.' };
  }

  const { data: profile } = (await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()) as { data: Pick<Profile, 'role' | 'full_name'> | null };

  if (!profile || profile.role !== 'admin') {
    return { error: 'Hanya Administrator yang berhak menjalankan retensi data foto.' };
  }

  const adminClient = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 2. Ambil Setting Retensi Hari
  const { data: settingRaw } = (await adminClient
    .from('app_settings')
    .select('value')
    .eq('key', 'retensi_foto_hari')
    .maybeSingle()) as { data: { value: unknown } | null };

  const retentionDays = Number(settingRaw?.value) || 180;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // 3. Cari Foto Kedaluwarsa
  const { data: expiredPhotosRaw } = (await adminClient
    .from('visit_photos')
    .select(`
      id,
      storage_path,
      bytes,
      visits!inner (
        id,
        captured_at
      )
    `)
    .not('storage_path', 'is', null)
    .lt('visits.captured_at', cutoffDate.toISOString())) as {
    data: (Pick<VisitPhoto, 'id' | 'storage_path' | 'bytes'> & {
      visits: Pick<Visit, 'id' | 'captured_at'>;
    })[] | null;
  };

  const expiredPhotos = expiredPhotosRaw || [];

  if (expiredPhotos.length === 0) {
    return {
      success: true,
      message: `Tidak ada foto yang lebih tua dari ${retentionDays} hari (${cutoffDate.toLocaleDateString('id-ID')}).`,
      deletedCount: 0,
      reclaimedBytes: 0,
    };
  }

  // 4. Hapus Berkas dari Storage Bucket
  const filePaths = expiredPhotos
    .map((p) => p.storage_path)
    .filter((p): p is string => Boolean(p));

  const totalBytes = expiredPhotos.reduce((acc, p) => acc + (p.bytes || 0), 0);

  if (filePaths.length > 0) {
    const { error: removeErr } = await adminClient.storage
      .from('kunjungan')
      .remove(filePaths);

    if (removeErr) {
      console.warn('Peringatan penghapusan berkas storage:', removeErr.message);
    }
  }

  // 5. Update Record visit_photos (Set storage_path = null, data kunjungan tetap utuh)
  const photoIds = expiredPhotos.map((p) => p.id);
  const { error: updateErr } = await adminClient
    .from('visit_photos')
    .update({ storage_path: null })
    .in('id', photoIds);

  if (updateErr) {
    return { error: `Gagal memperbarui status database: ${updateErr.message}` };
  }

  // 6. Catat ke Audit Log
  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'photo_retention_cleanup',
    entity: 'visit_photos',
    entity_id: null,
    payload: {
      deleted_photos_count: expiredPhotos.length,
      reclaimed_bytes: totalBytes,
      retention_days: retentionDays,
      cutoff_date: cutoffDate.toISOString(),
      admin_name: profile.full_name,
      timestamp: new Date().toISOString(),
    },
  });

  revalidatePath('/dasbor/retensi');
  revalidatePath('/dasbor');

  return {
    success: true,
    deletedCount: expiredPhotos.length,
    reclaimedBytes: totalBytes,
    message: `Pembersihan berhasil! ${expiredPhotos.length} foto (${(
      totalBytes /
      (1024 * 1024)
    ).toFixed(1)} MB) berhasil dihapus dari storage.`,
  };
}
