import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DasborNav from '@/components/dasbor/dasbor-nav';
import PenggunaView from './pengguna-view';
import type { Profile } from '@/lib/types/database';

export default async function PenggunaPage() {
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

  if (!profile || profile.role !== 'admin') {
    redirect('/dasbor');
  }

  // Ambil semua profil pengguna
  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  const profiles = (profilesRaw as unknown as Profile[]) || [];

  return (
    <main className="flex-1 flex flex-col p-4 bg-slate-50 min-h-screen">
      <header className="flex items-center justify-between pb-3.5 border-b border-slate-200 mb-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
            Administrator
          </span>
          <h1 className="text-lg font-bold text-slate-900 mt-1">
            Kelola Pengguna Sistem
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

      <DasborNav role={profile.role} />

      <PenggunaView initialProfiles={profiles} />
    </main>
  );
}
