/**
 * Modul Utilitas Waktu Berstandar WIB (Asia/Jakarta)
 * Seluruh fungsi WAJIB berbasis Intl.DateTimeFormat dengan timeZone "Asia/Jakarta".
 * DILARANG memakai aritmetika manual seperti (getUTCHours() + 7).
 */

export interface WIBDateParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

const wibPartsFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function parseToDate(dateInput: Date | string | number): Date {
  if (dateInput instanceof Date) return dateInput;
  return new Date(dateInput);
}

/**
 * Mengembalikan komponen tanggal dan waktu WIB sebagai string 2-digit (tahun 4-digit).
 * { year: '2026', month: '08', day: '19', hour: '14', minute: '30', second: '05' }
 */
export function getWIBDateParts(dateInput: Date | string | number = new Date()): WIBDateParts {
  const date = parseToDate(dateInput);
  if (isNaN(date.getTime())) {
    return { year: '1970', month: '01', day: '01', hour: '00', minute: '00', second: '00' };
  }

  const parts = wibPartsFormatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
  };
}

/**
 * Mengembalikan tanggal kalender WIB dalam format standar "YYYY-MM-DD".
 * Contoh: "2026-08-19"
 */
export function getWIBDateString(dateInput: Date | string | number = new Date()): string {
  const { year, month, day } = getWIBDateParts(dateInput);
  return `${year}-${month}-${day}`;
}

/**
 * Mengembalikan batas awal (00:00:00.000 WIB) dan akhir (23:59:59.999 WIB)
 * dari hari kalender WIB dalam bentuk Date UTC untuk filter query SQL (gte/lte).
 */
export function getWIBDayBoundsUtc(dateInput: Date | string | number = new Date()): {
  startUtc: Date;
  endUtc: Date;
} {
  const { year, month, day } = getWIBDateParts(dateInput);
  const startUtc = new Date(`${year}-${month}-${day}T00:00:00.000+07:00`);
  const endUtc = new Date(`${year}-${month}-${day}T23:59:59.999+07:00`);

  return { startUtc, endUtc };
}

/**
 * Memeriksa apakah dua timestamp jatuh pada hari kalender WIB yang sama.
 */
export function isSameWIBDay(
  dateA: Date | string | number,
  dateB: Date | string | number
): boolean {
  return getWIBDateString(dateA) === getWIBDateString(dateB);
}

/**
 * Format tanggal dan jam ke format standar label UI: "18/08/2026 20:14 WIB"
 */
export function formatWIB(dateInput: Date | string | number = new Date()): string {
  const { day, month, year, hour, minute } = getWIBDateParts(dateInput);
  return `${day}/${month}/${year} ${hour}:${minute} WIB`;
}

/**
 * Format string waktu ISO saat ini
 */
export function getCurrentISOString(): string {
  return new Date().toISOString();
}
