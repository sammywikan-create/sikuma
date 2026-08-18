import { openDB, type IDBPDatabase } from 'idb';
import type { VisitType, ProductType, OutcomeType } from '@/lib/types/database';

export const MAX_QUEUE_BYTES = 50 * 1024 * 1024; // 50 Megabytes (Batas Memori HP)

export interface DraftPhoto {
  id: string;
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
  captured_at: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  address?: string;
  sha256?: string;
  sort_order: number;
}

export interface DraftVisit {
  client_uuid: string;
  captured_at: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  address?: string;
  anomaly_flags: string[];
  photos: DraftPhoto[];
  updated_at: string;
}

export interface QueuedVisit {
  client_uuid: string;
  customer_name: string;
  visit_type: VisitType;
  product: ProductType;
  outcome: OutcomeType;
  potential_value: number | null;
  notes: string | null;
  captured_at: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  address: string | null;
  photos: DraftPhoto[];
  status: 'pending' | 'syncing' | 'failed';
  retry_count: number;
  last_error: string | null;
  created_at: string;
}

const DB_NAME = 'sikuma_offline_db';
const DB_VERSION = 2;

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('current_draft')) {
          db.createObjectStore('current_draft', { keyPath: 'client_uuid' });
        }
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('visit_queue')) {
          const queueStore = db.createObjectStore('visit_queue', { keyPath: 'client_uuid' });
          queueStore.createIndex('by_created', 'created_at');
          queueStore.createIndex('by_status', 'status');
        }
      }
    },
  });
}

// ----------------------------------------------------
// A. Manajemen Draft Aktif
// ----------------------------------------------------

export async function saveCurrentDraft(draft: DraftVisit): Promise<void> {
  const db = await getDB();
  await db.put('current_draft', draft);
}

export async function getCurrentDraft(): Promise<DraftVisit | undefined> {
  const db = await getDB();
  const all = await db.getAll('current_draft');
  return all[all.length - 1];
}

export async function clearCurrentDraft(): Promise<void> {
  const db = await getDB();
  await db.clear('current_draft');
}

// ----------------------------------------------------
// B. Manajemen Antrean Offline (visit_queue)
// ----------------------------------------------------

/**
 * Menyimpan kunjungan ke antrean lokal di IndexedDB
 */
export async function enqueueVisit(visit: QueuedVisit): Promise<void> {
  const db = await getDB();
  await db.put('visit_queue', visit);
}

/**
 * Mengambil semua antrean kunjungan urut tanggal pembuatan (FIFO)
 */
export async function getQueuedVisits(): Promise<QueuedVisit[]> {
  const db = await getDB();
  const visits = await db.getAllFromIndex('visit_queue', 'by_created');
  return visits || [];
}

/**
 * Menghitung total ukuran bytes dari seluruh foto dalam antrean IndexedDB
 */
export async function getQueueTotalBytes(): Promise<number> {
  const visits = await getQueuedVisits();
  let totalBytes = 0;
  for (const v of visits) {
    if (v.photos && Array.isArray(v.photos)) {
      for (const p of v.photos) {
        totalBytes += p.bytes || 0;
      }
    }
  }
  return totalBytes;
}

/**
 * Memperbarui status sync atau retry count suatu kunjungan dalam antrean
 */
export async function updateQueuedVisit(
  client_uuid: string,
  updates: Partial<QueuedVisit>
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('visit_queue', client_uuid);
  if (existing) {
    await db.put('visit_queue', { ...existing, ...updates });
  }
}

/**
 * Menghapus kunjungan yang sudah berhasil terkirim ke server dari antrean
 */
export async function removeQueuedVisit(client_uuid: string): Promise<void> {
  const db = await getDB();
  await db.delete('visit_queue', client_uuid);
}
