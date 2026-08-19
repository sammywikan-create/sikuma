'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { writeAuditLog } from '@/lib/audit/log';
import { SETTING_KEYS, getAllSettings, type AppSettings } from '@/lib/settings';
import type { Profile } from '@/lib/types/database';

export async function updateSystemSettingsAction(newSettings: AppSettings) {
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
      .select('role, is_active, full_name')
      .eq('id', user.id)
      .single()) as { data: Pick<Profile, 'role' | 'is_active' | 'full_name'> | null };

    if (!profile || !profile.is_active || profile.role !== 'admin') {
      return { error: 'Akses ditolak. Hanya Administrator yang berhak mengubah pengaturan sistem.' };
    }

    // 1. Validasi Sisi Server dalam Bahasa Indonesia
    const targetKunjungan = Number(newSettings.target_kunjungan_harian);
    if (isNaN(targetKunjungan) || targetKunjungan < 1 || targetKunjungan > 20) {
      return { error: 'Target kunjungan harian harus berupa angka bulat antara 1 hingga 20.' };
    }

    const targetPenagihan = Number(newSettings.target_penagihan_harian);
    if (isNaN(targetPenagihan) || targetPenagihan < 1 || targetPenagihan > 20) {
      return { error: 'Target penagihan harian harus berupa angka bulat antara 1 hingga 20.' };
    }

    const jamBatas = String(newSettings.jam_batas_unggah || '').trim();
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(jamBatas)) {
      return { error: 'Format jam batas unggah harus berformat HH:MM 24 jam (misal 21:00).' };
    }

    const retensiHari = Number(newSettings.retensi_foto_hari);
    if (isNaN(retensiHari) || retensiHari < 30 || retensiHari > 3650) {
      return { error: 'Masa retensi foto harus antara 30 hingga 3650 hari (10 tahun).' };
    }

    const namaAplikasi = String(newSettings.nama_aplikasi || '').trim();
    if (!namaAplikasi || namaAplikasi.length < 3 || namaAplikasi.length > 100) {
      return { error: 'Nama aplikasi perbankan harus diisi (3 hingga 100 karakter).' };
    }

    const namaCabang = String(newSettings.nama_cabang || '').trim();
    if (!namaCabang || namaCabang.length < 3 || namaCabang.length > 100) {
      return { error: 'Nama kantor cabang harus diisi (3 hingga 100 karakter).' };
    }

    const namaKepalaCabang = String(newSettings.nama_kepala_cabang || '').trim();
    if (!namaKepalaCabang || namaKepalaCabang.length < 3 || namaKepalaCabang.length > 100) {
      return { error: 'Nama kepala cabang harus diisi (3 hingga 100 karakter).' };
    }

    const adminClient = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 2. Ambil nilai lama untuk perbandingan audit log
    const oldSettings = await getAllSettings(adminClient);

    const settingUpdates: { key: string; value: string | number; oldVal: string | number }[] = [
      {
        key: SETTING_KEYS.TARGET_KUNJUNGAN_HARIAN,
        value: targetKunjungan,
        oldVal: oldSettings.target_kunjungan_harian,
      },
      {
        key: SETTING_KEYS.TARGET_PENAGIHAN_HARIAN,
        value: targetPenagihan,
        oldVal: oldSettings.target_penagihan_harian,
      },
      {
        key: SETTING_KEYS.JAM_BATAS_UNGGAH,
        value: jamBatas,
        oldVal: oldSettings.jam_batas_unggah,
      },
      {
        key: SETTING_KEYS.RETENSI_FOTO_HARI,
        value: retensiHari,
        oldVal: oldSettings.retensi_foto_hari,
      },
      {
        key: SETTING_KEYS.NAMA_APLIKASI,
        value: namaAplikasi,
        oldVal: oldSettings.nama_aplikasi,
      },
      {
        key: SETTING_KEYS.NAMA_CABANG,
        value: namaCabang,
        oldVal: oldSettings.nama_cabang,
      },
      {
        key: SETTING_KEYS.NAMA_KEPALA_CABANG,
        value: namaKepalaCabang,
        oldVal: oldSettings.nama_kepala_cabang,
      },
    ];

    let changedCount = 0;

    for (const update of settingUpdates) {
      // Simpan hanya jika nilainya berubah
      if (String(update.value) !== String(update.oldVal)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: upsertErr } = await (adminClient as any)
          .from('app_settings')
          .upsert({
            key: update.key,
            value: typeof update.value === 'number' ? update.value : JSON.stringify(update.value),
            updated_at: new Date().toISOString(),
          });

        if (upsertErr) {
          console.error(`[SETTINGS] Gagal memperbarui kunci ${update.key}:`, upsertErr.message);
          return { error: `Gagal memperbarui "${update.key}": ${upsertErr.message}` };
        }

        // Catat ke audit_log
        await writeAuditLog(adminClient, {
          actorId: user.id,
          action: 'system_setting_updated',
          entity: 'app_settings',
          entityId: update.key,
          payload: {
            setting_key: update.key,
            old_value: update.oldVal,
            new_value: update.value,
            actor_name: profile.full_name,
          },
        });

        changedCount++;
      }
    }

    // 3. Revalidasi cache seluruh halaman yang menggunakan app_settings
    revalidatePath('/dasbor/pengaturan');
    revalidatePath('/dasbor');
    revalidatePath('/dasbor/anomali');
    revalidatePath('/dasbor/kinerja');
    revalidatePath('/kunjungan');
    revalidatePath('/penagihan');
    revalidatePath('/panduan');

    return {
      success: true,
      message:
        changedCount > 0
          ? `Berhasil memperbarui ${changedCount} pengaturan sistem.`
          : 'Tidak ada perubahan pengaturan yang disimpan.',
    };
  } catch (err: unknown) {
    console.error('[SETTINGS] Error pada updateSystemSettingsAction:', err);
    return { error: `Terjadi galat server: ${(err as Error).message}` };
  }
}
