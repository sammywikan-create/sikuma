import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Profile } from '@/lib/types/database';

export default async function HomePage() {
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

  if (profile?.role === 'marketing') {
    redirect('/kunjungan');
  } else {
    redirect('/dasbor');
  }
}
