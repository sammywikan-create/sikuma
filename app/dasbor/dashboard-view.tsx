'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { formatWIB, getWIBDateString } from '@/lib/utils/time';
import { formatRupiah } from '@/lib/utils/format';
import { verifyVisitAction, getVisitDetailAction } from './actions';
import type { Visit, VisitPhoto, Profile, VerificationStatus } from '@/lib/types/database';

export interface DashboardVisit extends Visit {
  marketing: Pick<Profile, 'full_name' | 'marketing_code'> | null;
  visit_photos: (VisitPhoto & { signedUrl?: string | null })[];
  photoUrls?: string[];
}

interface DashboardViewProps {
  initialVisits: DashboardVisit[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  marketings: Profile[];
  userRole: 'kacab' | 'admin';
  initialFilters: {
    shortcut: string;
    dari: string;
    sampai: string;
    marketing: string;
    status: string;
    visit_type: string;
    product: string;
    anomali: string;
    q: string;
  };
}

type DateShortcut = 'hari_ini' | '7_hari' | '30_hari' | 'bulan_ini' | 'semua' | 'custom';
type SortField =
  | 'marketing_name'
  | 'total_visits'
  | 'prospects'
  | 'existing'
  | 'collection'
  | 'realization'
  | 'potential_value';

export default function DashboardView({
  initialVisits,
  totalCount,
  currentPage,
  pageSize,
  marketings,
  initialFilters,
}: DashboardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // State Filter Sinkron dengan URL searchParams
  const [searchQuery, setSearchQuery] = useState(initialFilters.q);
  const [dateShortcut, setDateShortcut] = useState<DateShortcut>((initialFilters.shortcut as DateShortcut) || 'hari_ini');
  const [customDari, setCustomDari] = useState(initialFilters.dari);
  const [customSampai, setCustomSampai] = useState(initialFilters.sampai);
  const [selectedMarketing, setSelectedMarketing] = useState(initialFilters.marketing);
  const [selectedStatus, setSelectedStatus] = useState(initialFilters.status);
  const [selectedVisitType, setSelectedVisitType] = useState(initialFilters.visit_type);
  const [selectedProduct, setSelectedProduct] = useState(initialFilters.product);
  const [selectedAnomali, setSelectedAnomali] = useState(initialFilters.anomali);

  // Sorting Tabel Rekap Lokal
  const [sortField, setSortField] = useState<SortField>('total_visits');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Modal Detail Kunjungan
  const [activeModalVisit, setActiveModalVisit] = useState<DashboardVisit | null>(null);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState<boolean>(false);
  const [verifierNote, setVerifierNote] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Helper untuk update parameter URL dan trigger server-side query
  const updateUrlFilters = (updates: Record<string, string | number | undefined>) => {
    const current = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === '' || v === 'semua') {
        current.delete(k);
      } else {
        current.set(k, String(v));
      }
    });

    if (!('page' in updates)) {
      current.delete('page');
    }

    startTransition(() => {
      router.push(`${pathname}?${current.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlFilters({ q: searchQuery.trim() });
  };

  // Handler buka modal & muat foto on-demand
  const handleOpenDetailModal = async (visit: DashboardVisit) => {
    setActiveModalVisit(visit);
    setVerifierNote(visit.verifier_note || '');
    setActionFeedback(null);
    setIsLoadingPhotos(true);

    try {
      const res = await getVisitDetailAction(visit.id);
      if (res.data) {
        setActiveModalVisit(res.data as unknown as DashboardVisit);
      }
    } catch (err) {
      console.error('Gagal memuat detail foto:', err);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  // Handler Verifikasi
  const handleVerify = async (status: VerificationStatus) => {
    if (!activeModalVisit) return;
    setIsVerifying(true);
    setActionFeedback(null);

    try {
      const res = await verifyVisitAction(
        activeModalVisit.id,
        status,
        verifierNote
      );

      if (res.error) {
        setActionFeedback(`⚠️ ${res.error}`);
      } else {
        setActiveModalVisit((prev) =>
          prev ? { ...prev, verification_status: status, verifier_note: verifierNote } : null
        );
        setActionFeedback(
          status === 'verified' ? '✓ Kunjungan Berhasil Diterima' : '✕ Kunjungan Ditolak'
        );
        setTimeout(() => {
          setActiveModalVisit(null);
          setActionFeedback(null);
          setVerifierNote('');
          router.refresh();
        }, 1000);
      }
    } catch (err: unknown) {
      setActionFeedback(`⚠️ ${(err as Error).message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // 1. Hitung Metrik Cepat dari data halaman saat ini
  const metrics = useMemo(() => {
    const totalVisits = initialVisits.length;
    const activeMarketings = new Set(initialVisits.map((v) => v.marketing_id)).size;
    const newProspects = initialVisits.filter((v) => v.visit_type === 'prospek_baru').length;
    const realizations = initialVisits.filter((v) => v.outcome === 'realisasi').length;
    const totalPotential = initialVisits.reduce((acc, v) => acc + (v.potential_value || 0), 0);
    const onTimeVisits = initialVisits.filter((v) => !v.is_late).length;
    const onTimePercent = totalVisits > 0 ? Math.round((onTimeVisits / totalVisits) * 100) : 100;

    return {
      totalVisits,
      activeMarketings,
      newProspects,
      realizations,
      totalPotential,
      onTimePercent,
    };
  }, [initialVisits]);

  // 2. Rekap Per Marketing (Agregasi Data Halaman)
  const marketingSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        marketing_id: string;
        marketing_name: string;
        marketing_code: string;
        total_visits: number;
        prospects: number;
        existing: number;
        collection: number;
        realization: number;
        potential_value: number;
      }
    >();

    marketings.forEach((m) => {
      map.set(m.id, {
        marketing_id: m.id,
        marketing_name: m.full_name,
        marketing_code: m.marketing_code || '-',
        total_visits: 0,
        prospects: 0,
        existing: 0,
        collection: 0,
        realization: 0,
        potential_value: 0,
      });
    });

    initialVisits.forEach((v) => {
      let entry = map.get(v.marketing_id);
      if (!entry) {
        entry = {
          marketing_id: v.marketing_id,
          marketing_name: v.marketing?.full_name || 'Petugas',
          marketing_code: v.marketing?.marketing_code || '-',
          total_visits: 0,
          prospects: 0,
          existing: 0,
          collection: 0,
          realization: 0,
          potential_value: 0,
        };
        map.set(v.marketing_id, entry);
      }

      entry.total_visits += 1;
      if (v.visit_type === 'prospek_baru') entry.prospects += 1;
      if (v.visit_type === 'nasabah_existing') entry.existing += 1;
      if (v.visit_type === 'penagihan') entry.collection += 1;
      if (v.outcome === 'realisasi') entry.realization += 1;
      entry.potential_value += v.potential_value || 0;
    });

    const arr = Array.from(map.values()).filter((s) => s.total_visits > 0);

    return arr.sort((a, b) => {
      let valA: string | number = a[sortField];
      let valB: string | number = b[sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [marketings, initialVisits, sortField, sortAsc]);

  // 3. Unduh Laporan PDF
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  const handleDownloadPdf = (kategori: 'semua' | 'pemasaran' | 'penagihan' = 'semua') => {
    setIsDownloadingPdf(true);

    const now = new Date();
    let dari = customDari || getWIBDateString(now);
    let sampai = customSampai || getWIBDateString(now);
    let jenis = 'bulanan';

    if (dateShortcut === 'hari_ini') {
      dari = getWIBDateString(now);
      sampai = getWIBDateString(now);
      jenis = 'harian';
    } else if (dateShortcut === '7_hari') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dari = getWIBDateString(past7);
      sampai = getWIBDateString(now);
      jenis = 'mingguan';
    }

    const params = new URLSearchParams({
      dari,
      sampai,
      jenis,
      kategori,
      marketing: selectedMarketing,
    });

    window.open(`/api/laporan/pdf?${params.toString()}`, '_blank');
    setTimeout(() => setIsDownloadingPdf(false), 2000);
  };

  const handleExportCsv = () => {
    const now = new Date();
    let dari = customDari || getWIBDateString(now);
    let sampai = customSampai || getWIBDateString(now);

    if (dateShortcut === 'hari_ini') {
      dari = getWIBDateString(now);
      sampai = getWIBDateString(now);
    } else if (dateShortcut === '7_hari') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dari = getWIBDateString(past7);
      sampai = getWIBDateString(now);
    } else if (dateShortcut === '30_hari') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dari = getWIBDateString(past30);
      sampai = getWIBDateString(now);
    }

    const params = new URLSearchParams({
      source: 'dasbor',
      shortcut: dateShortcut,
      dari,
      sampai,
      marketing: selectedMarketing,
      status: selectedStatus,
      visit_type: selectedVisitType,
      product: selectedProduct,
      anomali: selectedAnomali,
      q: searchQuery,
    });

    window.open(`/api/laporan/csv?${params.toString()}`, '_blank');
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-5 pb-12">
      {/* Bar Unduh Laporan PDF Resmi & Ekspor CSV */}
      <div className="p-4 bg-gradient-to-r from-bkk-900 to-bkk-800 text-white rounded-2xl shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <span>📄</span> Cetak Laporan Resmi &amp; Ekspor Data Bank BKK
            </h2>
            <p className="text-xs text-slate-300">
              Dokumen PDF rekapitulasi audit dan berkas spreadsheet CSV (Excel UTF-8 BOM) sesuai filter aktif.
            </p>
          </div>
          {isDownloadingPdf && (
            <span className="text-xs bg-bkk-700 px-3 py-1 rounded-full font-semibold animate-pulse">
              Membuat PDF...
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={isDownloadingPdf}
            onClick={() => handleDownloadPdf('semua')}
            className="px-3 py-1.5 bg-bkk-600 hover:bg-bkk-500 active:bg-bkk-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            📥 Unduh PDF Gabungan
          </button>
          <button
            type="button"
            disabled={isDownloadingPdf}
            onClick={() => handleDownloadPdf('pemasaran')}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            📈 Unduh PDF Pemasaran
          </button>
          <button
            type="button"
            disabled={isDownloadingPdf}
            onClick={() => handleDownloadPdf('penagihan')}
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 active:bg-amber-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            📋 Unduh PDF Penagihan
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-emerald-300 rounded-xl text-xs font-bold transition shadow-sm border border-slate-600 cursor-pointer flex items-center gap-1.5 ml-auto"
          >
            <span>📊</span> Ekspor CSV (Excel)
          </button>
        </div>
      </div>

      {/* Panel Pencarian & Filter Server-Side */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        {/* Form Pencarian Nama Nasabah */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="🔍 Cari nama nasabah / calon nasabah..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bkk-500"
            />
            <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-bkk-600 hover:bg-bkk-700 text-white font-bold rounded-xl text-xs shadow-sm transition cursor-pointer"
          >
            Cari
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                updateUrlFilters({ q: undefined });
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </form>

        {/* Pilihan Cepat Rentang Tanggal */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'hari_ini', label: 'Hari Ini' },
            { id: '7_hari', label: '7 Hari' },
            { id: '30_hari', label: '30 Hari' },
            { id: 'bulan_ini', label: 'Bulan Ini' },
            { id: 'custom', label: 'Kustom Tanggal' },
            { id: 'semua', label: 'Semua Waktu' },
          ].map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => {
                setDateShortcut(sc.id as DateShortcut);
                updateUrlFilters({ shortcut: sc.id });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                dateShortcut === sc.id
                  ? 'bg-bkk-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>

        {/* Form Rentang Tanggal Kustom */}
        {dateShortcut === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Dari:</span>
              <input
                type="date"
                value={customDari}
                onChange={(e) => setCustomDari(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Sampai:</span>
              <input
                type="date"
                value={customSampai}
                onChange={(e) => setCustomSampai(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => updateUrlFilters({ shortcut: 'custom', dari: customDari, sampai: customSampai })}
              className="px-3 py-1.5 bg-bkk-600 hover:bg-bkk-700 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              Terapkan Tanggal
            </button>
          </div>
        )}

        {/* Dropdown Filter Lanjutan */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Petugas</label>
            <select
              value={selectedMarketing}
              onChange={(e) => {
                setSelectedMarketing(e.target.value);
                updateUrlFilters({ marketing: e.target.value });
              }}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              <option value="semua">Semua Petugas</option>
              {marketings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.marketing_code ? `[${m.marketing_code}] ` : ''}{m.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Status Verifikasi</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                updateUrlFilters({ status: e.target.value });
              }}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              <option value="semua">Semua Status</option>
              <option value="pending">⏳ Menunggu (Pending)</option>
              <option value="verified">✓ Terverifikasi</option>
              <option value="rejected">✕ Ditolak</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Jenis Kunjungan</label>
            <select
              value={selectedVisitType}
              onChange={(e) => {
                setSelectedVisitType(e.target.value);
                updateUrlFilters({ visit_type: e.target.value });
              }}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              <option value="semua">Semua Jenis</option>
              <option value="prospek_baru">Prospek Baru</option>
              <option value="nasabah_existing">Nasabah Existing</option>
              <option value="penagihan">Penagihan</option>
              <option value="survei_jaminan">Survei Jaminan</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Produk</label>
            <select
              value={selectedProduct}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                updateUrlFilters({ product: e.target.value });
              }}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              <option value="semua">Semua Produk</option>
              <option value="tabungan">Tabungan</option>
              <option value="deposito">Deposito</option>
              <option value="kredit">Kredit</option>
              <option value="lainnya">Lainnya</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Anomali</label>
            <select
              value={selectedAnomali}
              onChange={(e) => {
                setSelectedAnomali(e.target.value);
                updateUrlFilters({ anomali: e.target.value });
              }}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              <option value="semua">Semua Kunjungan</option>
              <option value="true">⚠️ Hanya Anomali</option>
            </select>
          </div>
        </div>

        {isPending && (
          <div className="flex items-center gap-2 text-xs text-bkk-600 font-semibold pt-1">
            <span className="w-3.5 h-3.5 border-2 border-bkk-600 border-t-transparent rounded-full animate-spin"></span>
            Memuat data...
          </div>
        )}
      </div>

      {/* Grid Kartu Metrik KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Data Filtered
          </span>
          <span className="text-xl font-extrabold text-slate-900 mt-1 block">
            {totalCount}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Petugas Aktif
          </span>
          <span className="text-xl font-extrabold text-bkk-700 mt-1 block">
            {metrics.activeMarketings}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Prospek Baru
          </span>
          <span className="text-xl font-extrabold text-indigo-700 mt-1 block">
            {metrics.newProspects}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Realisasi Closing
          </span>
          <span className="text-xl font-extrabold text-emerald-700 mt-1 block">
            {metrics.realizations}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Potensi Nilai
          </span>
          <span className="text-sm font-extrabold text-slate-900 mt-1 block truncate">
            {formatRupiah(metrics.totalPotential)}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Disiplin Jam
          </span>
          <span className="text-xl font-extrabold text-emerald-600 mt-1 block">
            {metrics.onTimePercent}%
          </span>
        </div>
      </div>

      {/* Tabel Rekap Kinerja Petugas */}
      {marketingSummaries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            📊 Rekap Kinerja Petugas Lapangan
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-500 font-bold">
                  <th className="pb-2 cursor-pointer" onClick={() => { setSortField('marketing_name'); setSortAsc(!sortAsc); }}>
                    Nama Petugas {sortField === 'marketing_name' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th className="pb-2 text-center cursor-pointer" onClick={() => { setSortField('total_visits'); setSortAsc(!sortAsc); }}>
                    Total {sortField === 'total_visits' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th className="pb-2 text-center">Prospek</th>
                  <th className="pb-2 text-center">Existing</th>
                  <th className="pb-2 text-center">Penagihan</th>
                  <th className="pb-2 text-center">Realisasi</th>
                  <th className="pb-2 text-right">Potensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marketingSummaries.map((m) => (
                  <tr key={m.marketing_id} className="hover:bg-slate-50">
                    <td className="py-2.5 font-medium text-slate-900">
                      <span className="font-mono text-slate-500 mr-1">[{m.marketing_code}]</span>
                      {m.marketing_name}
                    </td>
                    <td className="py-2.5 text-center font-bold text-bkk-700">{m.total_visits}</td>
                    <td className="py-2.5 text-center text-slate-600">{m.prospects}</td>
                    <td className="py-2.5 text-center text-slate-600">{m.existing}</td>
                    <td className="py-2.5 text-center text-slate-600">{m.collection}</td>
                    <td className="py-2.5 text-center font-bold text-emerald-600">{m.realization}</td>
                    <td className="py-2.5 text-right font-semibold text-slate-800">{formatRupiah(m.potential_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daftar Kunjungan Lapangan Real-time */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            📋 Riwayat Kunjungan Lapangan ({totalCount} Data)
          </h3>
        </div>

        {initialVisits.length === 0 ? (
          <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center">
            <div className="text-3xl mb-2">📭</div>
            <h4 className="text-sm font-bold text-slate-700">Tidak Ada Data Kunjungan</h4>
            <p className="text-xs text-slate-400 mt-1">
              Tidak ditemukan data kunjungan yang cocok dengan filter atau pencarian Anda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {initialVisits.map((v) => {
              const statusColor =
                v.verification_status === 'verified'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : v.verification_status === 'rejected'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200';

              const statusLabel =
                v.verification_status === 'verified'
                  ? 'Terverifikasi'
                  : v.verification_status === 'rejected'
                  ? 'Ditolak'
                  : 'Menunggu';

              const hasAnomaly = v.anomaly_flags && v.anomaly_flags.length > 0;
              const photoCount = Array.isArray(v.visit_photos) ? v.visit_photos.length : Number((v as unknown as { visit_photos: { count: number }[] }).visit_photos?.[0]?.count || 0);

              return (
                <div
                  key={v.id}
                  onClick={() => handleOpenDetailModal(v)}
                  className={`p-4 bg-white border rounded-2xl shadow-sm space-y-2.5 cursor-pointer hover:shadow-md transition ${
                    hasAnomaly ? 'border-amber-300' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-bkk-700 bg-bkk-50 px-2 py-0.5 rounded border border-bkk-200">
                        {v.marketing?.marketing_code || 'MKT'} • {v.marketing?.full_name}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">{v.customer_name}</h4>
                      <p className="text-[11px] text-slate-400">{formatWIB(v.captured_at)}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                        {statusLabel}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        📷 {photoCount} Foto
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded capitalize">
                      {v.visit_type.replace(/_/g, ' ')}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded capitalize">
                      {v.product} ({v.outcome.replace(/_/g, ' ')})
                    </span>
                    {v.potential_value && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold">
                        {formatRupiah(v.potential_value)}
                      </span>
                    )}
                  </div>

                  {v.address && <p className="text-[11px] text-slate-500 truncate">📍 {v.address}</p>}

                  {hasAnomaly && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                      {v.anomaly_flags.map((flag) => (
                        <span
                          key={flag}
                          className="px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[9px] font-bold"
                        >
                          ⚠️ {flag.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Paginasi Bar Server-Side */}
        {totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 text-xs text-slate-600">
            <div>
              Menampilkan <strong className="text-slate-900">{(currentPage - 1) * pageSize + 1}</strong> –{' '}
              <strong className="text-slate-900">{Math.min(currentPage * pageSize, totalCount)}</strong> dari{' '}
              <strong className="text-slate-900">{totalCount}</strong> kunjungan
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => updateUrlFilters({ page: currentPage - 1 })}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              >
                ← Sebelumnya
              </button>
              <span className="px-3 py-1.5 font-bold text-slate-800">
                Halaman {currentPage} / {totalPages || 1}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => updateUrlFilters({ page: currentPage + 1 })}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              >
                Berikutnya →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Detail Kunjungan & Foto On-Demand */}
      {activeModalVisit && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl p-5 shadow-2xl my-auto space-y-4 max-h-[92vh] overflow-y-auto text-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-bkk-600 bg-bkk-50 px-2 py-0.5 rounded">
                  {activeModalVisit.marketing?.marketing_code || 'MKT'} • {activeModalVisit.marketing?.full_name}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{activeModalVisit.customer_name}</h3>
                <p className="text-xs text-slate-400">{formatWIB(activeModalVisit.captured_at)}</p>
              </div>

              <button
                onClick={() => {
                  setActiveModalVisit(null);
                  setActionFeedback(null);
                }}
                className="text-xs font-semibold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
              >
                ✕ Tutup
              </button>
            </div>

            {/* Foto Dokumentasi On-Demand */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                Foto Dokumentasi Lapangan ({activeModalVisit.visit_photos?.length || 0})
              </span>

              {isLoadingPhotos ? (
                <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                  <span className="w-5 h-5 border-2 border-bkk-600 border-t-transparent rounded-full animate-spin"></span>
                  Memuat foto resolusi tinggi dari penyimpanan aman...
                </div>
              ) : activeModalVisit.visit_photos && activeModalVisit.visit_photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {activeModalVisit.visit_photos.map((photo, idx) => (
                    <div
                      key={photo.id || idx}
                      className="border border-slate-200 rounded-2xl overflow-hidden bg-black aspect-[4/3] relative group shadow-sm"
                    >
                      {photo.signedUrl ? (
                        <img
                          src={photo.signedUrl}
                          alt={`Foto Dokumentasi ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                          Foto tidak tersedia
                        </div>
                      )}
                      <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-black/70 backdrop-blur-sm text-white rounded text-[10px] font-bold">
                        Foto #{photo.sort_order || idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl">
                  Tidak ada foto terlampir.
                </p>
              )}
            </div>

            {/* Rincian Kunjungan */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">Jenis Kunjungan</span>
                  <span className="font-semibold capitalize text-slate-800">
                    {activeModalVisit.visit_type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Produk &amp; Hasil</span>
                  <span className="font-semibold capitalize text-slate-800">
                    {activeModalVisit.product} ({activeModalVisit.outcome.replace(/_/g, ' ')})
                  </span>
                </div>
              </div>

              {activeModalVisit.visit_type === 'penagihan' ? (
                <div className="grid grid-cols-2 gap-2 p-2 bg-amber-50/70 border border-amber-200/60 rounded-xl">
                  <div>
                    <span className="text-amber-800/70 block text-[10px]">Baki Debet</span>
                    <span className="font-bold text-amber-900">
                      {formatRupiah(activeModalVisit.baki_debet || activeModalVisit.potential_value || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-amber-800/70 block text-[10px]">Kolektibilitas</span>
                    <span className="font-bold text-amber-900 uppercase">
                      {activeModalVisit.kolektibilitas ? activeModalVisit.kolektibilitas.replace(/_/g, ' ') : 'Kol 1'}
                    </span>
                  </div>
                </div>
              ) : activeModalVisit.potential_value ? (
                <div>
                  <span className="text-slate-400 block text-[10px]">Nilai Potensi</span>
                  <span className="font-bold text-emerald-700">
                    {formatRupiah(activeModalVisit.potential_value)}
                  </span>
                </div>
              ) : null}

              {activeModalVisit.notes && (
                <div>
                  <span className="text-slate-400 block text-[10px]">Catatan Petugas</span>
                  <p className="text-slate-700 italic mt-0.5">{activeModalVisit.notes}</p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-400 block text-[10px]">Koordinat GPS &amp; Alamat</span>
                <p className="font-mono text-[11px] text-slate-700">
                  {activeModalVisit.lat?.toFixed(6)}, {activeModalVisit.lng?.toFixed(6)} (Akurasi: {Math.round(activeModalVisit.accuracy_m || 0)}m)
                </p>
                {activeModalVisit.address && (
                  <p className="text-slate-600 text-[11px] mt-0.5">📍 {activeModalVisit.address}</p>
                )}
              </div>
            </div>

            {/* Peta Lokasi Statis */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden aspect-[16/9] relative bg-slate-100">
              <iframe
                title="Peta Lokasi Kunjungan"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${activeModalVisit.lng - 0.005}%2C${activeModalVisit.lat - 0.005}%2C${activeModalVisit.lng + 0.005}%2C${activeModalVisit.lat + 0.005}&layer=mapnik&marker=${activeModalVisit.lat}%2C${activeModalVisit.lng}`}
              ></iframe>
            </div>

            {/* Anomali Badges */}
            {activeModalVisit.anomaly_flags && activeModalVisit.anomaly_flags.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-amber-900 block">⚠️ Indikasi Anomali Sistem:</span>
                <div className="flex flex-wrap gap-1.5">
                  {activeModalVisit.anomaly_flags.map((flag) => (
                    <span
                      key={flag}
                      className="px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-800 rounded font-medium text-[11px]"
                    >
                      {flag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Kolom Catatan Verifikator & Tombol Terima/Tolak */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-800">
                Catatan Verifikasi Kepala Cabang
              </label>
              <textarea
                rows={2}
                value={verifierNote}
                onChange={(e) => setVerifierNote(e.target.value)}
                placeholder="Tambahkan catatan penerimaan atau alasan penolakan..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-bkk-500"
              />

              {actionFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-bold text-center ${
                    actionFeedback.startsWith('✓')
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {actionFeedback}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => handleVerify('verified')}
                  className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  ✓ Terima Kunjungan
                </button>
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => handleVerify('rejected')}
                  className="w-full min-h-[44px] bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  ✕ Tolak Kunjungan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
