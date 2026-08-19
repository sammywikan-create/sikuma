'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatWIB } from '@/lib/utils/time';
import { formatRupiah } from '@/lib/utils/format';
import QueuedVisitsCard from '@/components/offline/queued-visits-card';
import type { Profile, Visit, VisitPhoto } from '@/lib/types/database';

export interface VisitWithPhotos extends Visit {
  visit_photos: VisitPhoto[];
}

const KOLEKTIBILITAS_LABEL: Record<string, string> = {
  kol_1: 'Kol 1 (Lancar)',
  kol_2: 'Kol 2 (DPK)',
  kol_3: 'Kol 3 (Kurang Lancar)',
  kol_4: 'Kol 4 (Diragukan)',
  kol_5: 'Kol 5 (Macet)',
};

interface PenagihanViewProps {
  initialVisits: VisitWithPhotos[];
  profile: Profile;
  dailyTarget: number;
}

export default function PenagihanView({
  initialVisits,
  profile,
  dailyTarget,
}: PenagihanViewProps) {
  const [visits, setVisits] = useState<VisitWithPhotos[]>(initialVisits);

  useEffect(() => {
    setVisits(initialVisits);
  }, [initialVisits]);

  // Realtime subscription untuk petugas penagihan ini
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`penagihan_visits_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visits',
          filter: `marketing_id=eq.${profile.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: newV } = await supabase
              .from('visits')
              .select('*, visit_photos(*)')
              .eq('id', (payload.new as Visit).id)
              .maybeSingle();

            if (newV && (newV as Visit).visit_type === 'penagihan') {
              setVisits((prev) => [
                newV as unknown as VisitWithPhotos,
                ...prev.filter((v) => v.id !== (newV as Visit).id),
              ]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Visit;
            setVisits((prev) =>
              prev.map((v) => (v.id === updated.id ? { ...v, ...updated } : v))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setVisits((prev) => prev.filter((v) => v.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id]);

  // Hitung jumlah penagihan hari ini (WIB)
  const now = new Date();
  const todayWIB = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().substring(0, 10);
  const todayVisits = visits.filter((v) => {
    const vDateWIB = new Date(new Date(v.captured_at).getTime() + 7 * 60 * 60 * 1000)
      .toISOString()
      .substring(0, 10);
    return vDateWIB === todayWIB;
  });

  const todayCount = todayVisits.length;
  const progressPercent = Math.min(Math.round((todayCount / dailyTarget) * 100), 100);

  // Filter riwayat: default Hari Ini, bisa pilih tanggal spesifik
  const [dateFilter, setDateFilter] = useState<'hari_ini' | '7_hari' | 'tanggal'>('hari_ini');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return wib.toISOString().substring(0, 10);
  });

  const displayedVisits = (() => {
    if (dateFilter === 'hari_ini') return todayVisits;
    if (dateFilter === '7_hari') return visits;
    return visits.filter((v) => {
      const vDateWIB = new Date(new Date(v.captured_at).getTime() + 7 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10);
      return vDateWIB === selectedDate;
    });
  })();

  const filterLabel = dateFilter === 'hari_ini' ? 'Hari Ini' : dateFilter === '7_hari' ? '7 Hari Terakhir' : selectedDate;

  return (
    <main className="flex-1 flex flex-col p-4 bg-slate-50 min-h-screen pb-16">
      {/* 1. Header Profil AO */}
      <header className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Petugas Penagihan (AO)
            </span>
            <span className="font-mono text-xs font-bold text-slate-700">
              [{profile.marketing_code || 'AO'}]
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Realtime
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1">
            {profile.full_name}
          </h1>
          <p className="text-xs text-slate-500">PT BPR BKK Kabupaten Semarang</p>
        </div>

        <form action="/auth/keluar" method="POST">
          <button
            type="submit"
            className="text-xs font-semibold px-3 py-1.5 text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg shadow-sm cursor-pointer"
          >
            Keluar
          </button>
        </form>
      </header>

      {/* 2. Kartu Target Harian Penagihan */}
      <div className="mt-4 p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xs text-slate-500 font-medium">Progres Penagihan Hari Ini</span>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {todayCount}{' '}
              <span className="text-xs font-normal text-slate-400">
                / {dailyTarget} debitur tercatat
              </span>
            </div>
          </div>

          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm ${
              todayCount >= dailyTarget
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}
          >
            {progressPercent}%
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              todayCount >= dailyTarget ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 3. Kartu Antrean Offline HP */}
      <QueuedVisitsCard />

      {/* 4. Tombol Utama: Catat Penagihan Baru */}
      <div className="mt-4 space-y-2">
        <Link
          href="/kunjungan/baru"
          id="btn-catat-penagihan-baru"
          className="w-full py-3.5 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-2xl shadow-lg shadow-amber-600/25 flex items-center justify-between smooth-transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl font-bold">
              💳
            </div>
            <div className="text-left">
              <h2 className="text-sm font-bold leading-tight">
                Catat Penagihan Debitur
              </h2>
              <p className="text-[11px] text-amber-100 mt-0.5">
                Foto debitur &amp; rekam baki debet / kolektibilitas
              </p>
            </div>
          </div>
          <span className="text-lg font-bold">→</span>
        </Link>

        <Link
          href="/panduan"
          className="w-full py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl flex items-center justify-between text-xs font-semibold shadow-sm transition"
        >
          <span className="flex items-center gap-1.5">
            <span>📖</span> SOP &amp; Aturan Foto Lapangan
          </span>
          <span className="text-slate-400">→</span>
        </Link>

        <Link
          href="/profil"
          className="w-full py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl flex items-center justify-between text-xs font-semibold shadow-sm transition"
        >
          <span className="flex items-center gap-1.5">
            <span>🔒</span> Ganti Password
          </span>
          <span className="text-slate-400">→</span>
        </Link>
      </div>

      {/* 5. Daftar Riwayat Penagihan */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-slate-900">
            Riwayat Penagihan
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">{displayedVisits.length} data</span>
        </div>

        {/* Filter Tanggal */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <button
            onClick={() => setDateFilter('hari_ini')}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
              dateFilter === 'hari_ini'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            Hari Ini
          </button>
          <button
            onClick={() => setDateFilter('7_hari')}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
              dateFilter === '7_hari'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            7 Hari
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDateFilter('tanggal')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                dateFilter === 'tanggal'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              📅 Tanggal
            </button>
            {dateFilter === 'tanggal' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-[11px] font-semibold px-2 py-1 border border-amber-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            )}
          </div>
        </div>

        {displayedVisits.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200/80 rounded-2xl shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mx-auto mb-3">
              💳
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              Belum Ada Penagihan {filterLabel}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Ketuk tombol &quot;Catat Penagihan Debitur&quot; di atas untuk merekam penagihan lapangan pertama Anda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedVisits.map((visit) => (
              <div
                key={visit.id}
                className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-2.5 transition hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">
                      {visit.customer_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                        {visit.kolektibilitas ? KOLEKTIBILITAS_LABEL[visit.kolektibilitas] || visit.kolektibilitas : 'Kol 1'}
                      </span>
                      <span className="text-[11px] font-bold text-slate-800">
                        {visit.baki_debet ? formatRupiah(visit.baki_debet) : formatRupiah(visit.potential_value || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Status Verifikasi Badge */}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      visit.verification_status === 'verified'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : visit.verification_status === 'rejected'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {visit.verification_status === 'verified'
                      ? 'Disetujui'
                      : visit.verification_status === 'rejected'
                      ? 'Ditolak'
                      : 'Menunggu'}
                  </span>
                </div>

                {/* Hasil & Catatan */}
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hasil:</span>
                    <span className="font-semibold text-slate-800 capitalize">
                      {visit.outcome.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {visit.notes && (
                    <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60">
                      &quot;{visit.notes}&quot;
                    </p>
                  )}
                </div>

                {/* Info Tanggal & Lokasi */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span>🕒 {formatWIB(visit.captured_at)}</span>
                  {visit.address ? (
                    <span className="truncate max-w-[160px]">📍 {visit.address}</span>
                  ) : (
                    <span>📍 GPS {visit.lat.toFixed(4)}, {visit.lng.toFixed(4)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
