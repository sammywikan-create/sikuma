const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const DAY_NAMES_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

/**
 * Format waktu lengkap hari dan tanggal: Senin, 18 Agustus 2026 14:30 WIB
 */
export function formatIndonesianFullDateTime(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const dayName = DAY_NAMES_ID[d.getDay()];
  const day = d.getDate();
  const month = MONTH_NAMES_ID[d.getMonth()];
  const year = d.getFullYear();
  const hours = (d.getUTCHours() + 7) % 24;
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes}`;
  return `${dayName}, ${day} ${month} ${year} ${timeStr} WIB`;
}

/**
 * Format tanggal Indonesia baku: 1 Agustus 2026
 */
export function formatIndonesianDate(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const day = d.getDate();
  const month = MONTH_NAMES_ID[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format rentang tanggal Indonesia: 1 Agustus 2026 - 31 Agustus 2026
 */
export function formatIndonesianDateRange(startStr: string, endStr: string): string {
  const start = formatIndonesianDate(startStr);
  const end = formatIndonesianDate(endStr);
  return `${start} – ${end}`;
}

