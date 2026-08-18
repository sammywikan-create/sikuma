import { formatWIB } from './time';

export interface WatermarkData {
  marketingCode: string;
  marketingName: string;
  lat: number;
  lng: number;
  accuracy: number;
  address: string;
  capturedAt?: Date | string;
}

export interface ProcessedPhotoResult {
  blob: Blob;
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
  sha256?: string;
}

/**
 * Menghitung hash SHA-256 dari ArrayBuffer
 */
async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}

/**
 * Menggambar watermark permanen dan meresize gambar ke max 1280px
 */
export async function applyWatermarkAndCompress(
  sourceImage: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  data: WatermarkData
): Promise<ProcessedPhotoResult> {
  // 1. Hitung dimensi dengan sisi terpanjang maks 1280px
  const MAX_DIMENSION = 1280;
  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;

  if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((sourceHeight * MAX_DIMENSION) / sourceWidth);
      targetWidth = MAX_DIMENSION;
    } else {
      targetWidth = Math.round((sourceWidth * MAX_DIMENSION) / sourceHeight);
      targetHeight = MAX_DIMENSION;
    }
  }

  // 2. Buat canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Gagal menginisialisasi 2D Canvas context');
  }

  // Aktifkan image smoothing untuk kualitas maksimal saat downscaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 3. Gambar frame foto utama
  ctx.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);

  // 4. Gambar panel gelap semi-transparan di bagian bawah (~22% tinggi gambar)
  const panelHeight = Math.round(targetHeight * 0.22);
  const panelY = targetHeight - panelHeight;

  // Latar belakang panel gelap dengan sedikit gradasi untuk kontras visual
  const gradient = ctx.createLinearGradient(0, panelY, 0, targetHeight);
  gradient.addColorStop(0, 'rgba(15, 23, 42, 0.78)');
  gradient.addColorStop(1, 'rgba(15, 23, 42, 0.92)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, panelY, targetWidth, panelHeight);

  // Garis aksen biru BKK tipis di atas panel
  ctx.fillStyle = '#2d8aff';
  ctx.fillRect(0, panelY, targetWidth, Math.max(3, Math.round(targetHeight * 0.004)));

  // 5. Cetak teks 4 baris putih
  // Hitung ukuran font proporsional (sekitar 2.1% dari lebar target)
  const fontSize = Math.max(14, Math.round(targetWidth * 0.021));
  const lineHeight = Math.round(fontSize * 1.4);
  const paddingX = Math.round(targetWidth * 0.035);
  const startY = panelY + Math.round((panelHeight - lineHeight * 4) / 2) + fontSize;

  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';

  // Baris 1: Waktu WIB
  const timeStr = formatWIB(data.capturedAt);
  ctx.fillText(timeStr, paddingX, startY);

  // Baris 2: Koordinat & Akurasi
  const latFixed = data.lat.toFixed(6);
  const lngFixed = data.lng.toFixed(6);
  const accFixed = Math.round(data.accuracy);
  const coordStr = `${latFixed}, ${lngFixed}  (akurasi ${accFixed} m)`;
  ctx.fillText(coordStr, paddingX, startY + lineHeight);

  // Baris 3: Alamat (potong dengan ellipsis jika terlalu panjang melebihi lebar panel)
  const maxAddressWidth = targetWidth - paddingX * 2;
  let rawAddress = data.address?.trim() || 'Alamat tidak terdeteksi (Hanya koordinat GPS)';
  
  // Ukur lebar teks dan potong jika perlu
  if (ctx.measureText(rawAddress).width > maxAddressWidth) {
    while (rawAddress.length > 5 && ctx.measureText(rawAddress + '...').width > maxAddressWidth) {
      rawAddress = rawAddress.slice(0, -1);
    }
    rawAddress = rawAddress + '...';
  }
  ctx.fillStyle = '#f1f5f9';
  ctx.fillText(rawAddress, paddingX, startY + lineHeight * 2);

  // Baris 4: Kode Marketing, Nama, Bank BKK Internal
  ctx.fillStyle = '#93c5fd'; // Warna cyan lembut untuk identitas marketing
  const marketingStr = `${data.marketingCode} - ${data.marketingName} | BANK BKK - INTERNAL`;
  ctx.fillText(marketingStr, paddingX, startY + lineHeight * 3);

  // 6. Kompresi JPEG adaptif (Target 150-300 KB, batas aman <= 400 KB)
  let quality = 0.72;
  let blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  );

  if (!blob) {
    throw new Error('Gagal mengonversi canvas ke JPEG Blob');
  }

  // Jika ukuran lebih dari 400 KB, turunkan kualitas bertahap
  while (blob.size > 400 * 1024 && quality > 0.45) {
    quality -= 0.06;
    blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    );
    if (!blob) break;
  }

  if (!blob) {
    throw new Error('Gagal menghasilkan blob kompresi');
  }

  // 7. Siapkan Data URL & SHA-256
  const arrayBuffer = await blob.arrayBuffer();
  const sha256 = await calculateSHA256(arrayBuffer);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);

  return {
    blob,
    dataUrl,
    bytes: blob.size,
    width: targetWidth,
    height: targetHeight,
    sha256,
  };
}
