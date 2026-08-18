'use client';

import { useSync } from './sync-provider';
import { formatWIB } from '@/lib/utils/time';
import { formatRupiah } from '@/lib/utils/format';

export default function QueuedVisitsCard() {
  const {
    queueCount,
    queuedVisits,
    isOnline,
    isSyncing,
    triggerManualSync,
    deleteQueuedVisit,
  } = useSync();

  if (queueCount === 0) {
    return null;
  }

  const handleDeleteItem = async (clientUuid: string, customerName: string) => {
    if (confirm(`Hapus data antrean untuk "${customerName}" dari memori HP?`)) {
      await deleteQueuedVisit(clientUuid);
    }
  };

  return (
    <section className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
          <h2 className="text-xs font-bold text-amber-900">
            Antrean Tersimpan di HP ({queueCount})
          </h2>
        </div>
        {isOnline && (
          <button
            onClick={() => triggerManualSync()}
            disabled={isSyncing}
            className="text-[11px] font-bold px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white rounded-lg transition shadow-sm cursor-pointer flex items-center gap-1"
          >
            <span>{isSyncing ? 'Mengirim...' : 'Sinkronkan Ulang ⟳'}</span>
          </button>
        )}
      </div>

      <div className="space-y-2">
        {queuedVisits.map((item) => (
          <div
            key={item.client_uuid}
            className="p-2.5 bg-white border border-amber-200/80 rounded-xl text-xs space-y-1 relative"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-slate-800">{item.customer_name}</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    item.status === 'failed'
                      ? 'bg-red-100 text-red-700 border border-red-200'
                      : item.status === 'syncing'
                      ? 'bg-sky-100 text-sky-700 border border-sky-200'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {item.status === 'failed'
                    ? `Gagal (${item.retry_count}x)`
                    : item.status === 'syncing'
                    ? 'Mengirim...'
                    : 'Menunggu Sinyal'}
                </span>

                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.client_uuid, item.customer_name)}
                  title="Hapus dari antrean"
                  className="w-5 h-5 rounded-md bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-600 flex items-center justify-center text-[10px] transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>{formatWIB(item.captured_at)}</span>
              <span>•</span>
              <span className="capitalize">{item.visit_type.replace(/_/g, ' ')}</span>
              {item.potential_value && (
                <>
                  <span>•</span>
                  <span className="text-emerald-700 font-semibold">
                    {formatRupiah(item.potential_value)}
                  </span>
                </>
              )}
            </div>
            {item.last_error && (
              <p className="text-[10px] text-red-600 truncate">
                ⚠️ {item.last_error}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
