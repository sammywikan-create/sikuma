import { createClient } from '@supabase/supabase-js';
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
  role: 'kacab' | 'admin' | 'marketing';
  marketingCode?: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'kacab@bkk.co.id',
    password: 'Password123!',
    fullName: 'Budi Santoso',
    role: 'kacab',
  },
  {
    email: 'admin@bkk.co.id',
    password: 'Password123!',
    fullName: 'Administrator Pusat',
    role: 'admin',
  },
  {
    email: 'mkt01@bkk.co.id',
    password: 'Password123!',
    fullName: 'Ahmad Dahlan',
    role: 'marketing',
    marketingCode: 'MKT01',
  },
  {
    email: 'mkt02@bkk.co.id',
    password: 'Password123!',
    fullName: 'Siti Rahayu',
    role: 'marketing',
    marketingCode: 'MKT02',
  },
  {
    email: 'mkt03@bkk.co.id',
    password: 'Password123!',
    fullName: 'Eko Prasetyo',
    role: 'marketing',
    marketingCode: 'MKT03',
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
