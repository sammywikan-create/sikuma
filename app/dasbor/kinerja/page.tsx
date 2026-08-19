import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import DasborNav from '@/components/dasbor/dasbor-nav';
import KinerjaView, {
  type MarketingPerformanceSummary,
  type DailyTrendPoint,
} from './kinerja-view';
import {
  getWIBDayBoundsUtc,
  getWIBDateParts,
  getWIBDateString,
} from '@/lib/utils/time';
import { getSetting, SETTING_KEYS } from '@/lib/settings';
import type { Profile, VisitType, ProductType, OutcomeType } from '@/lib/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface KinerjaPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function KinerjaPage({ searchParams }: KinerjaPageProps) {
  const params = await searchParams;
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

  if (!profile || (profile.role !== 'kacab' && profile.role !== 'admin')) {
    redirect('/kunjungan');
  }

  const adminClient = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1. Ambil Pengaturan Target Harian
  const targetKunjunganHarian = await getSetting<number>(
    adminClient,
    SETTING_KEYS.TARGET_KUNJUNGAN_HARIAN,
    4
  );

  // 2. Hitung Batas Periode Tanggal WIB
  const periode = params.periode || 'bulan_ini';
  const customDari = params.dari;
  const customSampai = params.sampai;
  const now = new Date();

  let startUtc: Date;
  let endUtc: Date;
  let periodLabel = 'Bulan Ini';

  if (periode === 'minggu_ini') {
    // Cari hari Senin pada minggu berjalan
    const dayOfWeek = now.getDay(); // 0 = Minggu, 1 = Senin, ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
    const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);

    const bStart = getWIBDayBoundsUtc(monday);
    const bEnd = getWIBDayBoundsUtc(sunday);
    startUtc = bStart.startUtc;
    endUtc = bEnd.endUtc;
    periodLabel = 'Minggu Ini';
  } else if (periode === 'bulan_lalu') {
    const { year, month } = getWIBDateParts(now);
    const currentMonthNum = parseInt(month, 10);
    const prevMonthNum = currentMonthNum === 1 ? 12 : currentMonthNum - 1;
    const prevYearNum = currentMonthNum === 1 ? parseInt(year, 10) - 1 : parseInt(year, 10);

    const prevMonthStr = String(prevMonthNum).padStart(2, '0');
    startUtc = new Date(`${prevYearNum}-${prevMonthStr}-01T00:00:00.000+07:00`);
    endUtc = new Date(new Date(`${year}-${month}-01T00:00:00.000+07:00`).getTime() - 1);
    periodLabel = 'Bulan Lalu';
  } else if (periode === 'custom' && customDari && customSampai) {
    const bStart = getWIBDayBoundsUtc(customDari);
    const bEnd = getWIBDayBoundsUtc(customSampai);
    startUtc = bStart.startUtc;
    endUtc = bEnd.endUtc;
    periodLabel = `${customDari} s.d. ${customSampai}`;
  } else {
    // Default: Bulan Ini
    const { year, month } = getWIBDateParts(now);
    startUtc = new Date(`${year}-${month}-01T00:00:00.000+07:00`);
    const nextMonth = parseInt(month, 10) === 12 ? 1 : parseInt(month, 10) + 1;
    const nextYear = parseInt(month, 10) === 12 ? parseInt(year, 10) + 1 : parseInt(year, 10);
    const nextMonthStr = String(nextMonth).padStart(2, '0');
    endUtc = new Date(new Date(`${nextYear}-${nextMonthStr}-01T00:00:00.000+07:00`).getTime() - 1);
    periodLabel = 'Bulan Ini';
  }

  // Hitung perkiraan hari kerja (Senin - Sabtu = 6 hari kerja/minggu)
  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.round((endUtc.getTime() - startUtc.getTime()) / msPerDay));
  const estimatedWorkDays = Math.max(1, Math.round(totalDays * (6 / 7)));
  const defaultPeriodTarget = targetKunjunganHarian * estimatedWorkDays;

  // 3. Ambil seluruh profil petugas lapangan aktif
  const { data: marketingsRaw } = await adminClient
    .from('profiles')
    .select('id, full_name, marketing_code, role')
    .in('role', ['marketing', 'penagihan'])
    .eq('is_active', true)
    .order('marketing_code', { ascending: true });

  const marketings = (marketingsRaw as unknown as Profile[]) || [];

  // 4. Kueri Agregat Database Ringan Kunjungan pada Periode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: visitsRaw } = await (adminClient as any)
    .from('visits')
    .select(`
      id,
      marketing_id,
      visit_type,
      product,
      outcome,
      potential_value,
      baki_debet,
      is_late,
      anomaly_flags,
      verification_status,
      captured_at
    `)
    .gte('captured_at', startUtc.toISOString())
    .lte('captured_at', endUtc.toISOString())
    .order('captured_at', { ascending: true });

  interface RawVisit {
    id: string;
    marketing_id: string;
    visit_type: VisitType;
    product: ProductType;
    outcome: OutcomeType;
    potential_value: number | null;
    baki_debet: number | null;
    is_late: boolean;
    anomaly_flags: string[];
    verification_status: string;
    captured_at: string;
  }

  const visits: RawVisit[] = visitsRaw || [];

  // 5. Agregasi Tren Kunjungan Harian (Untuk Grafik SVG)
  const dailyTrendMap = new Map<string, { total: number; real: number; anomaly: number }>();

  // Inisialisasi tanggal-tanggal pada rentang
  const curr = new Date(startUtc);
  while (curr <= endUtc) {
    const dStr = getWIBDateString(curr);
    if (!dailyTrendMap.has(dStr)) {
      dailyTrendMap.set(dStr, { total: 0, real: 0, anomaly: 0 });
    }
    curr.setDate(curr.getDate() + 1);
  }

  visits.forEach((v) => {
    const dStr = getWIBDateString(v.captured_at);
    const item = dailyTrendMap.get(dStr) || { total: 0, real: 0, anomaly: 0 };
    item.total += 1;
    if (v.outcome === 'realisasi') item.real += 1;
    if (v.anomaly_flags && v.anomaly_flags.length > 0) item.anomaly += 1;
    dailyTrendMap.set(dStr, item);
  });

  const dailyTrends: DailyTrendPoint[] = Array.from(dailyTrendMap.entries()).map(
    ([dateStr, val]) => {
      const [year, month, day] = dateStr.split('-');
      return {
        dateStr,
        dayLabel: `${day}/${month}/${year}`,
        totalVisits: val.total,
        realizations: val.real,
        anomalies: val.anomaly,
      };
    }
  );

  // 6. Agregasi Kinerja per Marketing
  const summariesMap = new Map<string, MarketingPerformanceSummary>();

  marketings.forEach((m) => {
    summariesMap.set(m.id, {
      marketing_id: m.id,
      marketing_name: m.full_name,
      marketing_code: m.marketing_code || '-',
      role: m.role,
      total_visits: 0,
      period_target: defaultPeriodTarget,
      achievement_percent: 0,
      verified_count: 0,
      rejected_count: 0,
      pending_count: 0,
      anomaly_count: 0,
      potential_value: 0,
      realization_count: 0,
      interested_count: 0,
      interested_ratio: 0,
      late_count: 0,
      late_percent: 0,
      visit_type_counts: {
        prospek_baru: 0,
        nasabah_existing: 0,
        penagihan: 0,
        survei_jaminan: 0,
        maintenance: 0,
      },
      product_counts: {
        tabungan: 0,
        deposito: 0,
        kredit: 0,
        lainnya: 0,
      },
      outcome_counts: {
        berminat: 0,
        follow_up: 0,
        realisasi: 0,
        tidak_berminat: 0,
        tidak_ditemui: 0,
      },
    });
  });

  visits.forEach((v) => {
    let summary = summariesMap.get(v.marketing_id);
    if (!summary) {
      summary = {
        marketing_id: v.marketing_id,
        marketing_name: 'Petugas',
        marketing_code: 'MKT',
        role: 'marketing',
        total_visits: 0,
        period_target: defaultPeriodTarget,
        achievement_percent: 0,
        verified_count: 0,
        rejected_count: 0,
        pending_count: 0,
        anomaly_count: 0,
        potential_value: 0,
        realization_count: 0,
        interested_count: 0,
        interested_ratio: 0,
        late_count: 0,
        late_percent: 0,
        visit_type_counts: {
          prospek_baru: 0,
          nasabah_existing: 0,
          penagihan: 0,
          survei_jaminan: 0,
          maintenance: 0,
        },
        product_counts: {
          tabungan: 0,
          deposito: 0,
          kredit: 0,
          lainnya: 0,
        },
        outcome_counts: {
          berminat: 0,
          follow_up: 0,
          realisasi: 0,
          tidak_berminat: 0,
          tidak_ditemui: 0,
        },
      };
      summariesMap.set(v.marketing_id, summary);
    }

    summary.total_visits += 1;
    if (v.verification_status === 'verified') summary.verified_count += 1;
    if (v.verification_status === 'rejected') summary.rejected_count += 1;
    if (v.verification_status === 'pending') summary.pending_count += 1;
    if (v.anomaly_flags && v.anomaly_flags.length > 0) summary.anomaly_count += 1;
    summary.potential_value += v.potential_value || 0;

    if (v.is_late) summary.late_count += 1;
    if (v.outcome === 'realisasi') summary.realization_count += 1;
    if (v.outcome === 'berminat') summary.interested_count += 1;

    if (v.visit_type && summary.visit_type_counts[v.visit_type] !== undefined) {
      summary.visit_type_counts[v.visit_type] += 1;
    }
    if (v.product && summary.product_counts[v.product] !== undefined) {
      summary.product_counts[v.product] += 1;
    }
    if (v.outcome && summary.outcome_counts[v.outcome] !== undefined) {
      summary.outcome_counts[v.outcome] += 1;
    }
  });

  const summaries = Array.from(summariesMap.values()).map((s) => {
    const achievement_percent =
      s.period_target > 0
        ? Math.round((s.total_visits / s.period_target) * 100)
        : 0;

    const interested_ratio =
      s.total_visits > 0
        ? Math.round(
            ((s.realization_count + s.interested_count) / s.total_visits) * 100
          )
        : 0;

    const late_percent =
      s.total_visits > 0 ? Math.round((s.late_count / s.total_visits) * 100) : 0;

    return {
      ...s,
      achievement_percent,
      interested_ratio,
      late_percent,
    };
  });

  // Hitung jumlah anomali aktif global untuk navigasi
  const { count: anomalyTotalCount } = await adminClient
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .not('anomaly_flags', 'eq', '{}');

  return (
    <main className="flex-1 flex flex-col p-4 bg-slate-50 min-h-screen">
      <header className="flex items-center justify-between pb-3.5 border-b border-slate-200 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-bkk-700 bg-bkk-50 px-2.5 py-0.5 rounded-full border border-bkk-200">
              {profile.role === 'kacab' ? 'Kepala Cabang' : 'Administrator'}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Analitik Real-Time
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1">
            Dasbor Kinerja &amp; Produktivitas Petugas
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

      <DasborNav role={profile.role} anomalyCount={anomalyTotalCount || 0} />

      <KinerjaView
        summaries={summaries}
        dailyTrends={dailyTrends}
        initialFilters={{
          periode,
          dari: customDari || getWIBDateString(now),
          sampai: customSampai || getWIBDateString(now),
        }}
        totalVisitsInPeriod={visits.length}
        periodLabel={periodLabel}
      />
    </main>
  );
}
