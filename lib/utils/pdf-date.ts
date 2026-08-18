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
