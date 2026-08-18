import { NextResponse } from 'next/server';

interface CacheEntry {
  address: string;
  timestamp: number;
}

// In-memory cache sederhana dengan TTL 10 menit
const geocodeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  if (!latStr || !lngStr) {
    return NextResponse.json({ address: '' });
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ address: '' });
  }

  // Key cache dibulatkan ke 4 desimal (~11 meter)
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const now = Date.now();
  const cached = geocodeCache.get(cacheKey);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ address: cached.address });
  }

  // Khusus mode koordinat simulasi default (-7.005, 110.438 -> Semarang)
  if (Math.abs(lat - (-7.005)) < 0.001 && Math.abs(lng - 110.438) < 0.001) {
    const defaultAddress = 'Jl. Pemuda No. 142, Sekayu, Kec. Semarang Tengah, Kota Semarang';
    geocodeCache.set(cacheKey, { address: defaultAddress, timestamp: now });
    return NextResponse.json({ address: defaultAddress });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SIKUMA-BankBKK/1.0 (internal-marketing@bkk.co.id)',
        'Accept-Language': 'id,en;q=0.8',
      },
      signal: AbortSignal.timeout(5000), // Timeout 5 detik
    });

    if (!response.ok) {
      return NextResponse.json({ address: '' });
    }

    const data = await response.json();
    const addressDetails = data.address || {};
    
    // Susun alamat yang ringkas dan padat untuk baris watermark
    const road = addressDetails.road || addressDetails.pedestrian || addressDetails.street || '';
    const village = addressDetails.village || addressDetails.suburb || addressDetails.neighbourhood || '';
    const city = addressDetails.city || addressDetails.town || addressDetails.county || addressDetails.municipality || '';
    const province = addressDetails.state || '';

    const parts = [road, village, city, province].filter(Boolean);
    const formattedAddress = parts.length > 0 ? parts.join(', ') : data.display_name || '';

    // Simpan ke cache
    geocodeCache.set(cacheKey, { address: formattedAddress, timestamp: now });

    return NextResponse.json({ address: formattedAddress });
  } catch {
    // Tangani kegagalan jaringan secara anggun (graceful fallback)
    return NextResponse.json({ address: '' });
  }
}
