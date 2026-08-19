import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runStage5Tests() {
  console.log('====================================================');
  console.log('🏛️ MEMULAI PENGUJIAN TAHAP 5: DASBOR KEPALA CABANG');
  console.log('====================================================\n');

  // 1. Login Sebagai Kepala Cabang
  const clientKacab = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: authData, error: authErr } = await clientKacab.auth.signInWithPassword({
    email: 'kacab@bkk.co.id',
    password: process.env.TEST_PASSWORD || 'ChangeMe_RunSeedFirst!',
  });

  if (authErr || !authData.user) {
    throw new Error(`Gagal login Kacab: ${authErr?.message}`);
  }
  console.log('✅ 1. Login Kepala Cabang Berhasil. User ID:', authData.user.id);

  // 2. Ambil 2 Kunjungan Pending untuk Diverifikasi
  const clientAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const { data: pendingVisits } = await clientAdmin
    .from('visits')
    .select('id, customer_name, verification_status, marketing_id')
    .eq('verification_status', 'pending')
    .limit(2);

  if (!pendingVisits || pendingVisits.length < 2) {
    throw new Error('Diperlukan minimal 2 kunjungan berstatus pending untuk pengujian.');
  }

  const visitToVerify = pendingVisits[0];
  const visitToReject = pendingVisits[1];

  console.log(`\n📋 2. Kunjungan yang Akan Diuji:`);
  console.log(`   - Kunjungan 1 (Akan DITERIMA): "${visitToVerify.customer_name}" [ID: ${visitToVerify.id}]`);
  console.log(`   - Kunjungan 2 (Akan DITOLAK):  "${visitToReject.customer_name}" [ID: ${visitToReject.id}]`);

  const now = new Date().toISOString();

  // 3. Aksi 1: Terima Kunjungan
  console.log('\n🟢 3. Melakukan Aksi: TERIMA KUNJUNGAN #1...');
  const { error: vErr1 } = await clientKacab
    .from('visits')
    .update({
      verification_status: 'verified',
      verified_by: authData.user.id,
      verified_at: now,
      verifier_note: 'Dokumentasi lengkap, lokasi dan omzet usaha valid terkonfirmasi.',
    })
    .eq('id', visitToVerify.id);

  if (vErr1) throw vErr1;

  await clientAdmin.from('audit_log').insert({
    actor_id: authData.user.id,
    action: 'visit_verified',
    entity: 'visits',
    entity_id: visitToVerify.id,
    payload: {
      status: 'verified',
      verifier_name: 'Budi Santoso (Kacab)',
      verifier_note: 'Dokumentasi lengkap, lokasi dan omzet usaha valid terkonfirmasi.',
      timestamp: now,
    },
  });
  console.log('   ✅ Kunjungan #1 berhasil diterima & dicatat di audit log.');

  // 4. Aksi 2: Tolak Kunjungan
  console.log('\n🔴 4. Melakukan Aksi: TOLAK KUNJUNGAN #2...');
  const { error: vErr2 } = await clientKacab
    .from('visits')
    .update({
      verification_status: 'rejected',
      verified_by: authData.user.id,
      verified_at: now,
      verifier_note: 'Foto tidak menampilkan plang usaha nasabah dengan jelas.',
    })
    .eq('id', visitToReject.id);

  if (vErr2) throw vErr2;

  await clientAdmin.from('audit_log').insert({
    actor_id: authData.user.id,
    action: 'visit_rejected',
    entity: 'visits',
    entity_id: visitToReject.id,
    payload: {
      status: 'rejected',
      verifier_name: 'Budi Santoso (Kacab)',
      verifier_note: 'Foto tidak menampilkan plang usaha nasabah dengan jelas.',
      timestamp: now,
    },
  });
  console.log('   ✅ Kunjungan #2 berhasil ditolak & dicatat di audit log.');

  // 5. Verifikasi Baris di Tabel Visits
  console.log('\n📊 5. Status Terbaru di Tabel "visits":');
  const { data: updatedVisits } = await clientAdmin
    .from('visits')
    .select('id, customer_name, verification_status, verified_by, verified_at, verifier_note')
    .in('id', [visitToVerify.id, visitToReject.id]);

  console.table(updatedVisits);

  // 6. Verifikasi Baris di Tabel Audit Log
  console.log('\n📜 6. Entri Terbaru di Tabel "audit_log":');
  const { data: auditEntries } = await clientAdmin
    .from('audit_log')
    .select('id, actor_id, action, entity, entity_id, payload, created_at')
    .in('action', ['visit_verified', 'visit_rejected'])
    .order('created_at', { ascending: false })
    .limit(2);

  console.table(
    auditEntries?.map((a) => ({
      id: a.id,
      action: a.action,
      entity: a.entity,
      entity_id: a.entity_id?.substring(0, 8) + '...',
      note: (a.payload as any)?.verifier_note,
      status: (a.payload as any)?.status,
    }))
  );

  console.log('\n====================================================');
  console.log('🎉 PENGUJIAN VERIFIKASI TAHAP 5 BERHASIL!');
  console.log('====================================================\n');
}

runStage5Tests().catch((err) => {
  console.error('❌ Error pengujian tahap 5:', err);
  process.exit(1);
});
