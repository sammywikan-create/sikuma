interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Bersihkan rekaman yang lebih tua dari 1 jam setiap 15 menit
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 3600000);
      if (record.timestamps.length === 0) {
        rateLimitMap.delete(key);
      }
    }
  }, 900000);
}

/**
 * Memeriksa apakah identifier (IP/User ID) melebihi batas request dalam jendela waktu tertentu.
 * @param key Identifier unik, misal `kunjungan_${userId}` atau `pdf_${ip}`
 * @param maxRequests Jumlah maksimal permintaan yang diizinkan dalam windowMs
 * @param windowMs Jendela waktu dalam milidetik (default: 60.000 ms / 1 menit)
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60000
): { isAllowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let record = rateLimitMap.get(key);

  if (!record) {
    record = { timestamps: [] };
    rateLimitMap.set(key, record);
  }

  // Filter timestamp yang berada dalam window aktif
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldestTimestamp = record.timestamps[0];
    const resetMs = windowMs - (now - oldestTimestamp);
    return {
      isAllowed: false,
      remaining: 0,
      resetMs: Math.max(0, resetMs),
    };
  }

  record.timestamps.push(now);
  const remaining = maxRequests - record.timestamps.length;

  return {
    isAllowed: true,
    remaining,
    resetMs: windowMs,
  };
}
