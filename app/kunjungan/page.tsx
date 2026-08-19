import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import KunjunganView, { type VisitWithPhotos } from './kunjungan-view';
import { getSetting, SETTING_KEYS } from '@/lib/settings';
import { getWIBDayBoundsUtc } from '@/lib/utils/time';
import type { Profile } from '@/lib/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  // 1. Ambil target harian dari modul settings terpusat
  const dailyTarget = await getSetting<number>(
    supabase,
    SETTING_KEYS.TARGET_KUNJUNGAN_HARIAN,
    4
  );

  // 2. Ambil 20 riwayat kunjungan terbaru dengan kolom eksplisit dan photo count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: visitsRaw, count } = await (supabase as any)
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
      visit_photos (count)
    `, { count: 'exact' })
    .eq('marketing_id', user.id)
    .neq('visit_type', 'penagihan')
    .order('captured_at', { ascending: false })
    .range(0, 19);

  const visits = (visitsRaw as unknown as VisitWithPhotos[]) || [];
  const totalCount = count || 0;
  const initialHasMore = totalCount > 20;

  // 3. Hitung jumlah kunjungan hari ini secara akurat via batas WIB
  const { startUtc, endUtc } = getWIBDayBoundsUtc(new Date());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: todayCountRaw } = await (supabase as any)
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('marketing_id', user.id)
    .neq('visit_type', 'penagihan')
    .gte('captured_at', startUtc.toISOString())
    .lte('captured_at', endUtc.toISOString());

  const todayVisitsCount = todayCountRaw || 0;

  return (
    <KunjunganView
      initialVisits={visits}
      initialHasMore={initialHasMore}
      todayVisitsCount={todayVisitsCount}
      profile={profile}
      userEmail={user.email || ''}
      dailyTarget={dailyTarget}
    />
  );
}
