'use client';

import { useSync } from './sync-provider';

export default function OfflineStatusBanner() {
  const {
    isOnline,
    queueCount,
    queueTotalBytes,
    isMemoryFull,
    isSyncing,
    triggerManualSync,
  } = useSync();

  const totalMB = (queueTotalBytes / (1024 * 1024)).toFixed(1);

  // Jika online dan tidak ada antrean serta memori aman, sembunyikan banner
  if (isOnline && queueCount === 0 && !isMemoryFull) {
    return null;
  }

  return (
    <aside
      aria-label="Status Sinyal & Antrean Offline"
      className={`w-full px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors z-40 sticky top-0 shadow-sm ${
        isMemoryFull
          ? 'bg-red-600 text-white'
          : !isOnline
          ? 'bg-amber-500 text-slate-950'
          : 'bg-sky-600 text-white'
      }`}
    >
      <div className="flex items-center gap-2 truncate">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            !isOnline
              ? 'bg-amber-900 animate-pulse'
              : isMemoryFull
              ? 'bg-white animate-bounce'
              : 'bg-emerald-300'
          }`}
        ></span>

        <div className="truncate">
          {!isOnline ? (
            <span>
              Mode Offline •{' '}
              {queueCount > 0
                ? `Tersimpan di HP: ${queueCount} kunjungan menunggu terkirim (${totalMB} MB)`
                : 'Tidak ada koneksi internet'}
            </span>
          ) : isMemoryFull ? (
            <span>
              ⚠️ Memori HP Penuh ({totalMB} MB / 50 MB) • Kirim antrean dahulu!
            </span>
          ) : isSyncing ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              Sedang mengirim {queueCount} kunjungan ke server...
            </span>
          ) : (
            <span>
              Tersimpan di HP: {queueCount} kunjungan menunggu terkirim ({totalMB} MB)
            </span>
          )}
        </div>
      </div>

      {/* Tombol Aksi Manual jika online dan ada antrean */}
      {isOnline && queueCount > 0 && !isSyncing && (
        <button
          type="button"
          onClick={() => triggerManualSync()}
          className="ml-2 px-2.5 py-1 bg-white/20 hover:bg-white/30 active:scale-95 text-inherit rounded-md text-[11px] font-bold shrink-0 transition"
        >
          Kirim Sekarang ⟳
        </button>
      )}
    </aside>
  );
}
