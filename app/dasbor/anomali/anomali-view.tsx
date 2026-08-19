'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { formatWIB } from '@/lib/utils/time';
import { formatRupiah } from '@/lib/utils/format';
import { verifyVisitAction, getVisitDetailAction } from '../actions';
import type { DashboardVisit } from '../dashboard-view';
import type { VerificationStatus } from '@/lib/types/database';

interface AnomaliViewProps {
  initialVisits: DashboardVisit[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  initialFilters: {
    shortcut: string;
    dari: string;
    sampai: string;
    flag: string;
  };
}

export default function AnomaliView({
  initialVisits,
  totalCount,
  currentPage,
  pageSize,
  initialFilters,
}: AnomaliViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [selectedFlag, setSelectedFlag] = useState<string>(initialFilters.flag || 'semua');
  const [dateShortcut, setDateShortcut] = useState<string>(initialFilters.shortcut || 'semua');
  const [customDari, setCustomDari] = useState<string>(initialFilters.dari);
  const [customSampai, setCustomSampai] = useState<string>(initialFilters.sampai);

  const [activeModalVisit, setActiveModalVisit] = useState<DashboardVisit | null>(null);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState<boolean>(false);
  const [verifierNote, setVerifierNote] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const updateUrlFilters = (updates: Record<string, string | number | undefined>) => {
    const current = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === '' || v === 'semua') {
        current.delete(k);
      } else {
        current.set(k, String(v));
      }
    });

    if (!('page' in updates)) {
      current.delete('page');
    }

    startTransition(() => {
      router.push(`${pathname}?${current.toString()}`);
    });
  };

  const handleOpenDetailModal = async (visit: DashboardVisit) => {
    setActiveModalVisit(visit);
    setVerifierNote(visit.verifier_note || '');
    setActionFeedback(null);
    setIsLoadingPhotos(true);

    try {
      const res = await getVisitDetailAction(visit.id);
      if (res.data) {
        setActiveModalVisit(res.data as unknown as DashboardVisit);
      }
    } catch (err) {
      console.error('Gagal memuat detail foto:', err);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const handleVerify = async (status: VerificationStatus) => {
    if (!activeModalVisit) return;
    setIsVerifying(true);
    setActionFeedback(null);

    try {
      const res = await verifyVisitAction(
        activeModalVisit.id,
        status,
        verifierNote
      );

      if (res.error) {
        setActionFeedback(`⚠️ ${res.error}`);
      } else {
        // Fix bug: Jangan mutasi prop langsung, update state lokal dengan benar
        setActiveModalVisit((prev) =>
          prev
            ? {
                ...prev,
                verification_status: status,
                verifier_note: verifierNote,
              }
            : null
        );

        setActionFeedback(
          status === 'verified' ? '✓ Kunjungan Diterima' : '✕ Kunjungan Ditolak'
        );

        setTimeout(() => {
          setActiveModalVisit(null);
          setActionFeedback(null);
          setVerifierNote('');
          // Memicu re-fetch data di server component
          router.refresh();
        }, 1000);
      }
    } catch (err: unknown) {
      setActionFeedback(`⚠️ ${(err as Error).message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams({
      source: 'anomali',
      shortcut: dateShortcut,
      dari: customDari,
      sampai: customSampai,
      flag: selectedFlag,
    });
    window.open(`/api/laporan/csv?${params.toString()}`, '_blank');
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Header Info Anomali */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">⚠️</span>
            <h2 className="text-sm font-bold text-amber-950">
              Pusat Pengawasan Anomali Kunjungan ({totalCount} Kasus)
            </h2>
          </div>
          <p className="text-xs text-amber-800">
            Daftar seluruh kunjungan yang terindikasi mencurigakan menurut perhitungan integritas sistem.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="px-4 py-2 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
        >
          <span>📊</span> Ekspor CSV Anomali
        </button>
      </div>

      {/* 2. Bar Filter Rentang Tanggal & Kategori Anomali */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        {/* Pilihan Cepat Waktu */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'semua', label: 'Semua Waktu' },
            { id: 'hari_ini', label: 'Hari Ini' },
            { id: '7_hari', label: '7 Hari' },
            { id: '30_hari', label: '30 Hari' },
            { id: 'bulan_ini', label: 'Bulan Ini' },
            { id: 'custom', label: 'Kustom Tanggal' },
          ].map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => {
                setDateShortcut(sc.id);
                updateUrlFilters({ shortcut: sc.id });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                dateShortcut === sc.id
                  ? 'bg-amber-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>

        {/* Form Rentang Kustom */}
        {dateShortcut === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Dari:</span>
              <input
                type="date"
                value={customDari}
                onChange={(e) => setCustomDari(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Sampai:</span>
              <input
                type="date"
                value={customSampai}
                onChange={(e) => setCustomSampai(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => updateUrlFilters({ shortcut: 'custom', dari: customDari, sampai: customSampai })}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              Terapkan
            </button>
          </div>
        )}

        {/* Filter Jenis Anomali */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100">
          {[
            { id: 'semua', label: 'Semua Anomali' },
            { id: 'akurasi_rendah', label: 'Akurasi Rendah' },
            { id: 'akurasi_mencurigakan', label: 'Akurasi Mencurigakan' },
            { id: 'kecepatan_tidak_wajar', label: 'Kecepatan > 120 km/j' },
            { id: 'lokasi_kembar', label: 'Lokasi Kembar (<20m)' },
            { id: 'terlambat_kirim', label: 'Terlambat Kirim' },
            { id: 'foto_duplikat', label: 'Foto Duplikat (Hash)' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setSelectedFlag(f.id);
                updateUrlFilters({ flag: f.id });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedFlag === f.id
                  ? 'bg-red-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isPending && (
          <div className="flex items-center gap-2 text-xs text-amber-700 font-semibold pt-1">
            <span className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></span>
            Memuat data anomali...
          </div>
        )}
      </div>

      {/* 3. Daftar Kartu Anomali */}
      <div className="space-y-2.5">
        {initialVisits.length === 0 ? (
          <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center">
            <div className="text-3xl mb-2">🎉</div>
            <h3 className="text-sm font-bold text-slate-700">Tidak Ada Anomali</h3>
            <p className="text-xs text-slate-400 mt-1">
              Tidak ditemukan kunjungan dengan indikasi anomali pada filter ini.
            </p>
          </div>
        ) : (
          initialVisits.map((v) => {
            const statusColor =
              v.verification_status === 'verified'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : v.verification_status === 'rejected'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-amber-50 text-amber-700 border-amber-200';

            const statusLabel =
              v.verification_status === 'verified'
                ? 'Terverifikasi'
                : v.verification_status === 'rejected'
                ? 'Ditolak'
                : 'Menunggu';

            const photoCount = Array.isArray(v.visit_photos) ? v.visit_photos.length : Number((v as unknown as { visit_photos: { count: number }[] }).visit_photos?.[0]?.count || 0);

            return (
              <div
                key={v.id}
                onClick={() => handleOpenDetailModal(v)}
                className="p-3.5 bg-white border-2 border-amber-300 hover:border-amber-500 rounded-2xl shadow-sm space-y-2 cursor-pointer transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {v.marketing?.marketing_code || 'MKT'} • {v.marketing?.full_name}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">
                      {v.customer_name}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatWIB(v.captured_at)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}
                    >
                      {statusLabel}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      📷 {photoCount} Foto
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded capitalize">
                    {v.visit_type.replace(/_/g, ' ')}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded capitalize">
                    {v.product} ({v.outcome.replace(/_/g, ' ')})
                  </span>
                  {v.potential_value && (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold">
                      {formatRupiah(v.potential_value)}
                    </span>
                  )}
                </div>

                {v.address && (
                  <p className="text-[11px] text-slate-500 truncate">📍 {v.address}</p>
                )}

                {/* Badges Anomali Menonjol */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                  {v.anomaly_flags.map((flag) => (
                    <span
                      key={flag}
                      className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-bold"
                    >
                      ⚠️ {flag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Paginasi Bar Server-Side Anomali */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 text-xs text-slate-600">
          <div>
            Menampilkan <strong className="text-slate-900">{(currentPage - 1) * pageSize + 1}</strong> –{' '}
            <strong className="text-slate-900">{Math.min(currentPage * pageSize, totalCount)}</strong> dari{' '}
            <strong className="text-slate-900">{totalCount}</strong> anomali
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => updateUrlFilters({ page: currentPage - 1 })}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              ← Sebelumnya
            </button>
            <span className="px-3 py-1.5 font-bold text-slate-800">
              Halaman {currentPage} / {totalPages || 1}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => updateUrlFilters({ page: currentPage + 1 })}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              Berikutnya →
            </button>
          </div>
        </div>
      )}

      {/* Modal Detail & Verifikasi On-Demand */}
      {activeModalVisit && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl p-5 shadow-2xl my-auto space-y-4 max-h-[92vh] overflow-y-auto text-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-bkk-600 bg-bkk-50 px-2 py-0.5 rounded">
                  {activeModalVisit.marketing?.marketing_code || 'MKT'} • {activeModalVisit.marketing?.full_name}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {activeModalVisit.customer_name}
                </h3>
                <p className="text-xs text-slate-400">
                  {formatWIB(activeModalVisit.captured_at)}
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveModalVisit(null);
                  setActionFeedback(null);
                }}
                className="text-xs font-semibold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
              >
                ✕ Tutup
              </button>
            </div>

            {/* Anomaly Highlight Panel */}
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs space-y-1.5">
              <span className="font-bold text-red-900 block">⚠️ Peringatan Anomali Sistem:</span>
              <div className="flex flex-wrap gap-1.5">
                {activeModalVisit.anomaly_flags.map((flag) => (
                  <span
                    key={flag}
                    className="px-2 py-0.5 bg-red-100 border border-red-300 text-red-800 rounded font-bold text-[11px]"
                  >
                    {flag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            {/* Foto Dokumentasi On-Demand */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                Foto Dokumentasi Lapangan ({activeModalVisit.visit_photos?.length || 0})
              </span>

              {isLoadingPhotos ? (
                <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                  <span className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></span>
                  Memuat foto resolusi tinggi dari penyimpanan aman...
                </div>
              ) : activeModalVisit.visit_photos && activeModalVisit.visit_photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {activeModalVisit.visit_photos.map((photo, idx) => (
                    <div
                      key={photo.id || idx}
                      className="border border-slate-200 rounded-2xl overflow-hidden bg-black aspect-[4/3] relative group shadow-sm"
                    >
                      {photo.signedUrl ? (
                        <img
                          src={photo.signedUrl}
                          alt={`Foto Dokumentasi ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                          Foto tidak tersedia
                        </div>
                      )}
                      <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-black/70 backdrop-blur-sm text-white rounded text-[10px] font-bold">
                        Foto #{photo.sort_order || idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl">
                  Tidak ada foto terlampir.
                </p>
              )}
            </div>

            {/* Peta Statis OpenStreetMap */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden aspect-[16/9] relative bg-slate-100">
              <iframe
                title="Peta Lokasi Anomali"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${activeModalVisit.lng - 0.005}%2C${activeModalVisit.lat - 0.005}%2C${activeModalVisit.lng + 0.005}%2C${activeModalVisit.lat + 0.005}&layer=mapnik&marker=${activeModalVisit.lat}%2C${activeModalVisit.lng}`}
              ></iframe>
            </div>

            {/* Kolom Catatan Verifikator & Tombol Terima/Tolak */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-800">
                Catatan Verifikasi / Penolakan
              </label>
              <textarea
                rows={2}
                value={verifierNote}
                onChange={(e) => setVerifierNote(e.target.value)}
                placeholder="Alasan penerimaan khusus atau penolakan anomali..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-bkk-500"
              />

              {actionFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-bold text-center ${
                    actionFeedback.startsWith('✓')
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {actionFeedback}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => handleVerify('verified')}
                  className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  ✓ Terima (Disetujui)
                </button>
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => handleVerify('rejected')}
                  className="w-full min-h-[44px] bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  ✕ Tolak Kunjungan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
