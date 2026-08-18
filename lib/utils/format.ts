/**
 * Format angka ke format Rupiah standar (contoh: Rp 50.000.000)
 */
export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'Rp 0';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format string input ribuan otomatis (contoh: "50000000" -> "50.000.000")
 */
export function formatThousandSeparator(value: string): string {
  const cleanNumber = value.replace(/\D/g, '');
  if (!cleanNumber) return '';
  return new Intl.NumberFormat('id-ID').format(parseInt(cleanNumber, 10));
}

/**
 * Mengonversi string berpemisah ribuan kembali ke number murni
 */
export function parseThousandSeparator(formattedStr: string): number | null {
  const cleanNumber = formattedStr.replace(/\D/g, '');
  if (!cleanNumber) return null;
  const num = parseInt(cleanNumber, 10);
  return isNaN(num) ? null : num;
}
