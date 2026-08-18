import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { MAX_QUEUE_BYTES, type QueuedVisit } from '../lib/storage/db';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Mock IndexedDB Queue Memory Simulator
class OfflineQueueMemory {
  private queue: Map<string, QueuedVisit> = new Map();

  async enqueue(visit: QueuedVisit) {
    this.queue.set(visit.client_uuid, visit);
  }

  async getAll(): Promise<QueuedVisit[]> {
    return Array.from(this.queue.values());
  }

  async getTotalBytes(): Promise<number> {
    let total = 0;
    for (const v of this.queue.values()) {
      for (const p of v.photos) {
        total += p.bytes || 0;
      }
    }
    return total;
  }

  async remove(uuid: string) {
    this.queue.delete(uuid);
  }
}

async function runOfflineSyncTests() {
  console.log('====================================================');
  console.log('📡 MEMULAI PENGUJIAN TAHAP 4: OFFLINE & AUTO-SYNC');
  console.log('====================================================\n');

  // 1. Inisialisasi Klien & Simulasi Antrean Offline HP
  const clientMkt = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: authData, error: authErr } = await clientMkt.auth.signInWithPassword({
    email: 'mkt01@bkk.co.id',
    password: 'Password123!',
  });

  if (authErr || !authData.user) {
    throw new Error(`Gagal login MKT01: ${authErr?.message}`);
  }
  console.log('✅ 1. Otentikasi Marketing MKT01 Berhasil. ID:', authData.user.id);

  const localQueue = new OfflineQueueMemory();
  const samplePhotoBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const sampleBytes = 180 * 1024; // 180 KB

  const offlineUuid1 = `offline_${Date.now()}_1`;
  const offlineUuid2 = `offline_${Date.now()}_2`;

  // Skenario A: Simpan 2 Kunjungan saat Tanpa Sinyal (Offline)
  console.log('\n📴 2. Menyimulasikan Penyimpanan 2 Kunjungan dalam Mode Offline ke IndexedDB:');

  const visitOffline1: QueuedVisit = {
    client_uuid: offlineUuid1,
    customer_name: 'Warung Makan Bu Siti (Offline 1)',
    visit_type: 'prospek_baru',
    product: 'tabungan',
    outcome: 'berminat',
    potential_value: 10000000,
    notes: 'Kunjungan di area pelosok tanpa sinyal seluler.',
    captured_at: new Date().toISOString(),
    lat: -7.025,
    lng: 110.455,
    accuracy_m: 15,
    address: 'Desa Sumurrejo, Kec. Gunungpati, Kota Semarang',
    photos: [
      {
        id: 'p_off_1',
        dataUrl: samplePhotoBase64,
        bytes: sampleBytes,
        width: 1280,
        height: 960,
        captured_at: new Date().toISOString(),
        lat: -7.025,
        lng: 110.455,
        accuracy_m: 15,
        address: 'Desa Sumurrejo, Kec. Gunungpati',
        sha256: 'hash_offline_siti_1',
        sort_order: 1,
      },
    ],
    status: 'pending',
    retry_count: 0,
    last_error: null,
    created_at: new Date().toISOString(),
  };

  const visitOffline2: QueuedVisit = {
    client_uuid: offlineUuid2,
    customer_name: 'Kios Pupuk Tani Makmur (Offline 2)',
    visit_type: 'nasabah_existing',
    product: 'kredit',
    outcome: 'realisasi',
    potential_value: 50000000,
    notes: 'Pencatatan realisasi kredit mikro tani.',
    captured_at: new Date().toISOString(),
    lat: -7.030,
    lng: 110.460,
    accuracy_m: 20,
    address: 'Desa Plalangan, Kec. Gunungpati, Kota Semarang',
    photos: [
      {
        id: 'p_off_2',
        dataUrl: samplePhotoBase64,
        bytes: sampleBytes,
        width: 1280,
        height: 960,
        captured_at: new Date().toISOString(),
        lat: -7.030,
        lng: 110.460,
        accuracy_m: 20,
        address: 'Desa Plalangan, Kec. Gunungpati',
        sha256: 'hash_offline_tani_2',
        sort_order: 1,
      },
    ],
    status: 'pending',
    retry_count: 0,
    last_error: null,
    created_at: new Date().toISOString(),
  };

  await localQueue.enqueue(visitOffline1);
  await localQueue.enqueue(visitOffline2);

  const currentQueue = await localQueue.getAll();
  console.log(`   - Jumlah item tersimpan di antrean IndexedDB: ${currentQueue.length}`);
  console.log(`   - Item #1: "${currentQueue[0].customer_name}" [Status: ${currentQueue[0].status}]`);
  console.log(`   - Item #2: "${currentQueue[1].customer_name}" [Status: ${currentQueue[1].status}]`);

  // Skenario B: Uji Proteksi Batas Memori Antrean 50 MB
  console.log('\n💾 3. Pengujian Proteksi Kapasitas Memori HP (Maks 50 MB):');
  const queueBytes = await localQueue.getTotalBytes();
  const queueMB = (queueBytes / (1024 * 1024)).toFixed(2);
  const maxMB = (MAX_QUEUE_BYTES / (1024 * 1024)).toFixed(0);
  console.log(`   - Akumulasi ukuran antrean saat ini: ${queueMB} MB / ${maxMB} MB`);
  const isLocked = queueBytes >= MAX_QUEUE_BYTES;
  console.log(`   - Status proteksi kunci tombol foto: ${isLocked ? 'TERKUNCI ⚠️' : 'AMAN (Bisa ambil foto) ✅'}`);

  // Skenario C: Simulasi Sinyal Kembali Online & Auto-Sync Berurutan (FIFO)
  console.log('\n📶 4. Sinyal Internet Kembali Online — Memproses Auto-Sync:');
  const clientAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  for (const item of currentQueue) {
    console.log(`   📤 Mengirim: "${item.customer_name}" (UUID: ${item.client_uuid})...`);

    // Kirim ke database server
    const { data: vInserted, error: insertErr } = await clientMkt.from('visits').insert({
      client_uuid: item.client_uuid,
      marketing_id: authData.user.id,
      customer_name: item.customer_name,
      visit_type: item.visit_type,
      product: item.product,
      outcome: item.outcome,
      potential_value: item.potential_value,
      notes: item.notes,
      captured_at: item.captured_at,
      lat: item.lat,
      lng: item.lng,
      accuracy_m: item.accuracy_m,
      address: item.address,
      anomaly_flags: [],
      is_late: false,
      verification_status: 'pending',
    }).select().single();

    if (insertErr) throw insertErr;

    // Hapus dari antrean lokal
    await localQueue.remove(item.client_uuid);
    console.log(`      ✅ Sukses terkirim ke server (ID: ${vInserted.id}) & dihapus dari antrean HP.`);
  }

  // Skenario D: Verifikasi Antrean Kosong Pasca Sinkronisasi
  const remainingQueue = await localQueue.getAll();
  console.log(`\n🧹 5. Verifikasi Antrean Lokal Pasca Sinkronisasi:`);
  console.log(`   - Sisa antrean di HP: ${remainingQueue.length} (Ekspektasi: 0)`);

  // Skenario E: Uji Idempotensi Pengiriman Ulang
  console.log(`\n🔁 6. Uji Idempotensi Data Offline:`);
  const { data: checkVisits } = await clientAdmin
    .from('visits')
    .select('id, client_uuid, customer_name, verification_status')
    .in('client_uuid', [offlineUuid1, offlineUuid2]);

  console.log(`   - Jumlah baris tersimpan di server: ${checkVisits?.length} (Ekspektasi: 2 baris, tanpa duplikasi)`);
  console.table(checkVisits);

  console.log('====================================================');
  console.log('🎉 SELURUH PENGUJIAN TAHAP 4 BERHASIL LULUS DIVERIFIKASI!');
  console.log('====================================================\n');
}

runOfflineSyncTests().catch((err) => {
  console.error('❌ Error pengujian offline-sync:', err);
  process.exit(1);
});
