'use client';

import { useState, useMemo } from 'react';
import { formatWIB } from '@/lib/utils/time';
import { formatRupiah } from '@/lib/utils/format';
import { verifyVisitAction } from '../actions';
import type { DashboardVisit } from '../dashboard-view';
import type { VerificationStatus } from '@/lib/types/database';

interface AnomaliViewProps {
  initialVisits: DashboardVisit[];
}

export default function AnomaliView({ initialVisits }: AnomaliViewProps) {
  const [selectedFlag, setSelectedFlag] = useState<string>('semua');
  const [activeModalVisit, setActiveModalVisit] = useState<DashboardVisit | null>(null);
  const [verifierNote, setVerifierNote] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Filter kunjungan anomali
  const flaggedVisits = useMemo(() => {
    return initialVisits.filter((v) => {
      if (!v.anomaly_flags || v.anomaly_flags.length === 0) return false;
      if (selectedFlag === 'semua') return true;
      return v.anomaly_flags.includes(selectedFlag);
    });
  }, [initialVisits, selectedFlag]);

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
        activeModalVisit.verification_status = status;
        activeModalVisit.verifier_note = verifierNote;
        setActionFeedback(
          status === 'verified' ? '✓ Kunjungan Diterima' : '✕ Kunjungan Ditolak'
        );
        setTimeout(() => {
          setActiveModalVisit(null);
          setActionFeedback(null);
          setVerifierNote('');
        }, 1200);
      }
    } catch (err: unknown) {
      setActionFeedback(`⚠️ ${(err as Error).message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Header Info Anomali */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">⚠️</span>
          <h2 className="text-sm font-bold text-amber-950">
            Pusat Pengawasan Anomali Kunjungan
          </h2>
        </div>
        <p className="text-xs text-amber-800">
          Daftar seluruh kunjungan yang terindikasi mencurigakan menurut perhitungan integritas sistem (akurasi rendah, kecepatan tidak wajar, lokasi kembar, foto duplikat, atau keterlambatan unggah).
        </p>
      </div>

      {/* 2. Filter Bar Anomali */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
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
            onClick={() => setSelectedFlag(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              selectedFlag === f.id
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 3. Daftar Kartu Anomali */}
      <div className="space-y-2.5">
        {flaggedVisits.length === 0 ? (
          <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center">
            <div className="text-3xl mb-2">🎉</div>
            <h3 className="text-sm font-bold text-slate-700">Tidak Ada Anomali</h3>
            <p className="text-xs text-slate-400 mt-1">
              Tidak ditemukan kunjungan dengan indikasi anomali pada filter ini.
            </p>
          </div>
        ) : (
          flaggedVisits.map((v) => {
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

            return (
              <div
                key={v.id}
                onClick={() => {
                  setActiveModalVisit(v);
                  setVerifierNote(v.verifier_note || '');
                }}
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

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}
                  >
                    {statusLabel}
                  </span>
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

      {/* Modal Detail & Verifikasi Langsung */}
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
                className="text-xs font-semibold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
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
