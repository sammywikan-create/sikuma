import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Profile } from '@/lib/types/database';
import ProfilPageClient from './profil-client';

export const dynamic = 'force-dynamic';

export default async function ProfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/masuk');
  }

  const { data: profile } = (await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()) as { data: Pick<Profile, 'role'> | null };

  if (!profile) {
    redirect('/masuk');
  }

  return <ProfilPageClient role={profile.role} />;
}
