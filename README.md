# SIKUMA — Sistem Kunjungan Marketing (Bank BKK)

Aplikasi Progressive Web App (PWA) resmi Bank BKK untuk mencatat dan memverifikasi kunjungan tim marketing secara *real-time* dan *append-only*.

---

## 📋 Fitur Fondasi (Tahap 1)

- **Framework**: Next.js 15 (App Router, TypeScript Strict Mode, Tailwind CSS).
- **Autentikasi & Sesi**: `@supabase/ssr` dengan penanganan cookie aman di middleware, Server Actions, dan Server Components.
- **Proteksi Rute Berbasis Peran**:
  - `marketing` dialihkan otomatis ke `/kunjungan`.
  - `kacab` (Kepala Cabang) dan `admin` dialihkan ke `/dasbor`.
  - Halaman login `/masuk` tanpa pendaftaran mandiri (akun dikelola terpusat).
- **Keamanan Data (Postgres RLS)**:
  - Isolasi baris data kunjungan: Marketing hanya dapat membaca dan menambah data miliknya sendiri.
  - Data bersifat *append-only*: Marketing tidak dapat mengedit atau menghapus riwayat kunjungan.
  - Kepala Cabang dan Administrator dapat melihat seluruh kunjungan dan memverifikasi status.
  - Storage Bucket `kunjungan` bersifat privat dengan kebijakan prefix folder per kode marketing.
- **Mode Simulasi Pengujian**: Dukungan banner peringatan jika `NEXT_PUBLIC_DEV_SIMULATE="1"`.

---

## 🛠️ Prasyarat & Variabel Lingkungan

Salin berkas template lingkungan:
```bash
cp .env.example .env.local
```

Isi konfigurasi pada berkas `.env.local`:

| Variabel | Deskripsi | Contoh |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL Proyek Supabase | `https://xyzcompany.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Anon Key Supabase | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (Khusus Server/Seed) | `eyJhbGciOi...` |
| `NEXT_PUBLIC_DEV_SIMULATE` | Flag Mode Simulasi (`1` = ON, `0` = OFF) | `0` |

---

## 🚀 Panduan Menjalankan Proyek

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Menerapkan Migrasi SQL Database
Terapkan berkas migrasi SQL ke database Supabase Anda:
- Berkas migrasi: [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
- **Cara 1 (Supabase Dashboard)**: Buka menu **SQL Editor** di dashboard Supabase, salin seluruh isi `supabase/migrations/0001_init.sql`, lalu klik **Run**.
- **Cara 2 (Supabase CLI)**:
  ```bash
  npx supabase db push
  # atau
  npx supabase migration up
  ```

### 3. Mengisi Data Awal (Seed Data)
Jalankan skrip seed untuk membuat akun awal dan bucket storage:
```bash
npm run seed
```

Daftar akun yang dibuat oleh skrip seed:

> **Catatan Keamanan:** Kata sandi dibangkitkan secara acak saat menjalankan `npm run seed` dan dicetak ke konsol dalam bentuk tabel. Salin dan simpan kata sandi tersebut dengan aman — **kata sandi tidak akan ditampilkan lagi**. Wajib diganti setelah login pertama.

| Peran | Nama | Email |
| :--- | :--- | :--- |
| **Kepala Cabang** | Budi Santoso | `kacab@bkk.co.id` |
| **Admin** | Administrator Pusat | `admin@bkk.co.id` |


### 4. Menjalankan Server Pengembangan
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser.

### 5. Menguji Isolasi Row Level Security (RLS)
Jalankan pengujian terotomatisasi untuk membuktikan integritas RLS:
```bash
npm run test:rls
```

---

## 🧪 Validasi Kualitas Kode

Sebelum melakukan rilis, pastikan seluruh uji kualitas lolos:
```bash
# 1. Validasi Linter
npm run lint

# 2. Validasi Tipe TypeScript
npx tsc --noEmit

# 3. Validasi Build Production
npm run build
```

---

## 📂 Struktur Direktori Utama

```
.
├── app/
│   ├── auth/keluar/route.ts   # Handler Logout
│   ├── dasbor/page.tsx        # Dasbor Kepala Cabang & Admin
│   ├── kunjungan/page.tsx     # Beranda Marketing
│   ├── masuk/                 # Halaman & Server Action Login
│   ├── globals.css            # Desain Sistem Tailwind
│   └── layout.tsx             # Root Layout & Banner Mode Simulasi
├── lib/
│   ├── supabase/              # Client, Server, & Middleware Supabase
│   └── types/database.ts      # Definisi Tipe Database TypeScript
├── scripts/
│   ├── seed.ts                # Skrip Seed Akun & Storage
│   └── test-rls.ts            # Skrip Pengujian RLS
└── supabase/
    └── migrations/
        └── 0001_init.sql      # Skema DB, RLS, Helper, & Storage Policy
```
