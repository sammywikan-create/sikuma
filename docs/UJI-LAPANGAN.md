# Daftar Periksa Uji Lapangan Mandiri (Android Phone)

Dokumen ini berisi panduan pengujian mandiri aplikasi **SIKUMA Bank BKK** langsung menggunakan ponsel pintar Android untuk memvalidasi fungsi lapangan, offline sync, keamanan RLS, dan cetak PDF.

---

## 📋 Matriks Daftar Periksa Pengujian

| No | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Pasang PWA ke Layar Utama** | 1. Buka Chrome Android dan akses URL aplikasi.<br>2. Ketuk tombol menu titik tiga (⋮) di pojok kanan atas.<br>3. Pilih **"Tambahkan ke Layar Utama"**.<br>4. Buka aplikasi dari ikon layar utama. | Aplikasi terbuka dalam mode layar penuh (*standalone*) tanpa bilah alamat URL peramban, dengan ikon resmi Bank BKK dan status bar berwarna biru tua (`#092C4C`). | [ ] |
| **2** | **Kamera Langsung & Watermark GPS Luar Ruangan** | 1. Buka menu **"Catat Kunjungan Baru"** saat berada di luar ruangan.<br>2. Izinkan akses Kamera dan Lokasi Presisi Tinggi.<br>3. Perhatikan indikator akurasi GPS meter.<br>4. Tekan tombol ambil foto kamera dan formulir data.<br>5. Kirim kunjungan. | • Tombol foto terkunci jika akurasi $> 50$ meter.<br>• Panel watermark gelap tercetak permanen di $\pm 22\%$ bawah foto: Nama nasabah, jenis kunjungan, koordinat 6 desimal, alamat geocoding, tanggal jam WIB, dan nama/kode marketing.<br>• Tidak ada opsi upload dari galeri file. | [ ] |
| **3** | **Uji Ketahanan Offline (Tanpa Sinyal)** | 1. Aktifkan **Mode Pesawat (Airplane Mode)** pada ponsel.<br>2. Buka aplikasi dan ambil foto kunjungan baru.<br>3. Simpan data kunjungan.<br>4. Perhatikan banner status di bagian atas layar.<br>5. Matikan Mode Pesawat (koneksi internet kembali aktif). | • Muncul pesan jujur: *"Tersimpan di HP: 1 kunjungan menunggu terkirim"*.<br>• Tidak muncul pesan sukses palsu.<br>• Begitu internet menyala, antrean IndexedDB otomatis dikirim satu per satu (FIFO) dan indikator kembali normal. | [ ] |
| **4** | **Uji Isolasi Keamanan Data (Row-Level Security)** | 1. Masuk sebagai Marketing 1 (`mkt01@bkk.co.id` / `Password123!`) dan catat 1 kunjungan.<br>2. Keluar akun (*Logout*).<br>3. Masuk sebagai Marketing 2 (`mkt02@bkk.co.id` / `Password123!`).<br>4. Periksa riwayat kunjungan. | Marketing 2 **sama sekali tidak dapat melihat** riwayat kunjungan atau foto milik Marketing 1. Seluruh data terisolasi ketat di level database PostgreSQL (RLS). | [ ] |
| **5** | **Uji Dasbor & Cetak Album PDF A4** | 1. Masuk sebagai Kepala Cabang (`kacab@bkk.co.id` / `Password123!`).<br>2. Buka menu `/dasbor`.<br>3. Lakukan 1 verifikasi **"Terima"** dan 1 **"Tolak"**.<br>4. Tekan tombol **"Unduh PDF A4"**.<br>5. Buka berkas PDF yang terunduh. | • Dasbor menampilkan 6 kartu metrik dan peta OpenStreetMap.<br>• Dokumen PDF berformat A4 portrait resmi: Sampul, Rekapitulasi per marketing, Sorotan anomali, Album foto kisi 2x2 dengan keterangan 4 baris, Lembar tanda tangan, dan footer *"INTERNAL - RAHASIA"*. | [ ] |

---

## 🛠️ Tips Pengujian Lapangan

1. **Akurasi GPS**: Jika indikator GPS berwarna kuning/merah ($>50$ meter), pastikan fitur *Google Location Accuracy* aktif di pengaturan Android dan lakukan pengujian di area terbuka tanpa halangan atap beton tebal.
2. **Kamera**: Browser Chrome Android memerlukan izin *HTTPS* aktif agar API `navigator.mediaDevices.getUserMedia` dapat mengakses sensor kamera langsung.
