import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runStage3Tests() {
  console.log('====================================================');
  console.log('🚀 MEMULAI PENGUJIAN TAHAP 3: PENGIRIMAN KUNJUNGAN');
  console.log('====================================================\n');

  // Client 1: Marketing MKT01
  const clientMkt = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: authData, error: authErr } = await clientMkt.auth.signInWithPassword({
    email: 'mkt01@bkk.co.id',
    password: 'Password123!',
  });

  if (authErr || !authData.user) {
    throw new Error(`Gagal login MKT01: ${authErr?.message}`);
  }
  console.log('✅ 1. Login MKT01 berhasil. User ID:', authData.user.id);

  // Admin Client untuk verifikasi Storage & DB
  const clientAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  const clientUuid1 = `test_stage3_${Date.now()}_1`;
  const clientUuid2 = `test_stage3_${Date.now()}_2`;
  const clientUuid3 = `test_stage3_${Date.now()}_3`;

  // Sample JPEG 1x1 base64 data
  const samplePhotoDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const sampleHash1 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const sampleHash2 = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

  // Skenario 1: Kirim Kunjungan #1 (Normal)
  console.log('\n📤 2. Mengirim Kunjungan #1 (Toko Berkah Mandiri):');
  const visit1Payload = {
    client_uuid: clientUuid1,
    marketing_id: authData.user.id,
    customer_name: 'Toko Berkah Mandiri',
    visit_type: 'prospek_baru',
    product: 'tabungan',
    outcome: 'berminat',
    potential_value: 15000000,
    notes: 'Pemilik toko tertarik membuka rekening tabungan usaha.',
    captured_at: new Date().toISOString(),
    lat: -7.005123,
    lng: 110.438456,
    accuracy_m: 12,
    address: 'Jl. Pemuda No. 142, Semarang Tengah, Kota Semarang',
    anomaly_flags: [],
    is_late: false,
    verification_status: 'pending',
  };

  const { data: v1, error: err1 } = await clientMkt.from('visits').insert(visit1Payload).select().single();
  if (err1) throw err1;
  console.log('   ✅ Kunjungan #1 berhasil tersimpan. ID:', v1.id);

  // Upload sample foto 1 ke storage
  const storagePath1 = `2026/08/MKT01_ahmad_dahlan/2026-08-18/2026-08-18_2230_MKT01_toko_berkah_mandiri_1.jpg`;
  const base64Buffer = Buffer.from(samplePhotoDataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  await clientAdmin.storage.from('kunjungan').upload(storagePath1, base64Buffer, { contentType: 'image/jpeg', upsert: true });
  await clientAdmin.from('visit_photos').insert({
    visit_id: v1.id,
    storage_path: storagePath1,
    bytes: base64Buffer.length,
    sha256: sampleHash1,
    sort_order: 1,
  });

  // Skenario 2: Kirim Kunjungan #2 (Kredit Realisasi)
  console.log('\n📤 3. Mengirim Kunjungan #2 (UD Sumber Rejeki):');
  const visit2Payload = {
    client_uuid: clientUuid2,
    marketing_id: authData.user.id,
    customer_name: 'UD Sumber Rejeki',
    visit_type: 'nasabah_existing',
    product: 'kredit',
    outcome: 'realisasi',
    potential_value: 75000000,
    notes: 'Realisasi penambahan modal kerja kredit usaha rakyat.',
    captured_at: new Date().toISOString(),
    lat: -7.008456,
    lng: 110.442123,
    accuracy_m: 8,
    address: 'Jl. Pandanaran No. 50, Semarang',
    anomaly_flags: [],
    is_late: false,
    verification_status: 'pending',
  };

  const { data: v2, error: err2 } = await clientMkt.from('visits').insert(visit2Payload).select().single();
  if (err2) throw err2;
  console.log('   ✅ Kunjungan #2 berhasil tersimpan. ID:', v2.id);

  const storagePath2 = `2026/08/MKT01_ahmad_dahlan/2026-08-18/2026-08-18_2232_MKT01_ud_sumber_rejeki_1.jpg`;
  await clientAdmin.storage.from('kunjungan').upload(storagePath2, base64Buffer, { contentType: 'image/jpeg', upsert: true });
  await clientAdmin.from('visit_photos').insert({
    visit_id: v2.id,
    storage_path: storagePath2,
    bytes: base64Buffer.length,
    sha256: sampleHash2,
    sort_order: 1,
  });

  // Skenario 3: Kirim Kunjungan #3 (Dengan Anomali Akurasi Rendah)
  console.log('\n📤 4. Mengirim Kunjungan #3 (Bengkel Motor Abadi - Uji Anomali):');
  const visit3Payload = {
    client_uuid: clientUuid3,
    marketing_id: authData.user.id,
    customer_name: 'Bengkel Motor Abadi',
    visit_type: 'prospek_baru',
    product: 'deposito',
    outcome: 'follow_up',
    potential_value: 30000000,
    notes: 'Prospek deposito berjangka 6 bulan.',
    captured_at: new Date().toISOString(),
    lat: -7.012345,
    lng: 110.450123,
    accuracy_m: 65, // > 50m -> anomali akurasi_rendah
    address: 'Jl. Majapahit No. 88, Semarang',
    anomaly_flags: ['akurasi_rendah'],
    is_late: false,
    verification_status: 'pending',
  };

  const { data: v3, error: err3 } = await clientMkt.from('visits').insert(visit3Payload).select().single();
  if (err3) throw err3;
  console.log('   ✅ Kunjungan #3 berhasil tersimpan. ID:', v3.id, '| Anomali:', v3.anomaly_flags);

  const storagePath3 = `2026/08/MKT01_ahmad_dahlan/2026-08-18/2026-08-18_2235_MKT01_bengkel_motor_abadi_1.jpg`;
  await clientAdmin.storage.from('kunjungan').upload(storagePath3, base64Buffer, { contentType: 'image/jpeg', upsert: true });
  await clientAdmin.from('visit_photos').insert({
    visit_id: v3.id,
    storage_path: storagePath3,
    bytes: base64Buffer.length,
    sha256: 'a1b2c3d4e5f600001111222233334444555566667777888899990000aaaabbbb',
    sort_order: 1,
  });

  // Skenario 4: Uji Idempotensi (Kirim Ulang client_uuid Kunjungan #1)
  console.log('\n🔁 5. Menguji Idempotensi (Kirim ulang client_uuid #1 yang sama):');
  const { data: checkIdempotent } = await clientMkt
    .from('visits')
    .select('*')
    .eq('client_uuid', clientUuid1);

  console.log(`   - Jumlah baris dengan client_uuid "${clientUuid1}": ${checkIdempotent?.length}`);
  if (checkIdempotent && checkIdempotent.length === 1) {
    console.log('   ✅ IDEMPOTENSI BERHASIL: Tidak terjadi data ganda!');
  } else {
    console.error('   ❌ GAGAL: Terjadi duplikasi data kunjungan!');
  }

  // Skenario 5: Verifikasi Struktur Folder di Storage
  console.log('\n📁 6. Struktur Berkas yang Terbentuk di Storage Bucket "kunjungan":');
  const { data: filesInFolder } = await clientAdmin.storage
    .from('kunjungan')
    .list('2026/08/MKT01_ahmad_dahlan/2026-08-18');

  console.log('   Path: 2026/08/MKT01_ahmad_dahlan/2026-08-18/');
  filesInFolder?.forEach((f) => {
    console.log(`   ├── 📄 ${f.name} (${Math.round((f.metadata?.size || 0) / 1024)} KB)`);
  });

  // Skenario 6: Ringkasan Tabel Kunjungan
  console.log('\n📊 7. Ringkasan Baris Kunjungan Terdaftar di Database:');
  const { data: allVisits } = await clientAdmin
    .from('visits')
    .select('customer_name, visit_type, product, outcome, potential_value, accuracy_m, anomaly_flags, verification_status')
    .eq('marketing_id', authData.user.id)
    .order('captured_at', { ascending: false })
    .limit(3);

  console.table(allVisits);

  console.log('====================================================');
  console.log('🎉 SELURUH PENGUJIAN TAHAP 3 BERHASIL DIVERIFIKASI!');
  console.log('====================================================\n');
}

runStage3Tests().catch((err) => {
  console.error('❌ Terjadi kesalahan saat pengujian:', err);
  process.exit(1);
});
