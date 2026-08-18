/**
 * Format tanggal dan jam ke format standar WIB (Asia/Jakarta)
 * Contoh: 18/08/2026 20:14 WIB
 */
export function formatWIB(dateInput: Date | string | number = new Date()): string {
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;

  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const day = getPart('day');
  const month = getPart('month');
  const year = getPart('year');
  const hour = getPart('hour');
  const minute = getPart('minute');

  return `${day}/${month}/${year} ${hour}:${minute} WIB`;
}

/**
 * Format string waktu ISO saat ini
 */
export function getCurrentISOString(): string {
  return new Date().toISOString();
}
