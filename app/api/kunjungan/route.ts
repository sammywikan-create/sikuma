import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateHaversineDistanceM, calculateSpeedKmH } from '@/lib/utils/geo';
import { createSafeSlug } from '@/lib/utils/slug';
import { checkRateLimit } from '@/lib/security/rate-limit';
import type { VisitType, ProductType, OutcomeType, Profile, Visit, AppSetting, VisitPhoto } from '@/lib/types/database';

const VALID_VISIT_TYPES: VisitType[] = [
  'prospek_baru',
  'nasabah_existing',
  'penagihan',
  'survei_jaminan',
  'maintenance',
];

const VALID_PRODUCTS: ProductType[] = ['tabungan', 'deposito', 'kredit', 'lainnya'];

const VALID_OUTCOMES: OutcomeType[] = [
  'berminat',
  'follow_up',
  'realisasi',
  'tidak_berminat',
  'tidak_ditemui',
];

interface IncomingPhoto {
  dataUrl: string;
  sha256?: string;
  bytes?: number;
  width?: number;
  height?: number;
  sort_order: number;
}

interface IncomingVisitPayload {
  client_uuid: string;
  customer_name: string;
  visit_type: VisitType;
  product: ProductType;
  outcome: OutcomeType;
  potential_value?: number | null;
  baki_debet?: number | null;
  kolektibilitas?: 'kol_1' | 'kol_2' | 'kol_3' | 'kol_4' | 'kol_5' | null;
  notes?: string | null;
  captured_at: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  address?: string | null;
  photos: IncomingPhoto[];
}

interface SupabaseQueryHelper {
  insert: (record: unknown) => {
    select: () => {
      single: () => Promise<{ data: Visit | null; error: { message: string } | null }>;
    };
  };
}

interface SupabaseSimpleInsertHelper {
  insert: (record: unknown) => Promise<{ error: { message: string } | null }>;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verifikasi Autentikasi Pengguna
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' },
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
        { error: 'Hanya marketing atau petugas penagihan aktif yang dapat mencatat kunjungan.' },
        { status: 403 }
      );
    }

    // 1.1 Rate Limiting (Maksimal 30 request / menit per user)
    const rateLimit = checkRateLimit(`kunjungan_${user.id}`, 30, 60000);
    if (!rateLimit.isAllowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan pengiriman. Silakan tunggu ${Math.ceil(
            rateLimit.resetMs / 1000
          )} detik lagi.`,
        },
        { status: 429 }
      );
    }

    // 2. Parsing & Validasi Input
    const body = (await request.json()) as IncomingVisitPayload;

    if (!body.client_uuid) {
      return NextResponse.json(
        { error: 'client_uuid wajib disertakan untuk idempotensi.' },
        { status: 400 }
      );
    }

    const customerName = body.customer_name?.trim();
    if (!customerName) {
      return NextResponse.json(
        { error: 'Nama nasabah / calon nasabah wajib diisi.' },
        { status: 400 }
      );
    }

    if (!VALID_VISIT_TYPES.includes(body.visit_type)) {
      return NextResponse.json(
        { error: 'Jenis kunjungan tidak valid.' },
        { status: 400 }
      );
    }

    if (!VALID_PRODUCTS.includes(body.product)) {
      return NextResponse.json(
        { error: 'Produk yang dipilih tidak valid.' },
        { status: 400 }
      );
    }

    if (!VALID_OUTCOMES.includes(body.outcome)) {
      return NextResponse.json(
        { error: 'Hasil kunjungan tidak valid.' },
        { status: 400 }
      );
    }

    if (!body.photos || body.photos.length === 0) {
      return NextResponse.json(
        { error: 'Minimal 1 foto kunjungan ber-watermark wajib disertakan.' },
        { status: 400 }
      );
    }

    // Validasi format dan ukuran setiap foto
    for (const photo of body.photos) {
      if (!photo.dataUrl || (!photo.dataUrl.startsWith('data:image/jpeg') && !photo.dataUrl.startsWith('data:image/jpg'))) {
        return NextResponse.json(
          { error: 'Format berkas foto tidak valid. Hanya foto JPEG/JPG dari kamera yang diizinkan.' },
          { status: 400 }
        );
      }
      // Batasi ukuran base64 payload maksimal 10MB
      if (photo.dataUrl.length > 14 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Ukuran foto melebihi batas maksimal (10 MB).' },
          { status: 400 }
        );
      }
    }

    if (body.photos.length > 3) {
      return NextResponse.json(
        { error: 'Maksimal 3 foto per kunjungan.' },
        { status: 400 }
      );
    }

    // 3. Pengecekan Idempotensi (client_uuid)
    const { data: existingVisit } = (await supabase
      .from('visits')
      .select('*')
      .eq('client_uuid', body.client_uuid)
      .maybeSingle()) as { data: Visit | null };

    if (existingVisit) {
      return NextResponse.json({
        success: true,
        message: 'Kunjungan telah tersimpan sebelumnya (idempoten).',
        visit: existingVisit,
      });
    }

    // 4. Perhitungan Server-side: Keterlambatan Kirim (is_late)
    const receivedAt = new Date();
    const capturedDate = new Date(body.captured_at || receivedAt.toISOString());

    // Ambil jam batas dari app_settings (default "21:00")
    const { data: cutoffSetting } = (await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'jam_batas_unggah')
      .maybeSingle()) as { data: AppSetting | null };

    const cutoffTimeStr = (cutoffSetting?.value as string) || '21:00';
    const [cutoffHour, cutoffMinute] = cutoffTimeStr.replace(/"/g, '').split(':').map(Number);

    // Hitung waktu batas dalam WIB (UTC+7)
    const receivedWIBHours = (receivedAt.getUTCHours() + 7) % 24;
    const receivedWIBMinutes = receivedAt.getUTCMinutes();

    const isDifferentDay =
      receivedAt.getTime() - capturedDate.getTime() > 24 * 60 * 60 * 1000;

    const isLate =
      isDifferentDay ||
      receivedWIBHours > cutoffHour ||
      (receivedWIBHours === cutoffHour && receivedWIBMinutes > (cutoffMinute || 0));

    // 5. Deteksi Anomali Server-Side
    const anomalyFlags: string[] = [];

    // Anomali 1: Akurasi Rendah & Mencurigakan
    const accuracy = Number(body.accuracy_m) || 0;
    if (accuracy > 50) {
      anomalyFlags.push('akurasi_rendah');
    }
    if (accuracy < 3 || accuracy === 0) {
      anomalyFlags.push('akurasi_mencurigakan');
    }

    // Anomali 2: Terlambat Kirim
    if (isLate) {
      anomalyFlags.push('terlambat_kirim');
    }

    // Anomali 3 & 4: Kecepatan Tidak Wajar & Lokasi Kembar
    const startOfDay = new Date(capturedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const { data: recentVisits } = (await supabase
      .from('visits')
      .select('*')
      .eq('marketing_id', user.id)
      .gte('captured_at', startOfDay.toISOString())
      .order('captured_at', { ascending: false })) as { data: Visit[] | null };

    if (recentVisits && recentVisits.length > 0) {
      const lastVisit = recentVisits[0];
      const lastCaptured = new Date(lastVisit.captured_at);
      const timeDiffSec = Math.abs(capturedDate.getTime() - lastCaptured.getTime()) / 1000;
      const distanceM = calculateHaversineDistanceM(
        body.lat,
        body.lng,
        lastVisit.lat,
        lastVisit.lng
      );

      if (timeDiffSec > 0) {
        const speedKmH = calculateSpeedKmH(distanceM, timeDiffSec);
        if (speedKmH > 120) {
          anomalyFlags.push('kecepatan_tidak_wajar');
        }
      }

      for (const rv of recentVisits) {
        const dM = calculateHaversineDistanceM(body.lat, body.lng, rv.lat, rv.lng);
        if (dM < 20 && rv.customer_name.toLowerCase() !== customerName.toLowerCase()) {
          if (!anomalyFlags.includes('lokasi_kembar')) {
            anomalyFlags.push('lokasi_kembar');
          }
          break;
        }
      }
    }

    // Anomali 5: Cek Foto Duplikat (SHA-256)
    const photoHashes = body.photos.map((p) => p.sha256).filter(Boolean) as string[];
    if (photoHashes.length > 0) {
      const { data: dupPhotos } = (await supabase
        .from('visit_photos')
        .select('sha256')
        .in('sha256', photoHashes)) as { data: Pick<VisitPhoto, 'sha256'>[] | null };

      if (dupPhotos && dupPhotos.length > 0) {
        anomalyFlags.push('foto_duplikat');
      }
    }

    // 6. Simpan Baris Kunjungan ke Database
    const visitTable = supabase.from('visits') as unknown as SupabaseQueryHelper;
    const { data: newVisit, error: visitError } = await visitTable
      .insert({
        client_uuid: body.client_uuid,
        marketing_id: user.id,
        customer_name: customerName,
        visit_type: body.visit_type,
        product: body.product,
        outcome: body.outcome,
        potential_value: body.potential_value ? Number(body.potential_value) : null,
        baki_debet: body.baki_debet ? Number(body.baki_debet) : null,
        kolektibilitas: body.kolektibilitas || null,
        notes: body.notes?.trim() || null,
        captured_at: capturedDate.toISOString(),
        received_at: receivedAt.toISOString(),
        lat: Number(body.lat),
        lng: Number(body.lng),
        accuracy_m: accuracy,
        address: body.address?.trim() || null,
        anomaly_flags: anomalyFlags,
        is_late: isLate,
        verification_status: 'pending',
      })
      .select()
      .single();

    if (visitError || !newVisit) {
      console.error('Error insert visit:', visitError);
      return NextResponse.json(
        { error: `Gagal menyimpan kunjungan: ${visitError?.message || 'Database error'}` },
        { status: 500 }
      );
    }

    // 7. Unggah Berkas Foto ke Storage Privat 'kunjungan'
    const year = capturedDate.getUTCFullYear().toString();
    const month = (capturedDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = capturedDate.getUTCDate().toString().padStart(2, '0');
    const hours = (capturedDate.getUTCHours() + 7) % 24;
    const mins = capturedDate.getUTCMinutes();
    const timeHHmm = `${hours.toString().padStart(2, '0')}${mins.toString().padStart(2, '0')}`;
    const dateFormatted = `${year}-${month}-${day}`;

    const marketingCode = profile.marketing_code || 'MKT00';
    const marketingSlug = createSafeSlug(profile.full_name);
    const customerSlug = createSafeSlug(customerName);

    const folderPrefix = `${year}/${month}/${marketingCode}_${marketingSlug}/${dateFormatted}`;

    const photoTable = supabase.from('visit_photos') as unknown as SupabaseSimpleInsertHelper;

    for (let i = 0; i < body.photos.length; i++) {
      const photo = body.photos[i];
      const sortOrder = photo.sort_order || i + 1;
      const fileName = `${dateFormatted}_${timeHHmm}_${marketingCode}_${customerSlug}_${sortOrder}.jpg`;
      const storagePath = `${folderPrefix}/${fileName}`;

      const base64Data = photo.dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const { error: uploadError } = await supabase.storage
        .from('kunjungan')
        .upload(storagePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn(`Gagal unggah storage ${storagePath}:`, uploadError.message);
      }

      await photoTable.insert({
        visit_id: newVisit.id,
        storage_path: storagePath,
        bytes: photo.bytes || buffer.length,
        width: photo.width || null,
        height: photo.height || null,
        sha256: photo.sha256 || null,
        sort_order: sortOrder,
      });
    }

    // 8. Catat Log Audit Penambahan Kunjungan
    const auditTable = supabase.from('audit_log') as unknown as SupabaseSimpleInsertHelper;
    await auditTable.insert({
      actor_id: user.id,
      action: 'visit_created',
      entity: 'visits',
      entity_id: newVisit.id,
      payload: {
        customer_name: customerName,
        visit_type: body.visit_type,
        product: body.product,
        outcome: body.outcome,
        potential_value: body.potential_value,
        photo_count: body.photos.length,
        anomaly_flags: anomalyFlags,
        is_late: isLate,
      },
    });

    return NextResponse.json({
      success: true,
      visitId: newVisit.id,
      anomaly_flags: anomalyFlags,
      is_late: isLate,
      message: 'Kunjungan berhasil disimpan.',
    });
  } catch (err: unknown) {
    console.error('Fatal error di /api/kunjungan:', err);
    return NextResponse.json(
      { error: `Terjadi kesalahan pada server: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
