'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { formatRupiah } from '@/lib/utils/format';
import type { VisitType, ProductType, OutcomeType } from '@/lib/types/database';

export interface MarketingPerformanceSummary {
  marketing_id: string;
  marketing_name: string;
  marketing_code: string;
  role: string;
  total_visits: number;
  period_target: number;
  achievement_percent: number;
  verified_count: number;
  rejected_count: number;
  pending_count: number;
  anomaly_count: number;
  potential_value: number;
  realization_count: number;
  interested_count: number;
  interested_ratio: number;
  late_count: number;
  late_percent: number;
  visit_type_counts: Record<VisitType, number>;
  product_counts: Record<ProductType, number>;
  outcome_counts: Record<OutcomeType, number>;
}

export interface DailyTrendPoint {
  dateStr: string;
  dayLabel: string;
  totalVisits: number;
  realizations: number;
  anomalies: number;
}

interface KinerjaViewProps {
  summaries: MarketingPerformanceSummary[];
  dailyTrends: DailyTrendPoint[];
  initialFilters: {
    periode: string;
    dari: string;
    sampai: string;
  };
  totalVisitsInPeriod: number;
  periodLabel: string;
}

type SortField =
  | 'marketing_name'
  | 'total_visits'
  | 'achievement_percent'
  | 'verified_count'
  | 'rejected_count'
  | 'anomaly_count'
  | 'potential_value'
  | 'interested_ratio';

export default function KinerjaView({
  summaries,
  dailyTrends,
  initialFilters,
  totalVisitsInPeriod,
  periodLabel,
}: KinerjaViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [periode, setPeriode] = useState<string>(initialFilters.periode || 'bulan_ini');
  const [customDari, setCustomDari] = useState<string>(initialFilters.dari);
  const [customSampai, setCustomSampai] = useState<string>(initialFilters.sampai);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('total_visits');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Detail Modal / Accordion per Marketing
  const [activeMarketingId, setActiveMarketingId] = useState<string | null>(null);

  const updateFilters = (updates: Record<string, string>) => {
    const current = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([k, v]) => {
      if (!v) current.delete(k);
      else current.set(k, v);
    });

    startTransition(() => {
      router.push(`${pathname}?${current.toString()}`);
    });
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams({
      source: 'kinerja',
      periode,
      dari: customDari,
      sampai: customSampai,
    });
    window.open(`/api/laporan/csv?${params.toString()}`, '_blank');
  };

  // Sort Ranking List
  const sortedSummaries = useMemo(() => {
    return [...summaries].sort((a, b) => {
      let valA: string | number = a[sortField];
      let valB: string | number = b[sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [summaries, sortField, sortAsc]);

  const activeMarketing = useMemo(() => {
    return summaries.find((s) => s.marketing_id === activeMarketingId) || null;
  }, [summaries, activeMarketingId]);

  // Max value for SVG Trend Chart height calculation
  const maxTrendValue = useMemo(() => {
    const max = Math.max(...dailyTrends.map((d) => d.totalVisits), 1);
    return Math.ceil(max * 1.15);
  }, [dailyTrends]);

  return (
    <div className="space-y-6 pb-16">
      {/* Banner Filter Periode & Ekspor CSV */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>🏆</span> Evaluasi &amp; Peringkat Kinerja Petugas Lapangan
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Periode Aktif: <strong className="text-slate-800">{periodLabel}</strong> • Total <strong className="text-bkk-700">{totalVisitsInPeriod}</strong> kunjungan tercatat
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>📊</span> Ekspor CSV Kinerja
          </button>
        </div>

        {/* Pilihan Cepat Periode */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'minggu_ini', label: 'Minggu Ini' },
            { id: 'bulan_ini', label: 'Bulan Ini' },
            { id: 'bulan_lalu', label: 'Bulan Lalu' },
            { id: 'custom', label: 'Rentang Kustom' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPeriode(p.id);
                updateFilters({ periode: p.id });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                periode === p.id
                  ? 'bg-bkk-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Form Rentang Kustom */}
        {periode === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
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
              onClick={() => updateFilters({ periode: 'custom', dari: customDari, sampai: customSampai })}
              className="px-3 py-1.5 bg-bkk-600 hover:bg-bkk-700 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              Terapkan Tanggal
            </button>
          </div>
        )}

        {isPending && (
          <div className="flex items-center gap-2 text-xs text-bkk-600 font-semibold pt-1">
            <span className="w-3.5 h-3.5 border-2 border-bkk-600 border-t-transparent rounded-full animate-spin"></span>
            Memperbarui data analitik...
          </div>
        )}
      </div>

      {/* Grafik Tren Kunjungan Harian (Native SVG Pure & Responsif) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              📈 Tren Kunjungan Harian Seluruh Petugas
            </h3>
            <p className="text-[11px] text-slate-400">
              Grafik intensitas kunjungan dan realisasi per tanggal kalender WIB
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1 text-bkk-700">
              <span className="w-2.5 h-2.5 bg-bkk-600 rounded"></span> Total Kunjungan
            </span>
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded"></span> Realisasi Closing
            </span>
          </div>
        </div>

        {dailyTrends.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic">
            Tidak ada data kunjungan pada periode ini.
          </div>
        ) : (
          <div className="w-full overflow-x-auto pt-4 pb-2">
            <div className="min-w-[600px] h-48 flex items-end gap-2 border-b border-slate-200 px-2 pb-1 relative">
              {dailyTrends.map((d) => {
                const totalHeightPct = (d.totalVisits / maxTrendValue) * 100;

                return (
                  <div
                    key={d.dateStr}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                  >
                    {/* Tooltip Hover */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap z-20 pointer-events-none">
                      <span className="font-bold text-amber-300">{d.dayLabel} ({d.dateStr})</span>
                      <span>Total: {d.totalVisits} kunjungan</span>
                      <span className="text-emerald-300">Realisasi: {d.realizations}</span>
                      {d.anomalies > 0 && <span className="text-red-300">⚠️ {d.anomalies} Anomali</span>}
                    </div>

                    {/* Bar Total Kunjungan */}
                    <div className="w-full max-w-[24px] flex items-end justify-center relative rounded-t-md overflow-hidden bg-slate-100 h-full">
                      <div
                        style={{ height: `${totalHeightPct}%` }}
                        className="w-full bg-bkk-600 hover:bg-bkk-500 transition-all rounded-t-md relative flex items-end"
                      >
                        {/* Realisasi Closing Bar Inner */}
                        {d.realizations > 0 && (
                          <div
                            style={{ height: `${(d.realizations / d.totalVisits) * 100}%` }}
                            className="w-full bg-emerald-500 rounded-t-sm"
                          ></div>
                        )}
                      </div>
                    </div>

                    {/* Label Tanggal */}
                    <span className="text-[9px] font-mono text-slate-400 mt-1 truncate max-w-[32px] text-center">
                      {d.dateStr.slice(8)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tabel Peringkat & Evaluasi Kinerja */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            🏅 Peringkat &amp; Capaian Target Petugas
          </h3>
          <span className="text-[11px] text-slate-400">
            Klik baris petugas untuk melihat rincian produk dan hasil
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] text-slate-500 font-bold">
                <th className="pb-2.5 cursor-pointer" onClick={() => { setSortField('marketing_name'); setSortAsc(!sortAsc); }}>
                  Petugas Lapangan {sortField === 'marketing_name' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="pb-2.5 text-center cursor-pointer" onClick={() => { setSortField('total_visits'); setSortAsc(!sortAsc); }}>
                  Total {sortField === 'total_visits' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="pb-2.5 text-center">Target</th>
                <th className="pb-2.5 text-center cursor-pointer" onClick={() => { setSortField('achievement_percent'); setSortAsc(!sortAsc); }}>
                  Capaian % {sortField === 'achievement_percent' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="pb-2.5 text-center cursor-pointer" onClick={() => { setSortField('verified_count'); setSortAsc(!sortAsc); }}>
                  Disetujui {sortField === 'verified_count' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="pb-2.5 text-center cursor-pointer" onClick={() => { setSortField('anomaly_count'); setSortAsc(!sortAsc); }}>
                  Anomali {sortField === 'anomaly_count' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="pb-2.5 text-right cursor-pointer" onClick={() => { setSortField('potential_value'); setSortAsc(!sortAsc); }}>
                  Nilai Potensi {sortField === 'potential_value' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="pb-2.5 text-center cursor-pointer" onClick={() => { setSortField('interested_ratio'); setSortAsc(!sortAsc); }}>
                  Closing Rate {sortField === 'interested_ratio' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSummaries.map((m, idx) => {
                const isSelected = activeMarketingId === m.marketing_id;
                const achievementColor =
                  m.achievement_percent >= 100
                    ? 'bg-emerald-500'
                    : m.achievement_percent >= 70
                    ? 'bg-bkk-600'
                    : 'bg-amber-500';

                return (
                  <tr
                    key={m.marketing_id}
                    onClick={() => setActiveMarketingId(isSelected ? null : m.marketing_id)}
                    className={`hover:bg-slate-50 transition cursor-pointer ${
                      isSelected ? 'bg-bkk-50/60 font-semibold' : ''
                    }`}
                  >
                    <td className="py-3 text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          idx === 0 ? 'bg-amber-400 text-amber-950 shadow-sm' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold">{m.marketing_name}</span>
                          <span className="text-[10px] text-slate-400 ml-1 font-mono">[{m.marketing_code}]</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 text-center font-bold text-bkk-700">{m.total_visits}</td>
                    <td className="py-3 text-center text-slate-500">{m.period_target}</td>

                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            style={{ width: `${Math.min(m.achievement_percent, 100)}%` }}
                            className={`h-full ${achievementColor}`}
                          ></div>
                        </div>
                        <span className="font-bold text-[11px]">{m.achievement_percent}%</span>
                      </div>
                    </td>

                    <td className="py-3 text-center font-semibold text-emerald-700">{m.verified_count}</td>

                    <td className="py-3 text-center font-semibold text-red-600">
                      {m.anomaly_count > 0 ? `⚠️ ${m.anomaly_count}` : '0'}
                    </td>

                    <td className="py-3 text-right font-bold text-slate-900">{formatRupiah(m.potential_value)}</td>

                    <td className="py-3 text-center font-bold text-emerald-600">{m.interested_ratio}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rincian Komprehensif Saat Baris Marketing Diklik */}
      {activeMarketing && (
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-5 animate-in fade-in-50">
          <div className="flex items-start justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950 px-2.5 py-0.5 rounded border border-amber-800">
                Rincian Kinerja Petugas
              </span>
              <h3 className="text-base font-bold text-white mt-1.5">
                {activeMarketing.marketing_name} <span className="text-slate-400 font-mono text-xs">[{activeMarketing.marketing_code}]</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Total {activeMarketing.total_visits} kunjungan • Tingkat Keterlambatan: {activeMarketing.late_percent}% ({activeMarketing.late_count} kali)
              </p>
            </div>

            <button
              onClick={() => setActiveMarketingId(null)}
              className="text-xs font-semibold px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 cursor-pointer"
            >
              ✕ Tutup
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sebaran Jenis Kunjungan */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-2.5">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                📌 Sebaran Jenis Kunjungan
              </h4>
              <div className="space-y-1.5 text-xs">
                {Object.entries(activeMarketing.visit_type_counts).map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center py-0.5">
                    <span className="text-slate-300 capitalize">{type.replace(/_/g, ' ')}</span>
                    <span className="font-bold text-white bg-slate-700 px-2 py-0.5 rounded-full text-[11px]">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sebaran Produk */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-2.5">
              <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                📦 Sebaran Produk Ditawarkan
              </h4>
              <div className="space-y-1.5 text-xs">
                {Object.entries(activeMarketing.product_counts).map(([product, count]) => (
                  <div key={product} className="flex justify-between items-center py-0.5">
                    <span className="text-slate-300 capitalize">{product}</span>
                    <span className="font-bold text-white bg-slate-700 px-2 py-0.5 rounded-full text-[11px]">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sebaran Hasil Pertemuan */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-2.5">
              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                🎯 Sebaran Hasil Kunjungan
              </h4>
              <div className="space-y-1.5 text-xs">
                {Object.entries(activeMarketing.outcome_counts).map(([outcome, count]) => (
                  <div key={outcome} className="flex justify-between items-center py-0.5">
                    <span className="text-slate-300 capitalize">{outcome.replace(/_/g, ' ')}</span>
                    <span className="font-bold text-white bg-slate-700 px-2 py-0.5 rounded-full text-[11px]">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
