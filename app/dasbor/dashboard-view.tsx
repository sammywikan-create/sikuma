import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatWIB } from '@/lib/utils/time';
import { formatRupiah } from '@/lib/utils/format';
import { verifyVisitAction } from './actions';
import type { Visit, VisitPhoto, Profile, VerificationStatus } from '@/lib/types/database';

export interface DashboardVisit extends Visit {
  marketing: Pick<Profile, 'full_name' | 'marketing_code'> | null;
  visit_photos: VisitPhoto[];
  photoUrls?: string[];
}

interface DashboardViewProps {
  initialVisits: DashboardVisit[];
  marketings: Profile[];
  userRole: 'kacab' | 'admin';
}

type DateShortcut = 'hari_ini' | '7_hari' | 'bulan_ini' | 'semua';
type SortField =
  | 'marketing_name'
  | 'total_visits'
  | 'prospects'
  | 'existing'
  | 'collection'
  | 'realization'
  | 'potential_value'
  | 'active_days'
  | 'late_count'
  | 'anomaly_count';

export default function DashboardView({
  initialVisits,
  marketings,
}: DashboardViewProps) {
  // Realtime Live Visits State
  const [visitsList, setVisitsList] = useState<DashboardVisit[]>(initialVisits);

  useEffect(() => {
    setVisitsList(initialVisits);
  }, [initialVisits]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('dasbor_realtime_visits')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: newV } = await supabase
              .from('visits')
              .select('*, marketing:profiles(full_name, marketing_code), visit_photos(*)')
              .eq('id', (payload.new as Visit).id)
              .maybeSingle();

            if (newV) {
              setVisitsList((prev) => [
                newV as unknown as DashboardVisit,
                ...prev.filter((v) => v.id !== (newV as Visit).id),
              ]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Visit;
            setVisitsList((prev) =>
              prev.map((v) => (v.id === updated.id ? { ...v, ...updated } : v))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setVisitsList((prev) => prev.filter((v) => v.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  // State Filter
  const [dateShortcut, setDateShortcut] = useState<DateShortcut>('bulan_ini');
  const [selectedMarketing, setSelectedMarketing] = useState<string>('semua');
  const [selectedVisitType, setSelectedVisitType] = useState<string>('semua');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('semua');
  const [selectedStatus, setSelectedStatus] = useState<string>('semua');

  // State Sorting Tabel Rekap
  const [sortField, setSortField] = useState<SortField>('total_visits');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // State Modal Detail Kunjungan
  const [activeModalVisit, setActiveModalVisit] = useState<DashboardVisit | null>(null);
  const [verifierNote, setVerifierNote] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // 1. Logika Filter Berdasarkan Rentang Tanggal & Kriteria
  const filteredVisits = useMemo(() => {
    const now = new Date();
    let startFilter: Date | null = null;
    let endFilter: Date | null = null;

    if (dateShortcut === 'hari_ini') {
      startFilter = new Date(now);
      startFilter.setHours(0, 0, 0, 0);
      endFilter = new Date(now);
      endFilter.setHours(23, 59, 59, 999);
    } else if (dateShortcut === '7_hari') {
      startFilter = new Date(now);
      startFilter.setDate(now.getDate() - 7);
      startFilter.setHours(0, 0, 0, 0);
      endFilter = new Date(now);
    } else if (dateShortcut === 'bulan_ini') {
      startFilter = new Date(now.getFullYear(), now.getMonth(), 1);
      endFilter = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    return visitsList.filter((v) => {
      const vDate = new Date(v.captured_at);

      if (startFilter && vDate < startFilter) return false;
      if (endFilter && vDate > endFilter) return false;

      if (selectedMarketing !== 'semua' && v.marketing_id !== selectedMarketing) {
        return false;
      }

      if (selectedVisitType !== 'semua' && v.visit_type !== selectedVisitType) {
        return false;
      }

      if (selectedOutcome !== 'semua' && v.outcome !== selectedOutcome) {
        return false;
      }

      if (selectedStatus !== 'semua' && v.verification_status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [
    visitsList,
    dateShortcut,
    selectedMarketing,
    selectedVisitType,
    selectedOutcome,
    selectedStatus,
  ]);

  // 2. Hitung Metrik Panel Atas (KPI Metrics)
  const metrics = useMemo(() => {
    const totalVisits = filteredVisits.length;
    const activeMarketings = new Set(filteredVisits.map((v) => v.marketing_id)).size;
    const newProspects = filteredVisits.filter((v) => v.visit_type === 'prospek_baru').length;
    const realizations = filteredVisits.filter((v) => v.outcome === 'realisasi').length;
    const totalPotential = filteredVisits.reduce((acc, v) => acc + (v.potential_value || 0), 0);
    const onTimeVisits = filteredVisits.filter((v) => !v.is_late).length;
    const onTimePercent = totalVisits > 0 ? Math.round((onTimeVisits / totalVisits) * 100) : 100;

    return {
      totalVisits,
      activeMarketings,
      newProspects,
      realizations,
      totalPotential,
      onTimePercent,
    };
  }, [filteredVisits]);

  // 3. Rekap Per Marketing (Agregasi Data)
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
        active_days_set: Set<string>;
        late_count: number;
        anomaly_count: number;
      }
    >();

    // Inisialisasi dari daftar marketing
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
        active_days_set: new Set(),
        late_count: 0,
        anomaly_count: 0,
      });
    });

    // Agregasi dari filteredVisits
    filteredVisits.forEach((v) => {
      let entry = map.get(v.marketing_id);
      if (!entry) {
        entry = {
          marketing_id: v.marketing_id,
          marketing_name: v.marketing?.full_name || 'Marketing',
          marketing_code: v.marketing?.marketing_code || '-',
          total_visits: 0,
          prospects: 0,
          existing: 0,
          collection: 0,
          realization: 0,
          potential_value: 0,
          active_days_set: new Set(),
          late_count: 0,
          anomaly_count: 0,
        };
        map.set(v.marketing_id, entry);
      }

      entry.total_visits++;
      if (v.visit_type === 'prospek_baru') entry.prospects++;
      if (v.visit_type === 'nasabah_existing') entry.existing++;
      if (v.visit_type === 'penagihan') entry.collection++;
      if (v.outcome === 'realisasi') entry.realization++;
      entry.potential_value += v.potential_value || 0;

      const dateKey = v.captured_at.substring(0, 10);
      entry.active_days_set.add(dateKey);

      if (v.is_late) entry.late_count++;
      if (v.anomaly_flags && v.anomaly_flags.length > 0) entry.anomaly_count++;
    });

    const rows = Array.from(map.values()).map((e) => ({
      ...e,
      active_days: e.active_days_set.size,
    }));

    // Sorting
    return rows.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') {
        return sortAsc
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string);
      }

      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [marketings, filteredVisits, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // 4. Aksi Verifikasi Kunjungan
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
        // Perbarui state lokal
        activeModalVisit.verification_status = status;
        activeModalVisit.verifier_note = verifierNote;
        setActionFeedback(
          status === 'verified' ? '✓ Kunjungan Berhasil Diterima' : '✕ Kunjungan Ditolak'
        );
        setTimeout(() => {
          setActiveModalVisit(null);
          setActionFeedback(null);
          setVerifierNote('');
        }, 1200);
      }
    } catch (err: unknown) {
      setActionFeedback(`⚠️ ${(err as Error).message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // 5. Unduh Laporan PDF
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  const handleDownloadPdf = (kategori: 'semua' | 'pemasaran' | 'penagihan' = 'semua') => {
    setIsDownloadingPdf(true);

    const now = new Date();
    let dari = '';
    let sampai = '';
    let jenis = 'bulanan';

    if (dateShortcut === 'hari_ini') {
      dari = now.toISOString().substring(0, 10);
      sampai = now.toISOString().substring(0, 10);
      jenis = 'harian';
    } else if (dateShortcut === '7_hari') {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 7);
      dari = past7.toISOString().substring(0, 10);
      sampai = now.toISOString().substring(0, 10);
      jenis = 'mingguan';
    } else {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      dari = firstDay.toISOString().substring(0, 10);
      sampai = lastDay.toISOString().substring(0, 10);
      jenis = 'bulanan';
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

  return (
    <div className="space-y-5 pb-12">
      {/* Bar Unduh Laporan PDF Resmi */}
      <div className="p-4 bg-gradient-to-r from-bkk-900 to-bkk-800 text-white rounded-2xl shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <span>📄</span> Cetak Laporan Resmi Bank BKK (A4)
            </h2>
            <p className="text-[11px] text-bkk-200 mt-0.5">
              Laporan terstruktur dengan tabel komprehensif &amp; lembar pengesahan
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleDownloadPdf('pemasaran')}
            disabled={isDownloadingPdf}
            className="px-3.5 py-2.5 bg-white text-bkk-900 hover:bg-bkk-50 active:scale-95 font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>📄</span> Unduh Laporan Pemasaran (Kredit/Dana)
          </button>

          <button
            type="button"
            onClick={() => handleDownloadPdf('penagihan')}
            disabled={isDownloadingPdf}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>💳</span> Unduh Laporan Penagihan (AO)
          </button>
        </div>
      </div>

      {/* 1. Panel Metrik Angka Atas (KPIs) */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 block">Total Kunjungan</span>
          <span className="text-2xl font-black text-slate-900 mt-0.5 block">
            {metrics.totalVisits}
          </span>
          <span className="text-[10px] text-slate-400">Periode Terpilih</span>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 block">Marketing Aktif</span>
          <span className="text-2xl font-black text-bkk-700 mt-0.5 block">
            {metrics.activeMarketings}
          </span>
          <span className="text-[10px] text-slate-400">Orang berkunjung</span>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 block">Prospek Baru</span>
          <span className="text-2xl font-black text-sky-600 mt-0.5 block">
            {metrics.newProspects}
          </span>
          <span className="text-[10px] text-slate-400">Calon nasabah</span>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 block">Realisasi</span>
          <span className="text-2xl font-black text-emerald-600 mt-0.5 block">
            {metrics.realizations}
          </span>
          <span className="text-[10px] text-slate-400">Goal tercapai</span>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm sm:col-span-1 col-span-2">
          <span className="text-[11px] font-medium text-slate-500 block">Total Potensi Nilai</span>
          <span className="text-lg font-black text-emerald-700 mt-0.5 block truncate">
            {formatRupiah(metrics.totalPotential)}
          </span>
          <span className="text-[10px] text-slate-400">Rupiah potensi</span>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 block">Tepat Waktu</span>
          <span className="text-2xl font-black text-indigo-600 mt-0.5 block">
            {metrics.onTimePercent}%
          </span>
          <span className="text-[10px] text-slate-400">Sebelum batas jam</span>
        </div>
      </section>

      {/* 2. Filter Bar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800">Filter Data Kunjungan</h2>
          <span className="text-[11px] text-slate-400">{filteredVisits.length} Data</span>
        </div>

        {/* Pintasan Tanggal */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'hari_ini', label: 'Hari Ini' },
            { id: '7_hari', label: '7 Hari Terakhir' },
            { id: 'bulan_ini', label: 'Bulan Ini' },
            { id: 'semua', label: 'Semua Waktu' },
          ].map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => setDateShortcut(sc.id as DateShortcut)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                dateShortcut === sc.id
                  ? 'bg-bkk-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Marketing</label>
            <select
              value={selectedMarketing}
              onChange={(e) => setSelectedMarketing(e.target.value)}
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-xs"
            >
              <option value="semua">Semua Marketing</option>
              {marketings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.marketing_code ? `[${m.marketing_code}] ` : ''}
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Status Verifikasi</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-xs"
            >
              <option value="semua">Semua Status</option>
              <option value="pending">Menunggu Verifikasi</option>
              <option value="verified">Diterima / Terverifikasi</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Jenis Kunjungan</label>
            <select
              value={selectedVisitType}
              onChange={(e) => setSelectedVisitType(e.target.value)}
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-xs"
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
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Hasil Kunjungan</label>
            <select
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value)}
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-xs"
            >
              <option value="semua">Semua Hasil</option>
              <option value="berminat">Berminat</option>
              <option value="follow_up">Follow Up</option>
              <option value="realisasi">Realisasi</option>
              <option value="tidak_berminat">Tidak Berminat</option>
              <option value="tidak_ditemui">Tidak Ditemui</option>
            </select>
          </div>
        </div>
      </section>

      {/* 3. Tabel Rekap Per Marketing (Sortable) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Rekap Kinerja Marketing</h2>
            <p className="text-[11px] text-slate-400">Klik header kolom untuk mengurutkan data</p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
              <tr>
                <th
                  onClick={() => handleSort('marketing_name')}
                  className="p-2.5 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Marketing {sortField === 'marketing_name' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('total_visits')}
                  className="p-2.5 text-center cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Kunjungan {sortField === 'total_visits' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('prospects')}
                  className="p-2.5 text-center cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Prospek {sortField === 'prospects' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('existing')}
                  className="p-2.5 text-center cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Existing {sortField === 'existing' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('collection')}
                  className="p-2.5 text-center cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Tagihan {sortField === 'collection' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('realization')}
                  className="p-2.5 text-center cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Realisasi {sortField === 'realization' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('potential_value')}
                  className="p-2.5 text-right cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Potensi (Rp) {sortField === 'potential_value' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('active_days')}
                  className="p-2.5 text-center cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Hari Aktif {sortField === 'active_days' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('late_count')}
                  className="p-2.5 text-center cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Terlambat {sortField === 'late_count' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('anomaly_count')}
                  className="p-2.5 text-center cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Anomali {sortField === 'anomaly_count' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {marketingSummaries.map((row) => (
                <tr key={row.marketing_id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 whitespace-nowrap">
                    <span className="font-bold text-slate-800 block">{row.marketing_name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{row.marketing_code}</span>
                  </td>
                  <td className="p-2.5 text-center font-bold text-slate-900">{row.total_visits}</td>
                  <td className="p-2.5 text-center text-sky-700">{row.prospects}</td>
                  <td className="p-2.5 text-center text-slate-600">{row.existing}</td>
                  <td className="p-2.5 text-center text-amber-700">{row.collection}</td>
                  <td className="p-2.5 text-center text-emerald-700 font-bold">{row.realization}</td>
                  <td className="p-2.5 text-right font-semibold text-emerald-800 whitespace-nowrap">
                    {formatRupiah(row.potential_value)}
                  </td>
                  <td className="p-2.5 text-center text-slate-600">{row.active_days}</td>
                  <td className="p-2.5 text-center">
                    {row.late_count > 0 ? (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">
                        {row.late_count}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="p-2.5 text-center">
                    {row.anomaly_count > 0 ? (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                        {row.anomaly_count}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Daftar Kunjungan & Pratinjau Thumbnail */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Daftar Kunjungan ({filteredVisits.length})
          </h2>
          <span className="text-[11px] text-slate-400">Klik kartu untuk detail &amp; verifikasi</span>
        </div>

        {filteredVisits.length === 0 ? (
          <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center">
            <div className="text-3xl mb-2">📋</div>
            <h3 className="text-sm font-bold text-slate-700">Tidak Ada Kunjungan</h3>
            <p className="text-xs text-slate-400 mt-1">
              Tidak ditemukan data kunjungan pada filter yang dipilih.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredVisits.map((v) => {
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

              const firstPhoto = v.visit_photos?.[0];

              return (
                <div
                  key={v.id}
                  onClick={() => {
                    setActiveModalVisit(v);
                    setVerifierNote(v.verifier_note || '');
                  }}
                  className="p-3 bg-white border border-slate-200 hover:border-bkk-400 rounded-2xl shadow-sm space-y-2 cursor-pointer transition active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      {/* Thumbnail Foto */}
                      <div className="w-12 h-12 rounded-xl bg-slate-900 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center text-xs text-white">
                        {firstPhoto ? (
                          <span className="font-bold text-[10px]">📷 #{v.visit_photos.length}</span>
                        ) : (
                          '📷'
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">
                          {v.customer_name}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {v.marketing?.marketing_code ? `[${v.marketing.marketing_code}] ` : ''}
                          {v.marketing?.full_name} • {formatWIB(v.captured_at)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md capitalize font-medium">
                      {v.visit_type.replace(/_/g, ' ')}
                    </span>
                    <span className="px-2 py-0.5 bg-bkk-50 text-bkk-700 rounded-md capitalize font-medium">
                      {v.product}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md capitalize">
                      {v.outcome.replace(/_/g, ' ')}
                    </span>
                    {v.potential_value && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-semibold">
                        {formatRupiah(v.potential_value)}
                      </span>
                    )}
                  </div>

                  {v.address && (
                    <p className="text-[11px] text-slate-500 truncate">📍 {v.address}</p>
                  )}

                  {v.anomaly_flags && v.anomaly_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                      {v.anomaly_flags.map((flag) => (
                        <span
                          key={flag}
                          className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded"
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
      </section>

      {/* 5. Modal Detail Kunjungan & Verifikasi */}
      {activeModalVisit && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl p-5 shadow-2xl my-auto space-y-4 max-h-[92vh] overflow-y-auto text-slate-900">
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-bkk-600 bg-bkk-50 px-2 py-0.5 rounded">
                  {activeModalVisit.marketing?.marketing_code || 'MKT'} • {activeModalVisit.marketing?.full_name}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {activeModalVisit.customer_name}
                </h3>
                <p className="text-xs text-slate-400">
                  {formatWIB(activeModalVisit.captured_at)}
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveModalVisit(null);
                  setActionFeedback(null);
                }}
                className="text-xs font-semibold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
              >
                ✕ Tutup
              </button>
            </div>

            {/* Rincian Kunjungan */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs space-y-2">
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
                  <span className="text-slate-400 block text-[10px]">Catatan Marketing</span>
                  <p className="text-slate-700 italic mt-0.5">{activeModalVisit.notes}</p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-400 block text-[10px]">Koordinat &amp; Alamat</span>
                <p className="font-mono text-[11px] text-slate-700">
                  {activeModalVisit.lat?.toFixed(6)}, {activeModalVisit.lng?.toFixed(6)} (Akurasi: {Math.round(activeModalVisit.accuracy_m || 0)}m)
                </p>
                {activeModalVisit.address && (
                  <p className="text-slate-600 text-[11px] mt-0.5">📍 {activeModalVisit.address}</p>
                )}
              </div>
            </div>

            {/* Peta Embed OpenStreetMap Statis (Bebas Kunci API) */}
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

            {/* Anomaly Badges if any */}
            {activeModalVisit.anomaly_flags && activeModalVisit.anomaly_flags.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-amber-900 block">⚠️ Indikasi Anomali:</span>
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
