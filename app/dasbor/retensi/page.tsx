import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DasborNav from '@/components/dasbor/dasbor-nav';
import RetensiView from './retensi-view';
import { getSetting, SETTING_KEYS } from '@/lib/settings';
import type { Profile } from '@/lib/types/database';

export default async function RetensiPage() {
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

  // Ambil Pengaturan Retensi Hari via modul settings terpusat
  const retentionDays = await getSetting<number>(
    supabase,
    SETTING_KEYS.RETENSI_FOTO_HARI,
    730
  );
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Ambil Jumlah Total Foto & Foto Kedaluwarsa
  const { count: totalPhotosCount } = await supabase
    .from('visit_photos')
    .select('*', { count: 'exact', head: true })
    .not('storage_path', 'is', null);

  const { data: expiredPhotosRaw } = (await supabase
    .from('visit_photos')
    .select(`
      id,
      bytes,
      visits!inner (
        id,
        captured_at
      )
    `)
    .not('storage_path', 'is', null)
    .lt('visits.captured_at', cutoffDate.toISOString())) as {
    data: { id: string; bytes: number | null }[] | null;
  };

  const expiredPhotos = expiredPhotosRaw || [];
  const expiredBytes = expiredPhotos.reduce((acc, p) => acc + (p.bytes || 0), 0);

  return (
    <main className="flex-1 flex flex-col p-4 bg-slate-50 min-h-screen">
      <header className="flex items-center justify-between pb-3.5 border-b border-slate-200 mb-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
            Administrator
          </span>
          <h1 className="text-lg font-bold text-slate-900 mt-1">
            Retensi Data Berkas Foto
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

      <RetensiView
        retentionDays={retentionDays}
        totalPhotosCount={totalPhotosCount || 0}
        expiredPhotosCount={expiredPhotos.length}
        expiredBytes={expiredBytes}
      />
    </main>
  );
}
