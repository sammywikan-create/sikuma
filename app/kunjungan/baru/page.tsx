import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Profile } from '@/lib/types/database';
import CameraView from './camera-view';

export default async function KunjunganBaruPage() {
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

  if (!profile || (profile.role !== 'marketing' && profile.role !== 'penagihan')) {
    redirect('/dasbor');
  }

  // KEAMANAN: Simulasi hanya aktif di development, TIDAK pernah di production
  const isSimulate = process.env.NEXT_PUBLIC_DEV_SIMULATE === '1' && process.env.NODE_ENV !== 'production';

  return (
    <CameraView
      profile={{
        full_name: profile.full_name,
        marketing_code: profile.marketing_code,
        role: profile.role,
      }}
      isSimulate={isSimulate}
    />
  );
}
