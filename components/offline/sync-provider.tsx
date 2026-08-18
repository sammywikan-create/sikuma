'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  getQueuedVisits,
  getQueueTotalBytes,
  MAX_QUEUE_BYTES,
  type QueuedVisit,
} from '@/lib/storage/db';
import { processVisitQueue } from '@/lib/storage/sync';

interface SyncContextType {
  isOnline: boolean;
  queueCount: number;
  queueTotalBytes: number;
  isMemoryFull: boolean;
  isSyncing: boolean;
  queuedVisits: QueuedVisit[];
  triggerManualSync: () => Promise<void>;
  refreshQueueStatus: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType>({
  isOnline: true,
  queueCount: 0,
  queueTotalBytes: 0,
  isMemoryFull: false,
  isSyncing: false,
  queuedVisits: [],
  triggerManualSync: async () => {},
  refreshQueueStatus: async () => {},
});

export function useSync() {
  return useContext(SyncContext);
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [queueTotalBytes, setQueueTotalBytes] = useState<number>(0);
  const [queuedVisits, setQueuedVisits] = useState<QueuedVisit[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshQueueStatus = useCallback(async () => {
    try {
      const visits = await getQueuedVisits();
      const totalBytes = await getQueueTotalBytes();
      setQueuedVisits(visits);
      setQueueCount(visits.length);
      setQueueTotalBytes(totalBytes);
    } catch {
      // IndexedDB mungkin belum siap saat initial render
    }
  }, []);

  const runSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      await processVisitQueue(refreshQueueStatus);
      await refreshQueueStatus();
    } finally {
      setIsSyncing(false);
    }
  }, [refreshQueueStatus]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshQueueStatus();

    const handleOnline = () => {
      setIsOnline(true);
      runSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Jalankan sync saat pertama kali aplikasi dibuka jika online
    if (navigator.onLine) {
      runSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [runSync, refreshQueueStatus]);

  const triggerManualSync = async () => {
    if (!navigator.onLine) {
      alert('Perangkat Anda masih dalam keadaan offline. Pastikan koneksi internet aktif.');
      return;
    }
    await runSync();
  };

  const isMemoryFull = queueTotalBytes >= MAX_QUEUE_BYTES;

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        queueCount,
        queueTotalBytes,
        isMemoryFull,
        isSyncing,
        queuedVisits,
        triggerManualSync,
        refreshQueueStatus,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
