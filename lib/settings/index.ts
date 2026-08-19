/**
 * Himpunan kunci kanonik resmi untuk tabel app_settings SIKUMA.
 * DILARANG menambahkan atau membaca kunci app_settings di luar daftar ini secara ad-hoc.
 */
export const SETTING_KEYS = {
  TARGET_KUNJUNGAN_HARIAN: 'target_kunjungan_harian',
  TARGET_PENAGIHAN_HARIAN: 'target_penagihan_harian',
  JAM_BATAS_UNGGAH: 'jam_batas_unggah',
  RETENSI_FOTO_HARI: 'retensi_foto_hari',
  NAMA_APLIKASI: 'nama_aplikasi',
  NAMA_CABANG: 'nama_cabang',
  NAMA_KEPALA_CABANG: 'nama_kepala_cabang',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export interface AppSettings {
  target_kunjungan_harian: number;
  target_penagihan_harian: number;
  jam_batas_unggah: string;
  retensi_foto_hari: number;
  nama_aplikasi: string;
  nama_cabang: string;
  nama_kepala_cabang: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  target_kunjungan_harian: 4,
  target_penagihan_harian: 5,
  jam_batas_unggah: '21:00',
  retensi_foto_hari: 730,
  nama_aplikasi: 'SIKUMA - BANK BKK',
  nama_cabang: 'KANTOR CABANG UTAMA SEMARANG',
  nama_kepala_cabang: 'Budi Santoso, S.E.',
};

/**
 * Mengambil satu nilai pengaturan aplikasi dari tabel app_settings dengan fallback nilai default.
 */
export async function getSetting<T = unknown>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  key: SettingKey,
  defaultValue?: T
): Promise<T> {
  const fallback = (defaultValue !== undefined ? defaultValue : (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[key]) as T;

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error || !data || data.value === null || data.value === undefined) {
      return fallback;
    }

    let parsedVal = data.value;
    if (typeof parsedVal === 'string' && (parsedVal.startsWith('"') && parsedVal.endsWith('"'))) {
      try {
        parsedVal = JSON.parse(parsedVal);
      } catch {
        parsedVal = parsedVal.replace(/^"|"$/g, '');
      }
    }

    if (typeof fallback === 'number') {
      const num = Number(parsedVal);
      return (isNaN(num) ? fallback : num) as T;
    }

    return parsedVal as T;
  } catch (err) {
    console.error(`[SETTINGS] Gagal membaca setting "${key}":`, err);
    return fallback;
  }
}

/**
 * Mengambil seluruh pengaturan aplikasi sebagai objek bertipe AppSettings.
 */
export async function getAllSettings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<AppSettings> {
  const result: AppSettings = { ...DEFAULT_SETTINGS };

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value');

    if (error || !data) {
      return result;
    }

    for (const item of data) {
      let val = item.value;
      if (typeof val === 'string' && (val.startsWith('"') && val.endsWith('"'))) {
        try {
          val = JSON.parse(val);
        } catch {
          val = val.replace(/^"|"$/g, '');
        }
      }

      switch (item.key) {
        case SETTING_KEYS.TARGET_KUNJUNGAN_HARIAN:
          result.target_kunjungan_harian = Number(val) || DEFAULT_SETTINGS.target_kunjungan_harian;
          break;
        case SETTING_KEYS.TARGET_PENAGIHAN_HARIAN:
          result.target_penagihan_harian = Number(val) || DEFAULT_SETTINGS.target_penagihan_harian;
          break;
        case SETTING_KEYS.JAM_BATAS_UNGGAH:
          result.jam_batas_unggah = String(val || DEFAULT_SETTINGS.jam_batas_unggah);
          break;
        case SETTING_KEYS.RETENSI_FOTO_HARI:
          result.retensi_foto_hari = Number(val) || DEFAULT_SETTINGS.retensi_foto_hari;
          break;
        case SETTING_KEYS.NAMA_APLIKASI:
          result.nama_aplikasi = String(val || DEFAULT_SETTINGS.nama_aplikasi);
          break;
        case SETTING_KEYS.NAMA_CABANG:
          result.nama_cabang = String(val || DEFAULT_SETTINGS.nama_cabang);
          break;
        case SETTING_KEYS.NAMA_KEPALA_CABANG:
          result.nama_kepala_cabang = String(val || DEFAULT_SETTINGS.nama_kepala_cabang);
          break;
      }
    }
  } catch (err) {
    console.error('[SETTINGS] Gagal memuat semua pengaturan:', err);
  }

  return result;
}
