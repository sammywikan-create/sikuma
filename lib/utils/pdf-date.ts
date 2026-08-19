import { getWIBDateParts } from './time';

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

const dayFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
});

/**
 * Format waktu lengkap hari dan tanggal standar WIB: "Senin, 18 Agustus 2026 14:30 WIB"
 */
export function formatIndonesianFullDateTime(dateInput: string | Date | number): string {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';

  const dayName = dayFormatter.format(d);
  const { day, month, year, hour, minute } = getWIBDateParts(d);
  const monthIdx = parseInt(month, 10) - 1;
  const monthName = MONTH_NAMES_ID[monthIdx] || month;
  const dayNum = parseInt(day, 10);

  return `${dayName}, ${dayNum} ${monthName} ${year} ${hour}:${minute} WIB`;
}

/**
 * Format tanggal Indonesia baku standar WIB: "1 Agustus 2026"
 */
export function formatIndonesianDate(dateInput: string | Date | number): string {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';

  const { day, month, year } = getWIBDateParts(d);
  const monthIdx = parseInt(month, 10) - 1;
  const monthName = MONTH_NAMES_ID[monthIdx] || month;
  const dayNum = parseInt(day, 10);

  return `${dayNum} ${monthName} ${year}`;
}

/**
 * Format rentang tanggal Indonesia: "1 Agustus 2026 – 31 Agustus 2026"
 */
export function formatIndonesianDateRange(startStr: string, endStr: string): string {
  const start = formatIndonesianDate(startStr);
  const end = formatIndonesianDate(endStr);
  return `${start} – ${end}`;
}
