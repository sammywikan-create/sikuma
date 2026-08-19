import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import DasborNav from '@/components/dasbor/dasbor-nav';
import AnomaliView from './anomali-view';
import { getWIBDayBoundsUtc, getWIBDateParts, getWIBDateString } from '@/lib/utils/time';
import type { Profile } from '@/lib/types/database';
import type { DashboardVisit } from '../dashboard-view';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AnomaliPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function AnomaliPage({ searchParams }: AnomaliPageProps) {
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

  // 1. Parse Parameter URL (Server-side Filter & Pagination)
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const shortcut = params.shortcut || 'semua';
  const customDari = params.dari;
  const customSampai = params.sampai;
  const selectedFlag = params.flag || 'semua';

  const now = new Date();
  let startUtc: Date | null = null;
  let endUtc: Date | null = null;

  if (shortcut === 'hari_ini') {
    const bounds = getWIBDayBoundsUtc(now);
    startUtc = bounds.startUtc;
    endUtc = bounds.endUtc;
  } else if (shortcut === '7_hari') {
    const boundsNow = getWIBDayBoundsUtc(now);
    const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const boundsStart = getWIBDayBoundsUtc(past7);
    startUtc = boundsStart.startUtc;
    endUtc = boundsNow.endUtc;
  } else if (shortcut === '30_hari') {
    const boundsNow = getWIBDayBoundsUtc(now);
    const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const boundsStart = getWIBDayBoundsUtc(past30);
    startUtc = boundsStart.startUtc;
    endUtc = boundsNow.endUtc;
  } else if (shortcut === 'bulan_ini') {
    const { year, month } = getWIBDateParts(now);
    startUtc = new Date(`${year}-${month}-01T00:00:00.000+07:00`);
    const nextMonth = parseInt(month, 10) === 12 ? 1 : parseInt(month, 10) + 1;
    const nextYear = parseInt(month, 10) === 12 ? parseInt(year, 10) + 1 : parseInt(year, 10);
    const nextMonthStr = String(nextMonth).padStart(2, '0');
    endUtc = new Date(new Date(`${nextYear}-${nextMonthStr}-01T00:00:00.000+07:00`).getTime() - 1);
  } else if (customDari && customSampai) {
    const boundsStart = getWIBDayBoundsUtc(customDari);
    const boundsEnd = getWIBDayBoundsUtc(customSampai);
    startUtc = boundsStart.startUtc;
    endUtc = boundsEnd.endUtc;
  }

  // 2. Kueri server-side kunjungan anomali (tanpa visit_photos(*))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (adminClient as any)
    .from('visits')
    .select(`
      id,
      client_uuid,
      customer_name,
      visit_type,
      product,
      outcome,
      potential_value,
      baki_debet,
      kolektibilitas,
      notes,
      captured_at,
      lat,
      lng,
      accuracy_m,
      address,
      is_late,
      anomaly_flags,
      verification_status,
      verifier_note,
      marketing_id,
      marketing:profiles!marketing_id (full_name, marketing_code),
      visit_photos (count)
    `, { count: 'exact' })
    .not('anomaly_flags', 'eq', '{}');

  if (startUtc) {
    query = query.gte('captured_at', startUtc.toISOString());
  }
  if (endUtc) {
    query = query.lte('captured_at', endUtc.toISOString());
  }
  if (selectedFlag !== 'semua') {
    query = query.contains('anomaly_flags', [selectedFlag]);
  }

  const { data: visitsRaw, count, error } = await query
    .order('captured_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching anomalies:', error.message);
  }

  const totalCount = count || 0;
  const visits = (visitsRaw as unknown as DashboardVisit[]) || [];

  return (
    <main className="flex-1 flex flex-col p-4 bg-slate-50 min-h-screen">
      <header className="flex items-center justify-between pb-3.5 border-b border-slate-200 mb-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            {profile.role === 'kacab' ? 'Kepala Cabang' : 'Administrator'}
          </span>
          <h1 className="text-lg font-bold text-slate-900 mt-1">
            Pusat Investigasi Anomali
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

      <DasborNav role={profile.role} anomalyCount={totalCount} />

      <AnomaliView
        initialVisits={visits}
        totalCount={totalCount}
        currentPage={page}
        pageSize={pageSize}
        initialFilters={{
          shortcut,
          dari: customDari || getWIBDateString(now),
          sampai: customSampai || getWIBDateString(now),
          flag: selectedFlag,
        }}
      />
    </main>
  );
}
