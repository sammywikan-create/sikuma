import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import KunjunganView, { type VisitWithPhotos } from './kunjungan-view';
import type { Profile } from '@/lib/types/database';

// Jangan cache — selalu ambil data terbaru saat navigasi
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
    .neq('visit_type', 'penagihan')
    .gte('captured_at', thirtyDaysAgo.toISOString())
    .order('captured_at', { ascending: false });

  const visits = (visitsRaw as unknown as VisitWithPhotos[]) || [];

  return (
    <KunjunganView
      initialVisits={visits}
      profile={profile}
      userEmail={user.email || ''}
      dailyTarget={dailyTarget}
    />
  );
}
