import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { getWIBDateParts } from '@/lib/utils/time';
import { createSafeSlug } from '@/lib/utils/slug';
import type { Profile } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: 'Autentikasi gagal. Sesi tidak valid.' },
        { status: 401 }
      );
    }

    const { data: profile } = (await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()) as { data: Profile | null };

    if (!profile || !profile.is_active || (profile.role !== 'marketing' && profile.role !== 'penagihan')) {
      return NextResponse.json(
        { error: 'Akses ditolak. Hanya Marketing atau Penagihan aktif yang dapat mengunggah foto.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const capturedAtStr = body.captured_at ? String(body.captured_at) : new Date().toISOString();
    const capturedDate = new Date(capturedAtStr);

    const { year, month, day } = getWIBDateParts(capturedDate);
    const mCode = profile.marketing_code || 'MKT00';
    const mSlug = createSafeSlug(profile.full_name);
    const fileId = crypto.randomUUID();

    // Jalur penyimpanan resmi yang ditentukan server (Klien TIDAK boleh menentukan sendiri)
    const storagePath = `${year}/${month}/${mCode}_${mSlug}/${year}-${month}-${day}/${fileId}.jpg`;

    const adminClient = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await adminClient.storage
      .from('kunjungan')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('[STORAGE] Gagal membuat signed upload URL:', error?.message);
      return NextResponse.json(
        { error: `Gagal mempersiapkan URL unggah: ${error?.message || 'Storage error'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      storage_path: storagePath,
      signed_url: data.signedUrl,
      token: data.token,
    });
  } catch (err: unknown) {
    console.error('[STORAGE] Error di route unggah-url:', err);
    return NextResponse.json(
      { error: `Terjadi galat server: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
