import {
  getQueuedVisits,
  updateQueuedVisit,
  removeQueuedVisit,
  type QueuedVisit,
} from './db';

const MAX_RETRIES = 5;
let isSyncInProgress = false;

/**
 * Mengirim satu item kunjungan ke server route handler /api/kunjungan
 */
export async function syncSingleVisit(
  visit: QueuedVisit
): Promise<{ success: boolean; error?: string }> {
  try {
    const uploadedPhotosMetadata = [];

    for (const photo of visit.photos) {
      // 1. Minta signed upload URL dari server
      const signRes = await fetch('/api/kunjungan/unggah-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: visit.customer_name,
          captured_at: photo.captured_at || visit.captured_at,
        }),
      });

      const signData = await signRes.json();
      if (!signRes.ok || !signData.signed_url || !signData.storage_path) {
        return {
          success: false,
          error: signData.error || 'Gagal memperoleh signed upload URL saat sinkronisasi.',
        };
      }

      // 2. Unggah Blob JPEG langsung ke Storage
      const blob = await fetch(photo.dataUrl).then((r) => r.blob());
      const uploadRes = await fetch(signData.signed_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });

      if (!uploadRes.ok) {
        return {
          success: false,
          error: `Gagal mengunggah foto ke storage (${uploadRes.status}).`,
        };
      }

      uploadedPhotosMetadata.push({
        storage_path: signData.storage_path,
        bytes: photo.bytes || blob.size,
        width: photo.width,
        height: photo.height,
        sha256: photo.sha256,
        sort_order: photo.sort_order,
      });
    }

    // 3. Kirim metadata kunjungan
    const payload = {
      client_uuid: visit.client_uuid,
      customer_name: visit.customer_name,
      visit_type: visit.visit_type,
      product: visit.product,
      outcome: visit.outcome,
      potential_value: visit.potential_value,
      baki_debet: visit.baki_debet,
      kolektibilitas: visit.kolektibilitas,
      notes: visit.notes,
      captured_at: visit.captured_at,
      lat: visit.lat,
      lng: visit.lng,
      accuracy_m: visit.accuracy_m,
      address: visit.address,
      photos: uploadedPhotosMetadata,
    };

    const res = await fetch('/api/kunjungan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error).message || 'Gagal terhubung ke server saat sinkronisasi.',
    };
  }
}

/**
 * Memproses seluruh antrean kunjungan offline secara berurutan (FIFO)
 * @param onProgress Callback untuk memperbarui UI
 * @param forceRetryAll Jika true (sinkronisasi manual), reset semua kegagalan dan coba kirim ulang
 */
export async function processVisitQueue(
  onProgress?: () => void,
  forceRetryAll: boolean = false
): Promise<{
  processedCount: number;
  failedCount: number;
}> {
  if (isSyncInProgress) {
    return { processedCount: 0, failedCount: 0 };
  }

  // Jika browser dalam mode offline murni, jangan kirim
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processedCount: 0, failedCount: 0 };
  }

  isSyncInProgress = true;
  let processedCount = 0;
  let failedCount = 0;

  try {
    const queue = await getQueuedVisits();

    for (const visit of queue) {
      // Jika sinkronisasi manual dipicu, reset status gagal agar bisa dikirim kembali
      if (forceRetryAll && visit.status === 'failed') {
        await updateQueuedVisit(visit.client_uuid, {
          status: 'pending',
          retry_count: 0,
          last_error: null,
        });
        visit.status = 'pending';
        visit.retry_count = 0;
      }

      // Lewati jika sudah gagal permanen (5x) pada siklus background otomatis
      if (!forceRetryAll && visit.status === 'failed' && visit.retry_count >= MAX_RETRIES) {
        continue;
      }

      await updateQueuedVisit(visit.client_uuid, { status: 'syncing' });
      if (onProgress) onProgress();

      const result = await syncSingleVisit(visit);

      if (result.success) {
        // Hapus dari antrean lokal jika sukses terkirim
        await removeQueuedVisit(visit.client_uuid);
        processedCount++;
      } else {
        const nextRetry = (visit.retry_count || 0) + 1;
        const newStatus = nextRetry >= MAX_RETRIES ? 'failed' : 'pending';

        await updateQueuedVisit(visit.client_uuid, {
          status: newStatus,
          retry_count: nextRetry,
          last_error: result.error || 'Galat server saat mengirim data.',
        });
        failedCount++;
      }

      if (onProgress) onProgress();
    }
  } catch (err) {
    console.error('Error saat memproses antrean kunjungan:', err);
  } finally {
    isSyncInProgress = false;
  }

  return { processedCount, failedCount };
}
