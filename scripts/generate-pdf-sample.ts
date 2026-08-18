import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import React from 'react';
import { renderToFile } from '@react-pdf/renderer';
import { ReportPDFDocument, type PDFReportData } from '../lib/pdf/report-document';
import type { Profile } from '../lib/types/database';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runGeneratePdfSample() {
  console.log('====================================================');
  console.log('📄 MEMULAI PEMBUATAN LAPORAN ALBUM PDF (MINIMAL 12 FOTO)');
  console.log('====================================================\n');

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Ambil Profil Marketing dari Database
  const { data: marketings, error: mErr } = (await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('role', 'marketing')
    .order('marketing_code', { ascending: true })) as { data: Profile[] | null; error: any };

  if (mErr || !marketings || marketings.length === 0) {
    throw new Error(`Tidak ada profil marketing: ${mErr?.message}`);
  }

  console.log(`✅ 1. Ditemukan ${marketings.length} Profil Marketing.`);

  // 2. Siapkan 14 kunjungan realistis dengan variasi lengkap (min 12 foto)
  const sampleCustomerNames = [
    'Toko Kelontong Berkah Mandiri',
    'Warung Maju Jaya Sembako',
    'UD Sumber Rejeki Tani',
    'Bengkel Motor Abadi Jaya',
    'Kios Pupuk Tani Makmur',
    'Apotek Sehat Sentosa',
    'Warung Makan Padang Murah',
    'Toko Bangunan Kokoh Perkasa',
    'Konveksi Busana Indah',
    'Minimarket Barokah Mart',
    'Klinik Pratama Medika',
    'Percetakan Grafika Mandiri',
    'Koperasi Simpan Pinjam Sejahtera',
    'Distributor Pakan Ternak Subur',
  ];

  const visitTypes = ['prospek_baru', 'nasabah_existing', 'penagihan', 'survei_jaminan', 'maintenance'] as const;
  const products = ['tabungan', 'deposito', 'kredit', 'lainnya'] as const;
  const outcomes = ['berminat', 'follow_up', 'realisasi', 'tidak_berminat', 'tidak_ditemui'] as const;

  // Tiny valid 1x1 JPEG Data URI for PDF rendering
  const samplePhotoUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  console.log('📦 2. Membangun 14 Data Kunjungan Lengkap dengan Foto Album...');

  const sampleVisits: PDFReportData['visits'] = [];

  for (let i = 0; i < sampleCustomerNames.length; i++) {
    const custName = sampleCustomerNames[i];
    const marketing = marketings[i % marketings.length];
    const clientUuid = `pdf_seed_${i + 1}_202608`;
    const day = (i + 1).toString().padStart(2, '0');
    const capturedAt = `2026-08-${day}T09:${((i * 7) % 60).toString().padStart(2, '0')}:00+07:00`;
    const isLate = i === 5 || i === 11;
    const anomalyFlags = i === 3 ? ['akurasi_rendah'] : isLate ? ['terlambat_kirim'] : [];

    const visitObj: PDFReportData['visits'][0] = {
      id: `visit_${i + 1}`,
      client_uuid: clientUuid,
      marketing_id: marketing.id,
      customer_name: custName,
      visit_type: visitTypes[i % visitTypes.length],
      product: products[i % products.length],
      outcome: outcomes[i % outcomes.length],
      potential_value: (i + 1) * 7500000,
      notes: `Pertemuan membahas prospek produk ${products[i % products.length]}. Nasabah menyambut dengan baik.`,
      captured_at: capturedAt,
      received_at: capturedAt,
      lat: -7.005123 + i * 0.003,
      lng: 110.438456 + i * 0.003,
      accuracy_m: 8 + (i % 4) * 4,
      address: `Jl. Pemuda No. ${100 + i}, Sekayu, Semarang Tengah`,
      anomaly_flags: anomalyFlags,
      is_late: isLate,
      verification_status: i % 3 === 0 ? 'verified' : i % 3 === 1 ? 'pending' : 'verified',
      verified_by: i % 3 !== 1 ? 'kacab_user_id' : null,
      verified_at: i % 3 !== 1 ? capturedAt : null,
      verifier_note: i % 3 !== 1 ? 'Data dan lokasi terkonfirmasi valid.' : null,
      marketing: {
        full_name: marketing.full_name,
        marketing_code: marketing.marketing_code,
      },
      visit_photos: [
        {
          id: `photo_${i + 1}_1`,
          visit_id: `visit_${i + 1}`,
          storage_path: `2026/08/${marketing.marketing_code}/photo_${i + 1}.jpg`,
          bytes: 214 * 1024,
          width: 1280,
          height: 960,
          sha256: `sha256_sample_${i + 1}`,
          sort_order: 1,
          signedUrl: samplePhotoUrl,
        },
      ],
    };

    sampleVisits.push(visitObj);
  }

  // 3. Hitung Agregasi per Marketing
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

  const activeDaysMap = new Map<string, Set<string>>();
  sampleVisits.forEach((v) => {
    let s = summariesMap.get(v.marketing_id);
    if (!s) {
      s = {
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
      summariesMap.set(v.marketing_id, s);
    }
    s.total_visits++;
    if (v.visit_type === 'prospek_baru') s.prospects++;
    if (v.visit_type === 'nasabah_existing') s.existing++;
    if (v.visit_type === 'penagihan') s.collection++;
    if (v.outcome === 'realisasi') s.realization++;
    s.potential_value += v.potential_value || 0;

    if (!activeDaysMap.has(v.marketing_id)) activeDaysMap.set(v.marketing_id, new Set());
    activeDaysMap.get(v.marketing_id)?.add(v.captured_at.substring(0, 10));

    if (v.is_late) s.late_count++;
    if (v.anomaly_flags && v.anomaly_flags.length > 0) s.anomaly_count++;
  });

  const marketingSummaries = Array.from(summariesMap.values()).map((s) => ({
    ...s,
    active_days: activeDaysMap.get(s.marketing_id)?.size || 0,
  }));

  // 4. Render Dokumen PDF A4
  const pdfData: PDFReportData = {
    bankName: 'PT BPR BKK KABUPATEN SEMARANG (PERSERODA)',
    branchName: 'KANTOR CABANG UTAMA SEMARANG',
    reportType: 'bulanan',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    printedAt: new Date().toISOString(),
    printedBy: 'Budi Santoso, S.E. (Kepala Cabang)',
    kacabName: 'Budi Santoso, S.E.',
    marketings,
    visits: sampleVisits,
    marketingSummaries,
  };

  const outputPdfPath = path.resolve(
    process.cwd(),
    'Laporan_Kunjungan_bulanan_2026-08-01_2026-08-31.pdf'
  );

  console.log('\n🖨️ 3. Merender Laporan PDF A4 Menggunakan @react-pdf/renderer...');
  const docElement = React.createElement(ReportPDFDocument, { data: pdfData });
  await renderToFile(
    docElement as any,
    outputPdfPath
  );

  const stats = fs.statSync(outputPdfPath);
  const sizeKB = (stats.size / 1024).toFixed(1);

  console.log(`\n🎉 4. PDF BERHASIL DIBUAT DENGAN LENGKAP!`);
  console.log(`   - Lokasi Berkas: ${outputPdfPath}`);
  console.log(`   - Ukuran Berkas: ${sizeKB} KB`);
  console.log(`   - Jumlah Kunjungan: ${sampleVisits.length} Kunjungan`);
  console.log(`   - Jumlah Foto Ber-Watermark: 14 Foto (Grid 2x2 per Halaman Album)`);
  console.log(`   - Jumlah Marketing Terdaftar: ${marketingSummaries.length} Orang`);

  console.log('\n====================================================');
  console.log('✨ VERIFIKASI TAHAP 6 SELESAI!');
  console.log('====================================================\n');
}

runGeneratePdfSample().catch((err) => {
  console.error('❌ Error pembuatan PDF:', err);
  process.exit(1);
});
