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

const KOLEKTIBILITAS_LABEL: Record<string, string> = {
  kol_1: 'Kol 1 (Lancar)',
  kol_2: 'Kol 2 (DPK)',
  kol_3: 'Kol 3 (Kurang Lancar)',
  kol_4: 'Kol 4 (Diragukan)',
  kol_5: 'Kol 5 (Macet)',
};

export default async function PenagihanPage() {
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

  if (profile?.role !== 'penagihan') {
    redirect('/dasbor');
  }

  // 1. Ambil target penagihan harian (default 5)
  const { data: targetSetting } = (await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'target_penagihan_harian')
    .maybeSingle()) as { data: { value: unknown } | null };

  const dailyTarget = Number(targetSetting?.value) || 5;

  // 2. Ambil riwayat penagihan 30 hari terakhir untuk petugas ini
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
    .eq('visit_type', 'penagihan')
    .gte('captured_at', thirtyDaysAgo.toISOString())
    .order('captured_at', { ascending: false });

  const visits = (visitsRaw as unknown as VisitWithPhotos[]) || [];

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
      </div>

      {/* 5. Daftar Riwayat Penagihan */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900">
            Riwayat Penagihan ({visits.length})
          </h2>
          <span className="text-[11px] text-slate-400">30 Hari Terakhir</span>
        </div>

        {visits.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200/80 rounded-2xl shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mx-auto mb-3">
              💳
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              Belum Ada Catatan Penagihan
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Ketuk tombol &quot;Catat Penagihan Debitur&quot; di atas untuk merekam penagihan lapangan pertama Anda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map((visit) => (
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
