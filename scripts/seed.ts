import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diatur di .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface SeedUser {
  email: string;
  password: string;
  fullName: string;
  role: 'kacab' | 'admin' | 'marketing' | 'penagihan';
  marketingCode?: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'kacab@bkk.co.id',
    password: crypto.randomUUID().slice(0, 16) + '!A',
    fullName: 'Budi Santoso, S.E.',
    role: 'kacab',
  },
  {
    email: 'admin@bkk.co.id',
    password: crypto.randomUUID().slice(0, 16) + '!A',
    fullName: 'Administrator Pusat',
    role: 'admin',
  },
];

async function seed() {
  console.log('====================================================');
  console.log('🌱 MEMULAI SEEDING DATA SIKUMA (BANK BKK)...');
  console.log('====================================================\n');

  // 1. Pastikan bucket storage 'kunjungan' ada
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === 'kunjungan');
    if (!bucketExists) {
      const { error: bucketError } = await supabaseAdmin.storage.createBucket('kunjungan', {
        public: false,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/jpg'],
      });
      if (bucketError) {
        console.warn('⚠️ Gagal membuat bucket storage otomatis:', bucketError.message);
      } else {
        console.log('✅ Bucket privat "kunjungan" berhasil dibuat.');
      }
    } else {
      console.log('ℹ️ Bucket privat "kunjungan" sudah ada.');
    }
  } catch (err) {
    console.warn('⚠️ Peringatan saat inisialisasi bucket:', err);
  }

  // 2. Bersihkan seluruh dummy data kunjungan lama
  try {
    console.log('🧹 Membersihkan dummy data kunjungan...');
    await supabaseAdmin.from('visit_photos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('visits').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('audit_log').delete().neq('id', 0);
    console.log('✅ Basis data kunjungan telah bersih.');
  } catch (err) {
    console.warn('ℹ️ Info saat pembersihan:', err);
  }

  // 2. Buat akun pengguna & profil
  const credentialsTable: Array<{
    Peran: string;
    Nama: string;
    Kode: string;
    Email: string;
    'Kata Sandi': string;
  }> = [];

  for (const user of SEED_USERS) {
    // Cek apakah pengguna sudah ada
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = userList?.users.find((u) => u.email?.toLowerCase() === user.email.toLowerCase());

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Perbarui kata sandi pengguna lama agar sesuai seed
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.fullName, role: user.role },
      });
    } else {
      const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.fullName, role: user.role },
      });

      if (createError || !createdUser.user) {
        console.error(`❌ Gagal membuat user ${user.email}:`, createError?.message);
        continue;
      }
      userId = createdUser.user.id;
    }

    // Upsert record ke tabel profiles
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      full_name: user.fullName,
      marketing_code: user.marketingCode ?? null,
      role: user.role,
      is_active: true,
    });

    if (profileError) {
      console.error(`❌ Gagal upsert profil ${user.email}:`, profileError.message);
    } else {
      credentialsTable.push({
        Peran: user.role.toUpperCase(),
        Nama: user.fullName,
        Kode: user.marketingCode ?? '-',
        Email: user.email,
        'Kata Sandi': user.password,
      });
    }
  }

  console.log('\n====================================================');
  console.log('✨ SEEDING BERHASIL! DAFTAR KREDENSIAL PENGGUNA:');
  console.log('====================================================');
  console.table(credentialsTable);
  console.log('====================================================\n');
}

seed().catch((err) => {
  console.error('❌ Terjadi kesalahan fatal saat seed:', err);
  process.exit(1);
});
