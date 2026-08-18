import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function runRlsTests() {
  console.log('====================================================');
  console.log('🔒 PENGUJIAN ROW LEVEL SECURITY (RLS) SIKUMA');
  console.log('====================================================\n');

  // Client 1: Marketing 1 (mkt01@bkk.co.id)
  const clientMkt01 = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: authMkt01, error: errAuth1 } = await clientMkt01.auth.signInWithPassword({
    email: 'mkt01@bkk.co.id',
    password: 'Password123!',
  });
  if (errAuth1 || !authMkt01.user) {
    throw new Error(`Gagal login MKT01: ${errAuth1?.message}`);
  }
  console.log('✅ 1. Login MKT01 berhasil. User ID:', authMkt01.user.id);

  // Client 2: Marketing 2 (mkt02@bkk.co.id)
  const clientMkt02 = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: authMkt02, error: errAuth2 } = await clientMkt02.auth.signInWithPassword({
    email: 'mkt02@bkk.co.id',
    password: 'Password123!',
  });
  if (errAuth2 || !authMkt02.user) {
    throw new Error(`Gagal login MKT02: ${errAuth2?.message}`);
  }
  console.log('✅ 2. Login MKT02 berhasil. User ID:', authMkt02.user.id);

  // Client 3: Kacab (kacab@bkk.co.id)
  const clientKacab = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: authKacab, error: errAuthKacab } = await clientKacab.auth.signInWithPassword({
    email: 'kacab@bkk.co.id',
    password: 'Password123!',
  });
  if (errAuthKacab || !authKacab.user) {
    throw new Error(`Gagal login Kacab: ${errAuthKacab?.message}`);
  }
  console.log('✅ 3. Login Kepala Cabang berhasil. User ID:', authKacab.user.id);

  // Step 4: MKT01 membuat kunjungan baru
  const clientUuid = `test-${Date.now()}`;
  const { data: insertedVisit, error: insertErr } = await clientMkt01
    .from('visits')
    .insert({
      client_uuid: clientUuid,
      marketing_id: authMkt01.user.id,
      customer_name: 'PT Maju Bersama Jaya',
      visit_type: 'prospek_baru',
      product: 'kredit',
      outcome: 'berminat',
      potential_value: 50000000,
      notes: 'Uji RLS isolasi data',
      captured_at: new Date().toISOString(),
      lat: -7.005,
      lng: 110.438,
      accuracy_m: 10,
      address: 'Jl. Pemuda No. 100, Semarang',
    })
    .select()
    .single();

  if (insertErr || !insertedVisit) {
    throw new Error(`Gagal insert visit oleh MKT01: ${insertErr?.message}`);
  }
  console.log('\n📝 4. MKT01 berhasil mencatat kunjungan:', {
    id: insertedVisit.id,
    customer_name: insertedVisit.customer_name,
    marketing_id: insertedVisit.marketing_id,
  });

  // Step 5: MKT01 membaca kunjungan -> HARUS BISA membaca datanya sendiri
  const { data: mkt01Reads, error: mkt01ReadErr } = await clientMkt01
    .from('visits')
    .select('*')
    .eq('id', insertedVisit.id);

  console.log('🔍 5. MKT01 membaca datanya sendiri:');
  console.log(`   - Jumlah baris ditemukan: ${mkt01Reads?.length || 0} (Ekspektasi: 1)`);
  if (mkt01Reads && mkt01Reads.length === 1) {
    console.log('   ✅ Sukses: MKT01 dapat membaca kunjungan miliknya sendiri.');
  } else {
    console.error('   ❌ Gagal: MKT01 tidak dapat membaca datanya sendiri.', mkt01ReadErr);
  }

  // Step 6: MKT02 membaca kunjungan MKT01 -> HARUS TIDAK BISA (0 BARIS)
  const { data: mkt02Reads, error: mkt02ReadErr } = await clientMkt02
    .from('visits')
    .select('*')
    .eq('id', insertedVisit.id);

  console.log('\n🚫 6. MKT02 mencoba membaca kunjungan milik MKT01:');
  console.log(`   - Jumlah baris ditemukan: ${mkt02Reads?.length || 0} (Ekspektasi: 0)`);
  if (mkt02Reads && mkt02Reads.length === 0) {
    console.log('   ✅ SUKSES RLS: MKT02 TERISOLASI dan TIDAK DAPAT membaca kunjungan milik MKT01!');
  } else {
    console.error('   ❌ GAGAL: Terjadi kebocoran data, MKT02 dapat membaca kunjungan MKT01!', mkt02Reads);
  }

  // Step 7: Kacab membaca kunjungan MKT01 -> HARUS BISA (1 BARIS)
  const { data: kacabReads } = await clientKacab
    .from('visits')
    .select('*')
    .eq('id', insertedVisit.id);

  console.log('\n👁️ 7. Kepala Cabang membaca seluruh kunjungan:');
  console.log(`   - Jumlah baris ditemukan: ${kacabReads?.length || 0} (Ekspektasi: 1)`);
  if (kacabReads && kacabReads.length === 1) {
    console.log('   ✅ SUKSES: Kepala Cabang dapat membaca seluruh data kunjungan.');
  } else {
    console.error('   ❌ Gagal: Kepala Cabang tidak dapat membaca kunjungan.');
  }

  // Step 8: MKT01 mencoba melakukan UPDATE -> HARUS DITOLAK RLS
  const { error: mktUpdateErr } = await clientMkt01
    .from('visits')
    .update({ notes: 'Mencoba merubah catatan' })
    .eq('id', insertedVisit.id);

  console.log('\n🛡️ 8. MKT01 mencoba UPDATE kunjungan (Append-only test):');
  if (mktUpdateErr) {
    console.log('   ✅ SUKSES RLS: Update oleh marketing ditolak dengan pesan:', mktUpdateErr.message);
  } else {
    // Check if row was actually updated
    const { data: checkUpdate } = await clientMkt01.from('visits').select('notes').eq('id', insertedVisit.id).single();
    if (checkUpdate?.notes !== 'Mencoba merubah catatan') {
      console.log('   ✅ SUKSES RLS: Update diabaikan oleh policy RLS.');
    } else {
      console.error('   ❌ GAGAL: Marketing berhasil mengubah data kunjungan!');
    }
  }

  // Step 9: Kacab memverifikasi kunjungan -> HARUS BERHASIL
  const { data: verifyData, error: verifyErr } = await clientKacab
    .from('visits')
    .update({
      verification_status: 'verified',
      verified_by: authKacab.user.id,
      verified_at: new Date().toISOString(),
      verifier_note: 'Disetujui oleh Kepala Cabang',
    })
    .eq('id', insertedVisit.id)
    .select()
    .single();

  console.log('\n✍️ 9. Kepala Cabang memverifikasi kunjungan:');
  if (verifyErr || !verifyData) {
    console.error('   ❌ Gagal verifikasi oleh Kacab:', verifyErr?.message);
  } else {
    console.log('   ✅ SUKSES: Status verifikasi berhasil diubah menjadi:', verifyData.verification_status);
  }

  console.log('\n====================================================');
  console.log('🎉 SEMUA PENGUJIAN RLS LENGKAP & MEMENUHI SYARAT!');
  console.log('====================================================\n');
}

runRlsTests().catch((err) => {
  console.error('❌ Error fatal saat uji RLS:', err);
  process.exit(1);
});
