import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PenagihanView, { type VisitWithPhotos } from './penagihan-view';
import type { Profile } from '@/lib/types/database';

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

  return (
    <PenagihanView
      initialVisits={visits}
      profile={profile}
      dailyTarget={dailyTarget}
    />
  );
}
