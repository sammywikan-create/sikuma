/**
 * Membuat slug teks yang aman untuk penamaan berkas & folder
 * Contoh: "Budi Santoso, S.E." -> "budi_santoso"
 */
export function createSafeSlug(text: string): string {
  if (!text) return 'anonim';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Hapus karakter non-alphanumeric selain spasi & strip
    .replace(/[\s_-]+/g, '_') // Ubah spasi & strip menjadi garis bawah (_)
    .replace(/^_|_$/g, '') || 'anonim';
}
