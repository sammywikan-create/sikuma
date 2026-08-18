# Panduan Deployment Produksi SIKUMA (Bank BKK)

Panduan langkah demi langkah untuk melakukan deployment aplikasi **SIKUMA** ke **Vercel** dan **Supabase** untuk lingkungan produksi.

---

## 1. Persiapan Basis Data (Supabase)

### A. Buat Proyek Baru di Supabase
1. Masuk ke [Supabase Dashboard](https://supabase.com/dashboard) dan klik **"New Project"**.
2. Masukkan nama proyek (contoh: `SIKUMA-BKK`) dan simpan kata sandi basis data.
3. Pilih wilayah server terdekat (contoh: `Singapore - ap-southeast-1`) untuk latensi terendah dari Indonesia.

### B. Terapkan Skrip Migrasi SQL
1. Buka menu **SQL Editor** pada navigasi kiri Supabase.
2. Buka berkas [`supabase/migrations/0001_init.sql`](file:///c:/Project%20BKK/supabase/migrations/0001_init.sql) dari proyek ini.
3. Salin seluruh isi SQL dan tempelkan ke SQL Editor Supabase, lalu klik **Run**.
4. Skrip ini akan membuat:
   - Tabel `profiles`, `visits`, `visit_photos`, `app_settings`, dan `audit_log`.
   - Kebijakan keamanan **Row-Level Security (RLS)** untuk marketing, kepala cabang, dan admin.
   - Storage bucket privat `kunjungan` dengan batasan ukuran 10 MB per berkas.

### C. Ambil Kunci Kredensial API
Buka menu **Project Settings** > **API**:
- **Project URL** (salin untuk `NEXT_PUBLIC_SUPABASE_URL`)
- **Project API Keys - `anon` `public`** (salin untuk `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- **Project API Keys - `service_role` `secret`** (salin untuk `SUPABASE_SERVICE_ROLE_KEY`)

---

## 2. Inisialisasi Akun Pengguna Pertama

Jalankan skrip seeding dari komputer lokal untuk membuat akun default Kepala Cabang, Admin, dan Marketing:

```bash
# 1. Atur berkas .env.local dengan kredensial Supabase baru
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
NEXT_PUBLIC_DEV_SIMULATE=0

# 2. Jalankan skrip seed
npx tsx scripts/seed.ts
```

Akun default yang terbentuk:
- **Kepala Cabang**: `kacab@bkk.co.id` | Sandi: `Password123!`
- **Administrator**: `admin@bkk.co.id` | Sandi: `Password123!`
- **Marketing 01**: `mkt01@bkk.co.id` | Sandi: `Password123!`
- **Marketing 02**: `mkt02@bkk.co.id` | Sandi: `Password123!`
- **Marketing 03**: `mkt03@bkk.co.id` | Sandi: `Password123!`

*(Catatan: Segera minta pengguna mengganti kata sandi setelah login pertama kali).*

---

## 3. Deployment ke Vercel

### A. Impor Repositori Git ke Vercel
1. Masuk ke [Vercel Dashboard](https://vercel.com/dashboard).
2. Klik **"Add New..."** > **"Project"**.
3. Hubungkan akun GitHub/GitLab Anda dan pilih repositori `Project BKK`.
4. Framework Preset akan otomatis terdeteksi sebagai **Next.js**.

### B. Atur Environment Variables di Vercel
Pada bagian **Environment Variables**, tambahkan variabel berikut:

| Nama Variabel | Nilai | Lingkungan |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` (kunci anon) | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` (kunci service_role) | Production, Preview, Development |
| `NEXT_PUBLIC_DEV_SIMULATE` | `0` | Production |

> [!CAUTION]
> Jangan pernah menyertakan `SUPABASE_SERVICE_ROLE_KEY` dengan awalan `NEXT_PUBLIC_` karena kunci ini memiliki hak administratif penuh (*bypass RLS*).

### C. Klik Deploy
1. Klik tombol **"Deploy"**.
2. Vercel akan mengompilasi rute Next.js 15, mengoptimasi service worker PWA, dan menyediakan domain HTTPS gratis (contoh: `sikuma-bkk.vercel.app`).
3. Domain HTTPS ini siap dipasang sebagai PWA di ponsel Android marketing.
