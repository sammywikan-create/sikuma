'use client';

import { useState } from 'react';
import { cleanExpiredPhotosAction } from './actions';

interface RetensiViewProps {
  retentionDays: number;
  totalPhotosCount: number;
  expiredPhotosCount: number;
  expiredBytes: number;
}

export default function RetensiView({
  retentionDays,
  totalPhotosCount,
  expiredPhotosCount,
  expiredBytes,
}: RetensiViewProps) {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [confirmText, setConfirmText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExecuteCleanup = async () => {
    if (confirmText.trim() !== 'HAPUS') {
      setErrorMessage("Ketik teks 'HAPUS' secara tepat untuk konfirmasi.");
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setResultMessage(null);

      const res = await cleanExpiredPhotosAction();

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setResultMessage(res.message || 'Pembersihan foto berhasil diselesaikan.');
        setIsModalOpen(false);
        setConfirmText('');
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const expiredMB = (expiredBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Header Info Kebijakan */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🗄️</span>
            <h2 className="text-sm font-bold">Kebijakan Retensi Berkas Foto</h2>
          </div>
          <span className="px-2.5 py-0.5 bg-bkk-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
            {retentionDays} Hari
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Penyimpanan foto di Storage dibersihkan secara berkala untuk menjaga efisiensi ruang server. Seluruh riwayat tekstual, nama nasabah, koordinat, dan laporan kunjungan di database <strong>tetap tersimpan utuh selamanya</strong>.
        </p>
      </div>

      {/* 2. Kartu Metrik Kapasitas */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 block">
            Total Berkas Foto Aktif
          </span>
          <span className="text-xl font-black text-slate-900 mt-1 block">
            {totalPhotosCount} Foto
          </span>
          <span className="text-[10px] text-slate-400">Dalam storage Supabase</span>
        </div>

        <div className="p-3.5 bg-white border border-amber-200 rounded-2xl shadow-sm bg-amber-50/50">
          <span className="text-[11px] font-semibold text-amber-900 block">
            Foto Melewati Batas ({retentionDays} Hari)
          </span>
          <span className="text-xl font-black text-amber-700 mt-1 block">
            {expiredPhotosCount} Foto
          </span>
          <span className="text-[10px] text-amber-800">
            Estimasi ruang: ~{expiredMB} MB
          </span>
        </div>
      </div>

      {/* 3. Feedback Notifikasi */}
      {resultMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <span>✓</span>
          <span>{resultMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 4. Panel Tindakan Pembersihan Manual */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Tindakan Pembersihan Terkendali
        </h3>
        <p className="text-xs text-slate-500">
          Pembersihan <strong>tidak dijalankan otomatis</strong> oleh background worker, melainkan memerlukan keputusan manual Administrator demi keamanan arsip perbankan. Setiap eksekusi akan diverifikasi ganda dan dicatat ke dalam audit log.
        </p>

        <button
          type="button"
          onClick={() => {
            setConfirmText('');
            setErrorMessage(null);
            setIsModalOpen(true);
          }}
          disabled={expiredPhotosCount === 0}
          className="w-full min-h-[44px] bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>🗑️</span> Bersihkan Foto Kedaluwarsa Sekarang
        </button>
      </div>

      {/* 5. Modal Konfirmasi Ganda */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-red-600 text-lg font-bold">⚠️</span>
                <h3 className="text-sm font-bold text-slate-900">
                  Konfirmasi Pembersihan Foto
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-xs font-semibold px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <p>
                Anda akan menghapus secara permanen <strong className="text-red-700">{expiredPhotosCount} berkas fisik foto</strong> dari storage bucket yang umurnya lebih dari {retentionDays} hari.
              </p>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500">
                ℹ️ Catatan kunjungan, nama nasabah, koordinat, dan laporan tekstual akan tetap tersimpan aman di database.
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="block text-[11px] font-bold text-slate-700">
                Ketik <span className="text-red-600 select-all font-mono">&quot;HAPUS&quot;</span> di bawah untuk melanjutkan:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="HAPUS"
                className="w-full min-h-[42px] px-3 py-2 border border-red-300 rounded-xl bg-red-50/40 text-xs font-mono font-bold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batalkan
              </button>
              <button
                type="button"
                disabled={confirmText.trim() !== 'HAPUS' || isProcessing}
                onClick={handleExecuteCleanup}
                className="min-h-[44px] bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center cursor-pointer"
              >
                {isProcessing ? 'Menghapus...' : 'Eksekusi Pembersihan ✓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
