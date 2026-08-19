import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { formatWIB, getWIBDayBoundsUtc, getWIBDateParts, getWIBDateString } from '@/lib/utils/time';
import { writeAuditLog } from '@/lib/audit/log';
import type { Profile, VisitType, ProductType, OutcomeType } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Sesi tidak valid atau telah berakhir.' }, { status: 401 });
    }

    const { data: profile } = (await supabase
      .from('profiles')
      .select('role, is_active, full_name')
      .eq('id', user.id)
      .single()) as { data: Pick<Profile, 'role' | 'is_active' | 'full_name'> | null };

    if (!profile || !profile.is_active || (profile.role !== 'kacab' && profile.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Hanya Kepala Cabang atau Administrator yang berhak mengekspor data CSV.' },
        { status: 403 }
      );
    }

    // Parse Parameter Filter
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'dasbor';
    const shortcut = searchParams.get('shortcut') || 'semua';
    const periode = searchParams.get('periode');
    const customDari = searchParams.get('dari');
    const customSampai = searchParams.get('sampai');
    const marketingFilter = searchParams.get('marketing') || 'semua';
    const statusFilter = searchParams.get('status') || 'semua';
    const visitTypeFilter = searchParams.get('visit_type') || 'semua';
    const productFilter = searchParams.get('product') || 'semua';
    const anomaliFilter = searchParams.get('anomali') || 'semua';
    const flagFilter = searchParams.get('flag') || 'semua';
    const searchQuery = searchParams.get('q')?.trim() || '';

    const adminClient = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 1. Tentukan Batas Rentang Waktu WIB
    const now = new Date();
    let startUtc: Date | null = null;
    let endUtc: Date | null = null;

    if (periode === 'minggu_ini') {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
      const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
      startUtc = getWIBDayBoundsUtc(monday).startUtc;
      endUtc = getWIBDayBoundsUtc(sunday).endUtc;
    } else if (periode === 'bulan_lalu') {
      const { year, month } = getWIBDateParts(now);
      const currentMonthNum = parseInt(month, 10);
      const prevMonthNum = currentMonthNum === 1 ? 12 : currentMonthNum - 1;
      const prevYearNum = currentMonthNum === 1 ? parseInt(year, 10) - 1 : parseInt(year, 10);
      const prevMonthStr = String(prevMonthNum).padStart(2, '0');
      startUtc = new Date(`${prevYearNum}-${prevMonthStr}-01T00:00:00.000+07:00`);
      endUtc = new Date(new Date(`${year}-${month}-01T00:00:00.000+07:00`).getTime() - 1);
    } else if (periode === 'bulan_ini' || shortcut === 'bulan_ini') {
      const { year, month } = getWIBDateParts(now);
      startUtc = new Date(`${year}-${month}-01T00:00:00.000+07:00`);
      const nextMonth = parseInt(month, 10) === 12 ? 1 : parseInt(month, 10) + 1;
      const nextYear = parseInt(month, 10) === 12 ? parseInt(year, 10) + 1 : parseInt(year, 10);
      const nextMonthStr = String(nextMonth).padStart(2, '0');
      endUtc = new Date(new Date(`${nextYear}-${nextMonthStr}-01T00:00:00.000+07:00`).getTime() - 1);
    } else if (shortcut === 'hari_ini') {
      const bounds = getWIBDayBoundsUtc(now);
      startUtc = bounds.startUtc;
      endUtc = bounds.endUtc;
    } else if (shortcut === '7_hari') {
      const boundsNow = getWIBDayBoundsUtc(now);
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startUtc = getWIBDayBoundsUtc(past7).startUtc;
      endUtc = boundsNow.endUtc;
    } else if (shortcut === '30_hari') {
      const boundsNow = getWIBDayBoundsUtc(now);
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startUtc = getWIBDayBoundsUtc(past30).startUtc;
      endUtc = boundsNow.endUtc;
    } else if (customDari && customSampai) {
      startUtc = getWIBDayBoundsUtc(customDari).startUtc;
      endUtc = getWIBDayBoundsUtc(customSampai).endUtc;
    }

    // 2. Bangun Kueri Aman
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (adminClient as any)
      .from('visits')
      .select(`
        id,
        client_uuid,
        customer_name,
        visit_type,
        product,
        outcome,
        potential_value,
        baki_debet,
        kolektibilitas,
        notes,
        captured_at,
        lat,
        lng,
        accuracy_m,
        address,
        is_late,
        anomaly_flags,
        verification_status,
        verifier_note,
        marketing:profiles!marketing_id (full_name, marketing_code)
      `)
      .order('captured_at', { ascending: false })
      .limit(3000);

    if (startUtc) query = query.gte('captured_at', startUtc.toISOString());
    if (endUtc) query = query.lte('captured_at', endUtc.toISOString());
    if (marketingFilter !== 'semua') query = query.eq('marketing_id', marketingFilter);
    if (statusFilter !== 'semua') query = query.eq('verification_status', statusFilter);
    if (visitTypeFilter !== 'semua') query = query.eq('visit_type', visitTypeFilter);
    if (productFilter !== 'semua') query = query.eq('product', productFilter);
    if (anomaliFilter === 'true' || source === 'anomali') query = query.not('anomaly_flags', 'eq', '{}');
    if (flagFilter !== 'semua') query = query.contains('anomaly_flags', [flagFilter]);
    if (searchQuery) query = query.ilike('customer_name', `%${searchQuery}%`);

    const { data: visitsRaw, error: queryErr } = await query;

    if (queryErr) {
      console.error('[CSV] Gagal mengeksekusi kueri ekspor:', queryErr.message);
      return NextResponse.json({ error: `Gagal mengambil data ekspor: ${queryErr.message}` }, { status: 500 });
    }

    interface VisitCsvRow {
      id: string;
      customer_name: string;
      visit_type: VisitType;
      product: ProductType;
      outcome: OutcomeType;
      potential_value: number | null;
      baki_debet: number | null;
      kolektibilitas: string | null;
      notes: string | null;
      captured_at: string;
      lat: number;
      lng: number;
      accuracy_m: number | null;
      address: string | null;
      is_late: boolean;
      anomaly_flags: string[];
      verification_status: string;
      verifier_note: string | null;
      marketing?: { full_name: string; marketing_code: string } | null;
    }

    const visits: VisitCsvRow[] = visitsRaw || [];

    // 3. Susun Baris CSV Berstandar Excel UTF-8 BOM
    const headers = [
      'No',
      'ID Kunjungan',
      'Waktu WIB',
      'Kode Petugas',
      'Nama Petugas',
      'Nama Nasabah',
      'Jenis Kunjungan',
      'Produk',
      'Hasil Pertemuan',
      'Nilai Potensi (Rp)',
      'Baki Debet (Rp)',
      'Kolektibilitas',
      'Status Verifikasi',
      'Catatan Verifikator',
      'Status Keterlambatan',
      'Indikasi Anomali',
      'Alamat',
      'Koordinat GPS',
    ];

    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvRows: string[] = [];
    csvRows.push(headers.map((h) => `"${h}"`).join(','));

    visits.forEach((v, idx) => {
      const row = [
        idx + 1,
        v.id,
        formatWIB(v.captured_at),
        v.marketing?.marketing_code || '-',
        v.marketing?.full_name || 'Petugas',
        v.customer_name,
        v.visit_type ? v.visit_type.replace(/_/g, ' ') : '-',
        v.product || '-',
        v.outcome ? v.outcome.replace(/_/g, ' ') : '-',
        v.potential_value || 0,
        v.baki_debet || 0,
        v.kolektibilitas ? v.kolektibilitas.replace(/_/g, ' ') : '-',
        v.verification_status === 'verified'
          ? 'Terverifikasi'
          : v.verification_status === 'rejected'
          ? 'Ditolak'
          : 'Menunggu',
        v.verifier_note || '-',
        v.is_late ? 'Terlambat' : 'Tepat Waktu',
        v.anomaly_flags && v.anomaly_flags.length > 0 ? v.anomaly_flags.join('; ') : 'Tidak Ada',
        v.address || '-',
        `${v.lat.toFixed(6)}, ${v.lng.toFixed(6)}`,
      ];
      csvRows.push(row.map(escapeCsv).join(','));
    });

    // UTF-8 BOM (\uFEFF) di awal berkas agar Microsoft Excel membaca karakter beraksen/Indonesia dengan tepat
    const csvContent = '\uFEFF' + csvRows.join('\r\n');

    // 4. Catat Ekspor ke Audit Log
    await writeAuditLog(adminClient, {
      actorId: user.id,
      action: 'export_csv',
      entity: 'visits',
      payload: {
        source,
        row_count: visits.length,
        filter_params: Object.fromEntries(searchParams.entries()),
        actor_name: profile.full_name,
      },
    });

    const dateStr = getWIBDateString(now).replace(/-/g, '');
    const filename = `Rekap_Kunjungan_SIKUMA_${source}_${dateStr}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    console.error('[CSV] Error fatal ekspor CSV:', err);
    return NextResponse.json(
      { error: `Terjadi galat pembuatan berkas CSV: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
