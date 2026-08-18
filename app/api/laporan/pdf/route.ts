/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { type ReactElement } from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { PassThrough } from 'stream';
import { ReportPDFDocument, type PDFReportData } from '@/lib/pdf/report-document';
import type { Profile, Visit, VisitPhoto } from '@/lib/types/database';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verifikasi Autentikasi Pengguna (Kacab / Admin)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Sesi Anda telah berakhir. Silakan login kembali.' },
        { status: 401 }
      );
    }

    const { data: userProfile } = (await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()) as { data: Profile | null };

    if (!userProfile || (userProfile.role !== 'kacab' && userProfile.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Hanya Kepala Cabang atau Admin yang berhak mengunduh laporan PDF.' },
        { status: 403 }
      );
    }

    // 1.1 Rate Limiting (Maksimal 10 unduhan PDF / menit per pengguna)
    const { checkRateLimit } = await import('@/lib/security/rate-limit');
    const rateLimit = checkRateLimit(`pdf_${user.id}`, 10, 60000);
    if (!rateLimit.isAllowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan unduh laporan PDF. Silakan tunggu ${Math.ceil(
            rateLimit.resetMs / 1000
          )} detik lagi.`,
        },
        { status: 429 }
      );
    }

    // 2. Parse Query Parameters
    const { searchParams } = new URL(request.url);
    const jenis = (searchParams.get('jenis') || 'bulanan') as 'harian' | 'mingguan' | 'bulanan';
    const kategori = (searchParams.get('kategori') || 'semua') as 'semua' | 'pemasaran' | 'penagihan';
    const dari = searchParams.get('dari') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10);
    const sampai = searchParams.get('sampai') || new Date().toISOString().substring(0, 10);
    const marketingFilter = searchParams.get('marketing');

    const startDate = new Date(dari);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(sampai);
    endDate.setHours(23, 59, 59, 999);

    // 3. Ambil Pengaturan Cabang dari app_settings
    const { data: settingsRaw } = (await supabase
      .from('app_settings')
      .select('*')) as { data: { key: string; value: unknown }[] | null };

    const settingsMap = new Map<string, string>();
    settingsRaw?.forEach((s) => {
      settingsMap.set(s.key, typeof s.value === 'string' ? s.value.replace(/"/g, '') : String(s.value));
    });

    const bankName = settingsMap.get('nama_aplikasi') || 'BANK BKK';
    const branchName = 'KANTOR CABANG UTAMA SEMARANG';
    const kacabName = userProfile.role === 'kacab' ? userProfile.full_name : 'Budi Santoso, S.E. (Kepala Cabang)';

    // 4. Query Data Marketing
    let marketingQuery = supabase.from('profiles').select('*').eq('role', 'marketing');
    if (marketingFilter && marketingFilter !== 'semua') {
      const ids = marketingFilter.split(',');
      marketingQuery = marketingQuery.in('id', ids);
    }

    const { data: marketingProfilesRaw } = (await marketingQuery.order('marketing_code', {
      ascending: true,
    })) as { data: Profile[] | null };

    const marketings = marketingProfilesRaw || [];

    // 5. Query Kunjungan Beserta Foto
    let visitQuery = supabase
      .from('visits')
      .select(`
        *,
        marketing:profiles!marketing_id (full_name, marketing_code),
        visit_photos (*)
      `)
      .gte('captured_at', startDate.toISOString())
      .lte('captured_at', endDate.toISOString())
      .order('captured_at', { ascending: false });

    if (kategori === 'penagihan') {
      visitQuery = visitQuery.eq('visit_type', 'penagihan');
    } else if (kategori === 'pemasaran') {
      visitQuery = visitQuery.neq('visit_type', 'penagihan');
    }

    if (marketingFilter && marketingFilter !== 'semua') {
      const ids = marketingFilter.split(',');
      visitQuery = visitQuery.in('marketing_id', ids);
    }

    const { data: visitsRaw } = (await visitQuery) as {
      data: (Visit & {
        marketing?: Pick<Profile, 'full_name' | 'marketing_code'> | null;
        visit_photos: VisitPhoto[];
      })[] | null;
    };

    const visits = visitsRaw || [];

    // 6. Buat Signed URLs untuk Setiap Foto di Storage Bucket
    let totalPhotoCount = 0;
    for (const v of visits) {
      if (v.visit_photos && Array.isArray(v.visit_photos)) {
        for (const p of v.visit_photos) {
          totalPhotoCount++;
          if (p.storage_path) {
            const { data: signed } = await supabase.storage
              .from('kunjungan')
              .createSignedUrl(p.storage_path, 600);
            if (signed?.signedUrl) {
              (p as unknown as { signedUrl: string }).signedUrl = signed.signedUrl;
            }
          }
        }
      }
    }

    // 7. Hitung Agregasi Ringkasan per Marketing
    const summariesMap = new Map<string, PDFReportData['marketingSummaries'][0]>();
    marketings.forEach((m) => {
      summariesMap.set(m.id, {
        marketing_id: m.id,
        marketing_name: m.full_name,
        marketing_code: m.marketing_code || '-',
        total_visits: 0,
        prospects: 0,
        existing: 0,
        collection: 0,
        realization: 0,
        potential_value: 0,
        active_days: 0,
        late_count: 0,
        anomaly_count: 0,
      });
    });

    const activeDaysPerMarketing = new Map<string, Set<string>>();

    visits.forEach((v) => {
      let entry = summariesMap.get(v.marketing_id);
      if (!entry) {
        entry = {
          marketing_id: v.marketing_id,
          marketing_name: v.marketing?.full_name || 'Marketing',
          marketing_code: v.marketing?.marketing_code || '-',
          total_visits: 0,
          prospects: 0,
          existing: 0,
          collection: 0,
          realization: 0,
          potential_value: 0,
          active_days: 0,
          late_count: 0,
          anomaly_count: 0,
        };
        summariesMap.set(v.marketing_id, entry);
      }

      entry.total_visits++;
      if (v.visit_type === 'prospek_baru') entry.prospects++;
      if (v.visit_type === 'nasabah_existing') entry.existing++;
      if (v.visit_type === 'penagihan') entry.collection++;
      if (v.outcome === 'realisasi') entry.realization++;
      entry.potential_value += v.potential_value || 0;

      if (!activeDaysPerMarketing.has(v.marketing_id)) {
        activeDaysPerMarketing.set(v.marketing_id, new Set());
      }
      activeDaysPerMarketing.get(v.marketing_id)?.add(v.captured_at.substring(0, 10));

      if (v.is_late) entry.late_count++;
      if (v.anomaly_flags && v.anomaly_flags.length > 0) entry.anomaly_count++;
    });

    const marketingSummaries = Array.from(summariesMap.values()).map((s) => ({
      ...s,
      active_days: activeDaysPerMarketing.get(s.marketing_id)?.size || 0,
    }));

    // 8. Logika Pemecahan ZIP Bila Total Foto > 200
    if (totalPhotoCount > 200) {
      const archiverModule: any = await import('archiver');
      const archiverFn = (archiverModule.default || archiverModule) as (format: string, options: unknown) => {
        append: (source: unknown, data: { name: string }) => void;
        finalize: () => Promise<void>;
        pipe: (dest: unknown) => void;
      };
      const archive = archiverFn('zip', { zlib: { level: 6 } });
      const passThrough = new PassThrough();
      archive.pipe(passThrough);

      const chunks: Buffer[] = [];
      passThrough.on('data', (chunk) => chunks.push(chunk));

      for (const m of marketings) {
        const mVisits = visits.filter((v) => v.marketing_id === m.id);
        const mSummaries = marketingSummaries.filter((s) => s.marketing_id === m.id);

        const mReportData: PDFReportData = {
          bankName,
          branchName,
          reportType: jenis,
          startDate: dari,
          endDate: sampai,
          printedAt: new Date().toISOString(),
          printedBy: userProfile.full_name,
          kacabName,
          marketings: [m],
          visits: mVisits as unknown as PDFReportData['visits'],
          marketingSummaries: mSummaries,
        };

        const docElement = React.createElement(ReportPDFDocument, { data: mReportData });
        const pdfBuffer = await renderToBuffer(docElement as unknown as ReactElement<DocumentProps>);

        archive.append(pdfBuffer, {
          name: `Laporan_Kunjungan_${m.marketing_code}_${jenis}_${dari}_${sampai}.pdf`,
        });
      }

      await archive.finalize();

      const zipFileName = `Laporan_Kunjungan_${jenis}_${dari}_${sampai}.zip`;
      return new NextResponse(Buffer.concat(chunks) as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${zipFileName}"`,
        },
      });
    }

    // 9. Jika <= 200 Foto: Render PDF Tunggal
    const reportData: PDFReportData = {
      bankName,
      branchName,
      reportType: jenis,
      category: kategori,
      startDate: dari,
      endDate: sampai,
      printedAt: new Date().toISOString(),
      printedBy: userProfile.full_name,
      kacabName,
      marketings,
      visits: visits as unknown as PDFReportData['visits'],
      marketingSummaries,
    };

    const docElement = React.createElement(ReportPDFDocument, { data: reportData });
    const pdfBuffer = await renderToBuffer(docElement as unknown as ReactElement<DocumentProps>);

    const prefix =
      kategori === 'penagihan'
        ? 'Laporan_Penagihan_AO'
        : kategori === 'pemasaran'
        ? 'Laporan_Kunjungan_Marketing'
        : 'Laporan_Kunjungan_Rekap';

    const pdfFileName = `${prefix}_${jenis}_${dari}_${sampai}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFileName}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err: unknown) {
    console.error('Fatal error saat pembuatan laporan PDF:', err);
    return NextResponse.json(
      { error: `Gagal membuat berkas PDF: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
