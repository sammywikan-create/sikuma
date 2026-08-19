'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateSystemSettingsAction } from './actions';
import type { AppSettings } from '@/lib/settings';

interface PengaturanViewProps {
  initialSettings: AppSettings;
}

export default function PengaturanView({ initialSettings }: PengaturanViewProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<AppSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await updateSystemSettingsAction(formData);

      if (res.error) {
        setFeedback({ type: 'error', message: res.error });
      } else {
        setFeedback({
          type: 'success',
          message: res.message || 'Pengaturan sistem berhasil disimpan.',
        });
        router.refresh();
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: `Galat tidak terduga: ${(err as Error).message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 pb-16">
      {/* Banner Informasi Header */}
      <div className="p-4 bg-gradient-to-r from-bkk-900 to-bkk-800 text-white rounded-2xl shadow-md space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚙️</span>
          <h2 className="text-base font-bold">Konfigurasi Parameter Sistem SIKUMA</h2>
        </div>
        <p className="text-xs text-slate-300">
          Kelola parameter operasional perbankan, aturan batas unggah, target harian petugas, dan identitas laporan cabang. Seluruh perubahan akan otomatis tercatat pada log audit sistem.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{feedback.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Grup 1: Target Kinerja Harian Petugas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900">
              🎯 Target Kinerja Harian Petugas Lapangan
            </h3>
            <p className="text-xs text-slate-500">
              Menentukan kuota kunjungan minimal per hari kerja untuk kalkulasi progress bar.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Kunjungan Marketing */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Target Kunjungan Harian Marketing
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={formData.target_kunjungan_harian}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      target_kunjungan_harian: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-bkk-500"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold">
                  Kunjungan / hari
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                💡 Mengubah target ini akan langsung memengaruhi progress bar dan persentase capaian pada halaman aplikasi Marketing.
              </p>
            </div>

            {/* Target Penagihan AO */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Target Penagihan Harian Petugas AO
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={formData.target_penagihan_harian}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      target_penagihan_harian: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-bkk-500"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold">
                  Debitur / hari
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                💡 Mengubah target ini akan langsung memengaruhi target harian pada halaman aplikasi Petugas Penagihan (AO).
              </p>
            </div>
          </div>
        </div>

        {/* Grup 2: Batas Waktu & Retensi Foto */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900">
              🕒 Batas Waktu Unggah &amp; Retensi Foto
            </h3>
            <p className="text-xs text-slate-500">
              Aturan integritas waktu kirim dan periode penyimpanan arsip foto kunjungan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Jam Batas Unggah WIB */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Jam Batas Unggah Laporan (WIB)
              </label>
              <input
                type="time"
                required
                value={formData.jam_batas_unggah}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    jam_batas_unggah: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-bkk-500"
              />
              <p className="text-[11px] text-slate-500 leading-tight">
                💡 Mengubah jam batas akan memengaruhi penandaan Terlambat Kirim untuk kunjungan berikutnya, dan tidak mengubah penandaan kunjungan yang sudah tersimpan. Halaman panduan akan membaca nilai ini secara otomatis.
              </p>
            </div>

            {/* Masa Retensi Foto Hari */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Masa Retensi Foto Kunjungan
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={30}
                  max={3650}
                  required
                  value={formData.retensi_foto_hari}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      retensi_foto_hari: parseInt(e.target.value, 10) || 730,
                    })
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-bkk-500"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold">
                  Hari ({Math.round(formData.retensi_foto_hari / 30)} Bulan)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                💡 Foto kunjungan yang lebih lama dari jumlah hari ini akan memenuhi syarat untuk pembersihan otomatis/manual pada halaman Retensi Data.
              </p>
            </div>
          </div>
        </div>

        {/* Grup 3: Identitas Aplikasi & Pejabat Cabang */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900">
              🏢 Identitas Aplikasi &amp; Penandatangan Laporan
            </h3>
            <p className="text-xs text-slate-500">
              Teks kop surat dan tanda tangan yang tertera pada lembar laporan resmi PDF.
            </p>
          </div>

          <div className="space-y-3">
            {/* Nama Aplikasi */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800">
                Nama Aplikasi Resmi
              </label>
              <input
                type="text"
                required
                value={formData.nama_aplikasi}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nama_aplikasi: e.target.value,
                  })
                }
                placeholder="misal SIKUMA - BANK BKK"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-bkk-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Nama Kantor Cabang */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">
                  Nama Kantor Cabang
                </label>
                <input
                  type="text"
                  required
                  value={formData.nama_cabang}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nama_cabang: e.target.value,
                    })
                  }
                  placeholder="misal KANTOR CABANG UTAMA SEMARANG"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-bkk-500"
                />
              </div>

              {/* Nama Kepala Cabang */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">
                  Nama Pejabat Kepala Cabang
                </label>
                <input
                  type="text"
                  required
                  value={formData.nama_kepala_cabang}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nama_kepala_cabang: e.target.value,
                    })
                  }
                  placeholder="misal Budi Santoso, S.E."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-bkk-500"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              💡 Nama kantor cabang dan kepala cabang di atas akan secara otomatis dicetak pada lembar cover, rekapitulasi, dan lembar tanda tangan dokumen PDF.
            </p>
          </div>
        </div>

        {/* Tombol Simpan */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-bkk-700 hover:bg-bkk-800 active:bg-bkk-900 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Menyimpan Pengaturan...
              </>
            ) : (
              '💾 Simpan Seluruh Pengaturan'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
