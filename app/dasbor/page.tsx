import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import DasborNav from '@/components/dasbor/dasbor-nav';
import DashboardView, { type DashboardVisit } from './dashboard-view';
import type { Profile } from '@/lib/types/database';

// Jangan cache halaman ini — selalu ambil data terbaru
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DasborPage() {
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

  // Gunakan service_role untuk bypass RLS — kacab wajib melihat semua data
  const adminClient = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1. Ambil seluruh profil marketing & penagihan aktif
  const { data: marketingProfilesRaw } = await adminClient
    .from('profiles')
    .select('*')
    .in('role', ['marketing', 'penagihan'])
    .order('marketing_code', { ascending: true });

  const marketings = (marketingProfilesRaw as unknown as Profile[]) || [];

  // 2. Ambil seluruh data kunjungan beserta foto & profil marketing (bypass RLS)
  const { data: visitsRaw } = await adminClient
    .from('visits')
    .select(`
      *,
      marketing:profiles!marketing_id (full_name, marketing_code),
      visit_photos (*)
    `)
    .order('captured_at', { ascending: false });

  const visits = (visitsRaw as unknown as DashboardVisit[]) || [];

  // Hitung jumlah anomali aktif
  const anomalyCount = visits.filter(
    (v) => v.anomaly_flags && v.anomaly_flags.length > 0
  ).length;

  return (
    <main className="flex-1 flex flex-col p-4 bg-slate-50 min-h-screen">
      {/* Top Header Profil */}
      <header className="flex items-center justify-between pb-3.5 border-b border-slate-200 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {profile.role === 'kacab' ? 'Kepala Cabang' : 'Administrator'}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Realtime
            </span>
          </div>
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

      {/* Navigasi Tab Dasbor */}
      <DasborNav role={profile.role} anomalyCount={anomalyCount} />

      {/* Tampilan Utama Dasbor */}
      <DashboardView
        initialVisits={visits}
        marketings={marketings}
        userRole={profile.role}
      />
    </main>
  );
}
