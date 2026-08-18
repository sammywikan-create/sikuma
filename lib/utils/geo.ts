/**
 * Menghitung jarak antara dua koordinat GPS menggunakan formula Haversine (dalam meter)
 */
export function calculateHaversineDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Radius bumi dalam meter
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Hasil dalam meter
}

/**
 * Menghitung kecepatan tempuh rata-rata dalam km/jam
 */
export function calculateSpeedKmH(
  distanceM: number,
  timeDiffSeconds: number
): number {
  if (timeDiffSeconds <= 0) return 0;
  const distanceKm = distanceM / 1000;
  const timeHours = timeDiffSeconds / 3600;
  return distanceKm / timeHours;
}
