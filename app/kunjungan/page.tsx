import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatWIB } from '@/lib/utils/time';
import { formatRupiah } from '@/lib/utils/format';
import QueuedVisitsCard from '@/components/offline/queued-visits-card';
import type { Profile, Visit, VisitPhoto } from '@/lib/types/database';

interface VisitWithPhotos extends Visit {
  visit_photos: VisitPhoto[];
}

export default async function KunjunganPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/masuk');
  }

  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()) as { data: Profile | null };

  if (profile?.role !== 'marketing') {
    redirect('/dasbor');
  }

  // 1. Ambil target harian dari app_settings (default 4)
  const { data: targetSetting } = (await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'target_kunjungan_harian')
    .maybeSingle()) as { data: { value: unknown } | null };

  const dailyTarget = Number(targetSetting?.value) || 4;

  // 2. Ambil riwayat kunjungan 30 hari terakhir untuk marketing ini
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const { data: visitsRaw } = await supabase
    .from('visits')
    .select(`
      *,
      visit_photos (*)
    `)
    .eq('marketing_id', user.id)
    .gte('captured_at', thirtyDaysAgo.toISOString())
    .order('captured_at', { ascending: false });

  const visits = (visitsRaw as unknown as VisitWithPhotos[]) || [];

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

  return (
    <main className="flex-1 flex flex-col p-4 bg-slate-50 min-h-screen">
      {/* 1. Header Profil */}
      <header className="flex items-center justify-between pb-3.5 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-bkk-600 bg-bkk-50 px-2.5 py-0.5 rounded-full border border-bkk-200">
            {profile.marketing_code || 'MKT'}
          </span>
          <h1 className="text-lg font-bold text-slate-900 mt-1">
            {profile.full_name}
          </h1>
          <p className="text-[11px] text-slate-500">{user.email}</p>
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
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-bkk-100 text-bkk-700'
              }`}
            >
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              todayCount >= dailyTarget ? 'bg-emerald-500' : 'bg-bkk-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          ></div>
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

      {/* 4. Daftar Riwayat Kunjungan */}
      <section className="mt-6 space-y-3 pb-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            Riwayat Kunjungan ({visits.length})
          </h2>
          <span className="text-[11px] text-slate-400">30 Hari Terakhir</span>
        </div>

        {visits.length === 0 ? (
          <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center">
            <div className="text-3xl mb-2">📋</div>
            <h3 className="text-sm font-bold text-slate-700">Belum Ada Kunjungan</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Tekan tombol &quot;Catat Kunjungan Baru&quot; di atas untuk memulai dokumentasi nasabah.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visits.map((v) => {
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
                  className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">
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
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md capitalize font-medium">
                      {v.visit_type.replace(/_/g, ' ')}
                    </span>
                    <span className="px-2 py-0.5 bg-bkk-50 text-bkk-700 rounded-md capitalize font-medium">
                      {v.product}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md capitalize">
                      {v.outcome.replace(/_/g, ' ')}
                    </span>
                    {v.potential_value && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-semibold">
                        {formatRupiah(v.potential_value)}
                      </span>
                    )}
                  </div>

                  {/* Lokasi / Alamat */}
                  {v.address && (
                    <p className="text-[11px] text-slate-500 truncate">
                      📍 {v.address}
                    </p>
                  )}

                  {/* Anomaly Flags Badge */}
                  {v.anomaly_flags && v.anomaly_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                      {v.anomaly_flags.map((flag) => (
                        <span
                          key={flag}
                          className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded"
                        >
                          ⚠️ {flag.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
