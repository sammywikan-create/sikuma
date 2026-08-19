import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Cocokkan semua jalur kecuali:
     * - _next/static & _next/image (berkas statis Next.js)
     * - manifest.json & sw.js (berkas PWA)
     * - favicon.ico, sitemap.xml, robots.txt
     * - folder icons/ dan semua aset gambar/font
     */
    '/((?!_next/static|_next/image|manifest\\.json|sw\\.js|favicon\\.ico|sitemap\\.xml|robots\\.txt|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)',
  ],
};
