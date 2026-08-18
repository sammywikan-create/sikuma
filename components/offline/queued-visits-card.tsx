'use client';

import { useSync } from './sync-provider';
import { formatWIB } from '@/lib/utils/time';
import { formatRupiah } from '@/lib/utils/format';

export default function QueuedVisitsCard() {
  const { queueCount, queuedVisits, isOnline, isSyncing, triggerManualSync } = useSync();

  if (queueCount === 0) {
    return null;
  }

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
            className="text-[11px] font-bold px-2.5 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white rounded-lg transition"
          >
            {isSyncing ? 'Mengirim...' : 'Sinkronkan Sekarang ⟳'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {queuedVisits.map((item) => (
          <div
            key={item.client_uuid}
            className="p-2.5 bg-white border border-amber-200/80 rounded-xl text-xs space-y-1"
          >
            <div className="flex items-start justify-between">
              <span className="font-bold text-slate-800">{item.customer_name}</span>
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
