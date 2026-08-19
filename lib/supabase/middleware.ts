import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database, UserRole } from '@/lib/types/database';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. Pengguna belum masuk (unauthenticated)
  if (!user) {
    const isPublicPath =
      pathname === '/masuk' ||
      pathname === '/manifest.json' ||
      pathname === '/sw.js' ||
      pathname === '/favicon.ico' ||
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/icons/');

    if (!isPublicPath) {
      const url = request.nextUrl.clone();
      url.pathname = '/masuk';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // 2. Pengguna terautentikasi: periksa profil & peran
  const { data: profile } = (await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle()) as { data: { role: UserRole; is_active: boolean } | null };

  const role = profile?.role;

  // Jika akun dinonaktifkan
  if (profile && !profile.is_active) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = '/masuk';
    url.searchParams.set('error', 'inactive');
    return NextResponse.redirect(url);
  }

  // Pengalihan dari rute /masuk atau / berdasarkan peran
  if (pathname === '/masuk' || pathname === '/') {
    const url = request.nextUrl.clone();
    if (role === 'marketing') {
      url.pathname = '/kunjungan';
    } else if (role === 'penagihan') {
      url.pathname = '/penagihan';
    } else {
      url.pathname = '/dasbor';
    }
    return NextResponse.redirect(url);
  }

  // Proteksi rute dasbor untuk petugas lapangan
  if (pathname.startsWith('/dasbor')) {
    if (role === 'marketing') {
      const url = request.nextUrl.clone();
      url.pathname = '/kunjungan';
      return NextResponse.redirect(url);
    }
    if (role === 'penagihan') {
      const url = request.nextUrl.clone();
      url.pathname = '/penagihan';
      return NextResponse.redirect(url);
    }
  }

  // Proteksi isolasi rute marketing vs penagihan
  if (pathname.startsWith('/kunjungan') && role === 'penagihan') {
    const url = request.nextUrl.clone();
    url.pathname = '/penagihan';
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/penagihan') && role === 'marketing') {
    const url = request.nextUrl.clone();
    url.pathname = '/kunjungan';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
