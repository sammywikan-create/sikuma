import Link from 'next/link';

export default function PanduanMarketingPage() {
  return (
    <main className="flex-1 flex flex-col p-4 bg-slate-50 min-h-screen text-slate-900 pb-12">
      {/* Header */}
      <header className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-bkk-700 bg-bkk-50 px-2 py-0.5 rounded border border-bkk-200">
            SOP Lapangan Resmi
          </span>
          <h1 className="text-lg font-bold text-slate-900 mt-1">
            Panduan Kunjungan Marketing
          </h1>
          <p className="text-xs text-slate-500">PT BPR BKK (Perseroda)</p>
        </div>

        <Link
          href="/kunjungan"
          className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg shadow-sm"
        >
          ← Kembali
        </Link>
      </header>

      <div className="space-y-4 text-xs">
        {/* 1. Kapan Wajib Mengambil Foto */}
        <section className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-bkk-700 font-bold">
            <span className="w-5 h-5 rounded-full bg-bkk-100 flex items-center justify-center text-xs text-bkk-800">
              1
            </span>
            <h2 className="text-sm">Kapan Wajib Mengambil Foto</h2>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Pengambilan foto dokumentasi ber-watermark sistem wajib dilakukan pada setiap aktivitas operasional berikut:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
            <li><strong>Prospek Baru:</strong> Pertemuan pertama dengan calon nasabah tabungan/kredit/deposito.</li>
            <li><strong>Nasabah Existing:</strong> Kunjungan pemeliharaan relasi &amp; *cross-selling* produk.</li>
            <li><strong>Penagihan Angsuran:</strong> Pertemuan penagihan atau restrukturisasi kredit.</li>
            <li><strong>Survei Agunan:</strong> Pemeriksaan fisik jaminan dan tempat usaha.</li>
          </ul>
        </section>

        {/* 2. Komposisi Foto yang Sah */}
        <section className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2.5">
          <div className="flex items-center gap-2 text-bkk-700 font-bold">
            <span className="w-5 h-5 rounded-full bg-bkk-100 flex items-center justify-center text-xs text-bkk-800">
              2
            </span>
            <h2 className="text-sm">Komposisi Foto yang Sah (Diterima)</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-emerald-800 block">
                ✓ SAH / BENAR:
              </span>
              <ul className="text-[11px] text-emerald-900 space-y-1 list-disc list-inside">
                <li>Tampak nasabah / pemilik usaha di lokasi.</li>
                <li>Tampak plang usaha, etalase, atau bangunan fisik.</li>
                <li>Foto diambil di luar ruangan / pencahayaan jelas.</li>
              </ul>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-red-800 block">
                ✕ TIDAK SAH (DITOLAK):
              </span>
              <ul className="text-[11px] text-red-900 space-y-1 list-disc list-inside">
                <li>Foto berkas / kertas formulir saja.</li>
                <li>Foto selfie tanpa latar tempat usaha.</li>
                <li>Foto layar komputer / foto ulang dari galeri.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3. Batas Waktu Pengiriman */}
        <section className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-bkk-700 font-bold">
            <span className="w-5 h-5 rounded-full bg-bkk-100 flex items-center justify-center text-xs text-bkk-800">
              3
            </span>
            <h2 className="text-sm">Batas Jam Pengiriman Data</h2>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Kunjungan wajib disinkronkan ke server paling lambat pukul <strong className="text-slate-900 font-bold">18:00 WIB</strong> pada hari yang sama.
          </p>
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px]">
            ⚠️ Kunjungan yang dikirim setelah jam 18:00 WIB akan otomatis ditandai flag <strong>&quot;Terlambat Kirim&quot;</strong> pada dasbor Kepala Cabang.
          </div>
        </section>

        {/* 4. Kalimat Baku Izin Memotret Nasabah */}
        <section className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2.5">
          <div className="flex items-center gap-2 text-bkk-700 font-bold">
            <span className="w-5 h-5 rounded-full bg-bkk-100 flex items-center justify-center text-xs text-bkk-800">
              4
            </span>
            <h2 className="text-sm">Kalimat Baku Meminta Izin Nasabah</h2>
          </div>
          <p className="text-slate-600 text-[11px]">
            Gunakan kalimat sopan perbankan berikut sebelum mengambil foto dokumentasi:
          </p>
          <blockquote className="p-3.5 bg-slate-100 border-l-4 border-bkk-600 rounded-r-xl italic text-slate-800 text-xs leading-relaxed">
            &ldquo;Mohon izin Bapak/Ibu, sesuai prosedur resmi Bank BKK, saya perlu mengambil 1 foto dokumentasi bersama Bapak/Ibu di lokasi usaha ini sebagai laporan pertanggungjawaban kunjungan. Foto ini hanya tersimpan aman untuk arsip internal bank dan dilindungi kerahasiaannya. Terima kasih banyak atas kerjasamanya.&rdquo;
          </blockquote>
        </section>

        {/* 5. Perlindungan Privasi Nasabah */}
        <section className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-sky-400 font-bold">
            <span>🔒</span>
            <h2 className="text-sm">Kepatuhan Kerahasiaan Perbankan</h2>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            <strong>DILARANG KERAS</strong> mengambil foto dokumen yang memuat nomor rekening, PIN, CVV, saldo tabungan, atau data rahasia pribadi nasabah lainnya.
          </p>
        </section>
      </div>

      <div className="pt-4">
        <Link
          href="/kunjungan/baru"
          className="w-full min-h-[46px] bg-bkk-600 hover:bg-bkk-700 active:bg-bkk-800 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
        >
          <span>📸</span> Mulai Ambil Kunjungan Baru
        </Link>
      </div>
    </main>
  );
}
