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

interface KunjunganViewProps {
  initialVisits: VisitWithPhotos[];
  profile: Profile;
  userEmail: string;
  dailyTarget: number;
}

export default function KunjunganView({
  initialVisits,
  profile,
  userEmail,
  dailyTarget,
}: KunjunganViewProps) {
  const [visits, setVisits] = useState<VisitWithPhotos[]>(initialVisits);

  useEffect(() => {
    setVisits(initialVisits);
  }, [initialVisits]);

  // Realtime subscription untuk marketing ini
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`marketing_visits_${profile.id}`)
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

            if (newV && (newV as Visit).visit_type !== 'penagihan') {
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

  // Hitung jumlah kunjungan hari ini (WIB)
  const todayWIBStr = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const todayVisits = visits.filter((v) => {
    const vDateStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(v.captured_at));
    return vDateStr === todayWIBStr;
  });

  const todayCount = todayVisits.length;
  const progressPercent = Math.min(100, Math.round((todayCount / dailyTarget) * 100));

  // Filter riwayat: default Hari Ini
  const [dateFilter, setDateFilter] = useState<'hari_ini' | '7_hari'>('hari_ini');

  const displayedVisits = dateFilter === 'hari_ini' ? todayVisits : visits;

  return (
    <main className="flex-1 flex flex-col p-4 bg-slate-50 min-h-screen">
      {/* 1. Header Profil */}
      <header className="flex items-center justify-between pb-3.5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-bkk-600 bg-bkk-50 px-2.5 py-0.5 rounded-full border border-bkk-200">
              {profile.marketing_code || 'MKT'}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Realtime
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1">
            {profile.full_name}
          </h1>
          <p className="text-[11px] text-slate-500">{userEmail}</p>
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

      {/* 2. Kartu Target & Progres Kunjungan Harian */}
      <section className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xs font-medium text-slate-500 block">
              Progres Target Kunjungan Hari Ini
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-slate-900">{todayCount}</span>
              <span className="text-xs text-slate-400 font-semibold">/ {dailyTarget} Kunjungan</span>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                todayCount >= dailyTarget
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {progressPercent}%
            </span>
          </div>
        </div>

        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              todayCount >= dailyTarget ? 'bg-emerald-500' : 'bg-bkk-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </section>

      {/* 3. Kartu Antrean Offline HP */}
      <QueuedVisitsCard />

      {/* 4. Tombol Utama: Catat Kunjungan Baru & SOP Panduan */}
      <div className="mt-4 space-y-2">
        <Link
          href="/kunjungan/baru"
          id="btn-catat-kunjungan-baru"
          className="w-full py-3.5 px-4 bg-bkk-600 hover:bg-bkk-700 active:bg-bkk-800 text-white rounded-2xl shadow-lg shadow-bkk-600/25 flex items-center justify-between smooth-transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl font-bold">
              📷
            </div>
            <div className="text-left">
              <h2 className="text-sm font-bold leading-tight">
                Catat Kunjungan Baru
              </h2>
              <p className="text-[11px] text-bkk-100 mt-0.5">
                Ambil foto kamera &amp; bakar watermark GPS
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
            <span>📖</span> Baca Panduan &amp; Aturan Foto Marketing
          </span>
          <span className="text-slate-400">→</span>
        </Link>
      </div>

      {/* 5. Daftar Riwayat Kunjungan */}
      <section className="mt-6 flex-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900">
            Riwayat Kunjungan
          </h2>
          <div className="flex gap-1.5">
            <button
              onClick={() => setDateFilter('hari_ini')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                dateFilter === 'hari_ini'
                  ? 'bg-bkk-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              Hari Ini ({todayCount})
            </button>
            <button
              onClick={() => setDateFilter('7_hari')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                dateFilter === '7_hari'
                  ? 'bg-bkk-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              7 Hari ({visits.length})
            </button>
          </div>
        </div>

        {displayedVisits.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-2">
              📝
            </div>
            <p className="text-sm font-semibold text-slate-700">Belum Ada Kunjungan {dateFilter === 'hari_ini' ? 'Hari Ini' : '7 Hari Terakhir'}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Ketuk tombol &quot;Catat Kunjungan Baru&quot; di atas untuk memulai dokumentasi.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedVisits.map((visit) => {
              const isVerified = visit.verification_status === 'verified';
              const isRejected = visit.verification_status === 'rejected';

              return (
                <article
                  key={visit.id}
                  className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-2.5 transition hover:border-slate-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {visit.customer_name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <span className="capitalize">{visit.visit_type.replace(/_/g, ' ')}</span>
                        <span>•</span>
                        <span className="font-semibold text-bkk-700 uppercase">
                          {visit.product}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        isVerified
                          ? 'bg-emerald-100 text-emerald-800'
                          : isRejected
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isVerified ? 'Disetujui' : isRejected ? 'Ditolak' : 'Menunggu'}
                    </span>
                  </div>

                  <div className="text-xs bg-slate-50 p-2.5 rounded-xl text-slate-600 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Hasil Pertemuan:</span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {visit.outcome.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {visit.potential_value && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Nilai Potensi:</span>
                        <span className="font-bold text-emerald-700">
                          {formatRupiah(visit.potential_value)}
                        </span>
                      </div>
                    )}
                    {visit.notes && (
                      <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60">
                        &quot;{visit.notes}&quot;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>🕒 {formatWIB(visit.captured_at)}</span>
                    {visit.address ? (
                      <span className="truncate max-w-[160px]">📍 {visit.address}</span>
                    ) : (
                      <span>📍 GPS {visit.lat.toFixed(4)}, {visit.lng.toFixed(4)}</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
