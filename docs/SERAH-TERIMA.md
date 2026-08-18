# Dokumen Serah Terima Sistem SIKUMA (Bank BKK)

**Sistem Informasi Kunjungan Marketing (SIKUMA)**  
*PT BPR BKK Kabupaten Semarang (Perseroda)*  
Tanggal Serah Terima: 18 Agustus 2026

---

## 1. Rangkuman Modul yang Selesai Dibangun

| Tahap | Modul & Fitur | Status | Deskripsi |
| :---: | :--- | :---: | :--- |
| **1** | **Fondasi & Basis Data** | Selesai | Next.js 15 App Router, TypeScript Strict, Tailwind CSS, Supabase PostgreSQL, Row-Level Security (RLS) 3 peran (`marketing`, `kacab`, `admin`), Route Guard Middleware, dan skrip migrasi SQL [`0001_init.sql`](file:///c:/Project%20BKK/supabase/migrations/0001_init.sql). |
| **2** | **Kamera & Watermark GPS** | Selesai | Pengambilan foto kamera langsung (*direct stream `getUserMedia`*, anti unggah galeri), kunci tombol foto bila akurasi GPS $> 50$ meter, reverse geocoding alamat server-side (OpenStreetMap Nominatim), dan pembakaran watermark 4 baris permanen ke piksel kanvas. |
| **3** | **Formulir & Integritas Data** | Selesai | Formulir data nasabah, endpoint `/api/kunjungan`, idempotensi `client_uuid` (aman dari duplikasi sinkronisasi), deteksi otomatis 5 flag anomali server-side, penyimpanan storage privat, dan pencatatan riwayat marketing dengan progres target harian. |
| **4** | **Bekerja Tanpa Sinyal (Offline-First)** | Selesai | Antrean IndexedDB (`idb`), indikator status jujur (*"Tersimpan di HP: N kunjungan"*), sinkronisasi otomatis sequential FIFO saat jaringan kembali aktif (berjenjang hingga 5 percobaan), Service Worker untuk *app shell*, dan perlindungan batas memori antrean 50 MB. |
| **5** | **Dasbor Kepala Cabang** | Selesai | Halaman `/dasbor` (khusus `kacab` & `admin`), 6 kartu metrik KPI, pintasan penyaring tanggal, tabel rekapitulasi kinerja sortable per kolom, pratinjau thumbnail, modal detail interaktif dengan embed peta OpenStreetMap statis, aksi verifikasi **Terima/Tolak** dengan catatan & `audit_log`, `/dasbor/anomali`, dan `/dasbor/pengguna`. |
| **6** | **Laporan Album PDF A4** | Selesai | Endpoint `/api/laporan/pdf` (@react-pdf/renderer): Sampul resmi Bank BKK, Tabel Rekapitulasi per marketing, Sorotan operasional, Album foto kisi **2x2** dengan keterangan 4 baris lengkap, Lembar Verifikasi pengesahan Kepala Cabang, footer *"INTERNAL - RAHASIA"*, signed URL storage privat, dan kompresi ZIP otomatis bila foto $> 200$. |
| **7** | **Kesiapan Lapangan & Keamanan** | Selesai | PWA manifest & tema gelap (`#092C4C`), panduan pasang di layar utama, security headers (CSP, Permissions-Policy, X-Frame-Options), sliding-window rate limiting API, alat retensi foto kedaluwarsa dengan konfirmasi ganda & audit trail, SOP operasional [`/panduan`](file:///c:/Project%20BKK/app/panduan/page.tsx), dan dokumentasi deployment. |

---

## 2. Batasan Teknis Sistem & Penjelasan Eksplisit Mock Location (Fake GPS)

> [!WARNING]
> ### Batasan Arsitektur Web Application Terhadap Fake GPS:
> Aplikasi berbasis Web (baik dibuka di browser mobile maupun dipasang sebagai PWA/Add to Home Screen) **berjalan di dalam sandbox peramban (browser sandbox)**. 
> Oleh karena itu, antarmuka JavaScript `navigator.geolocation` menerima data koordinat yang diteruskan oleh sistem operasi Android. Web browser **tidak memiliki izin akses level kernel/sistem operasi Android** untuk membaca pengaturan sistem pengembang (*Developer Options*) ataupun mendeteksi apakah aplikasi Fake GPS pihak ketiga sedang aktif.

### 🛡️ Mitigasi Berlapis yang Sudah Terpasang di SIKUMA:
Meskipun aplikasi web tidak dapat membaca status mock location secara langsung, sistem SIKUMA dilengkapi **5 lapisan mitigasi integritas berbasis data**:

1. **Deteksi Kecepatan Tidak Wajar (`kecepatan_tidak_wajar`)**:
   Sistem di server menghitung kecepatan perpindahan antara titik kunjungan saat ini dengan titik kunjungan sebelumnya pada hari yang sama menggunakan formula *Haversine*. Jika kecepatan melebihi $120\text{ km/jam}$, kunjungan otomatis ditandai bendera anomali.
2. **Deteksi Lokasi Kembar (`lokasi_kembar`)**:
   Jika marketing mencatat 2 nasabah yang berbeda pada radius $< 20\text{ meter}$, sistem menandai flag anomali karena mengindikasikan marketing hanya duduk di satu titik (misal: di kantor/warung) saat menginput banyak data.
3. **Deteksi Hash Foto Duplikat (`foto_duplikat`)**:
   Sistem menghitung SHA-256 berkas foto. Jika ada foto yang dipakai ulang untuk nasabah lain, sistem menandai anomali.
4. **Pencegahan Pemilihan Berkas Galeri**:
   Kamera hanya mengambil gambar langsung dari sensor video perangkat (*live viewfinder*), mencegah marketing memilih foto lama dari galeri HP.
5. **Kewajiban Komposisi Foto Bersama Nasabah & Plang Usaha**:
   SOP pada [`/panduan`](file:///c:/Project%20BKK/app/panduan/page.tsx) mewajibkan tampak wajah nasabah dan fisik tempat usaha. Kepala Cabang dapat langsung memeriksa foto ukuran penuh dan peta OpenStreetMap pada modal detail sebelum menekan tombol **Terima** atau **Tolak**.

---

## 3. Hal yang Perlu Diputuskan Manajemen Bank BKK Berikutnya

1. **Penetapan Nilai Retensi Berkas Foto**:
   - Nilai default saat ini adalah `180 hari` (6 bulan) pada tabel `app_settings`.
   - Manajemen dapat mendiskusikan apakah masa simpan berkas foto fisik perlu diubah menjadi 365 hari (1 tahun) sesuai regulasi kepatuhan audit internal.
2. **Penyesuaian Batas Jam Pengiriman Lapangan**:
   - Batas jam pengiriman default adalah pukul `18:00 WIB`.
   - Jika cabang memiliki marketing yang bertugas di daerah pelosok dengan durasi perjalanan malam, batas jam ini dapat disesuaikan pada `app_settings` (`batas_jam_kirim_wib`).
3. **Pemberlakuan SOP Pengambilan Foto**:
   - Mensosialisasikan halaman [`/panduan`](file:///c:/Project%20BKK/app/panduan/page.tsx) kepada seluruh staf marketing baru saat proses induksi kerja.
4. **Penerapan Audit Rutin**:
   - Menjadwalkan Kepala Cabang untuk membuka menu `/dasbor/anomali` secara berkala setiap akhir pekan sebelum mencetak Laporan Album PDF A4 bulanan.
