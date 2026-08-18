# Proyek: SIKUMA — Sistem Kunjungan Marketing (Bank BKK)

## Apa yang dibangun
PWA (Progressive Web App) untuk mencatat kunjungan marketing bank ke nasabah.
Setiap kunjungan wajib disertai foto yang diambil langsung dari kamera aplikasi,
dengan watermark permanen berisi tanggal-jam, koordinat GPS, alamat, dan nama
marketing. Kepala cabang dapat melihat seluruh kunjungan dan mengunduh laporan
harian/mingguan/bulanan berupa album PDF.

BUKAN aplikasi Android native. Tidak ada APK. Wajib berjalan di Chrome Android
dan dapat dipasang lewat "Tambahkan ke layar utama".

## Tumpukan teknologi (jangan diganti tanpa bertanya)
- Next.js 15 (App Router) + TypeScript strict
- Tailwind CSS untuk styling (tanpa library komponen besar)
- Supabase: Auth (email + password), Postgres, Storage
- @supabase/ssr untuk sesi di server dan client
- idb (IndexedDB wrapper) untuk antrean offline
- @react-pdf/renderer untuk membuat album PDF di server
- Tanpa dependensi lain kecuali Anda menjelaskan alasannya dan saya setujui

## Aturan produk yang tidak boleh dilanggar
1. Foto HANYA boleh dari kamera langsung (getUserMedia). Dilarang membuat input
   file/unggah dari galeri di alur kunjungan.
2. Watermark harus dibakar ke dalam piksel gambar lewat canvas sebelum diunggah.
   Metadata EXIF tidak cukup.
3. Tanggal dan jam selalu ditampilkan dalam zona waktu Asia/Jakarta (WIB).
4. Baris kunjungan bersifat append-only. Marketing tidak bisa mengubah atau
   menghapus kunjungan yang sudah terkirim. Hanya kepala cabang/admin yang bisa
   menandai verifikasi, dan setiap perubahan dicatat di audit_log.
5. Marketing hanya boleh melihat datanya sendiri. Ditegakkan lewat Row Level
   Security di Postgres, bukan hanya disembunyikan di UI.
6. DILARANG menyimpan nomor rekening, saldo, atau plafon kredit di mana pun
   (kolom, nama berkas, watermark, caption PDF). Data nasabah cukup nama.
7. Semua teks antarmuka dalam Bahasa Indonesia. Komentar dan nama variabel di
   kode dalam Bahasa Inggris.

## Target perangkat
Mobile-first, diuji pada lebar 360px. Tombol besar (min 44px), teks minimal 16px,
satu kolom. Asumsikan HP kelas menengah-bawah dan jaringan 3G lambat. Jaga
ukuran bundel kecil.

## Cara kerja yang saya harapkan dari kamu
- Sebelum menulis kode, tulis rencana singkat dan tunggu saya setuju.
- Kerjakan satu tahap saja per tugas. Jangan mengerjakan tahap berikutnya.
- Setelah selesai, jalankan: npm run lint, npx tsc --noEmit, dan npm run build.
  Semua harus lolos sebelum kamu menyatakan selesai.
- Verifikasi lewat browser dengan dev server berjalan, lalu tunjukkan bukti
  (tangkapan layar) alur yang kamu klaim berhasil.
- Jangan pernah menulis kunci rahasia ke dalam kode atau ke repositori. Gunakan
  .env.local dan pastikan ada di .gitignore.
- Jika ada instruksi saya yang bertabrakan dengan aturan di berkas ini, berhenti
  dan tanyakan.

## Mode simulasi untuk pengujian
Sediakan variabel NEXT_PUBLIC_DEV_SIMULATE. Bila bernilai "1", aplikasi memakai
gambar uji sebagai pengganti kamera dan koordinat tetap (-7.005, 110.438) sebagai
pengganti GPS, sehingga alur dapat kamu uji sendiri di browser desktop tanpa
perangkat asli. Mode ini wajib mati secara default dan wajib menampilkan pita
peringatan merah "MODE SIMULASI" bila aktif.