import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DasborNav from '@/components/dasbor/dasbor-nav';
import AnomaliView from './anomali-view';
import type { Profile } from '@/lib/types/database';
import type { DashboardVisit } from '../dashboard-view';

export default async function AnomaliPage() {
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

  // Ambil kunjungan yang berflag anomali
  const { data: visitsRaw } = await supabase
    .from('visits')
    .select(`
      *,
      marketing:profiles (full_name, marketing_code),
      visit_photos (*)
    `)
    .not('anomaly_flags', 'eq', '{}')
    .order('captured_at', { ascending: false });

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

      <DasborNav role={profile.role} anomalyCount={visits.length} />

      <AnomaliView initialVisits={visits} />
    </main>
  );
}
