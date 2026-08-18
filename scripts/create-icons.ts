import * as fs from 'fs';
import * as path from 'path';

// Buat SVG logo Bank BKK
const svgIcon = (size: number) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#092C4C"/>
  <rect x="${size * 0.08}" y="${size * 0.08}" width="${size * 0.84}" height="${size * 0.84}" rx="${size * 0.16}" fill="#0c3860" stroke="#0ea5e9" stroke-width="${size * 0.02}"/>
  <!-- Bank Building / Shield Icon -->
  <path d="M ${size * 0.5} ${size * 0.22} L ${size * 0.25} ${size * 0.38} L ${size * 0.75} ${size * 0.38} Z" fill="#38bdf8"/>
  <rect x="${size * 0.28}" y="${size * 0.42}" width="${size * 0.08}" height="${size * 0.24}" rx="${size * 0.02}" fill="#ffffff"/>
  <rect x="${size * 0.46}" y="${size * 0.42}" width="${size * 0.08}" height="${size * 0.24}" rx="${size * 0.02}" fill="#ffffff"/>
  <rect x="${size * 0.64}" y="${size * 0.42}" width="${size * 0.08}" height="${size * 0.24}" rx="${size * 0.02}" fill="#ffffff"/>
  <rect x="${size * 0.22}" y="${size * 0.68}" width="${size * 0.56}" height="${size * 0.06}" rx="${size * 0.02}" fill="#38bdf8"/>
  <text x="${size * 0.5}" y="${size * 0.86}" font-family="Arial, sans-serif" font-weight="900" font-size="${size * 0.11}" fill="#ffffff" text-anchor="middle" letter-spacing="${size * 0.01}">SIKUMA</text>
</svg>
`;

const iconsDir = path.resolve(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Simpan SVG
fs.writeFileSync(path.join(iconsDir, 'icon-192.svg'), svgIcon(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.svg'), svgIcon(512));

// Gunakan base64 PNG dummy / 1x1 PNG or write simple PNG header
// Untuk kompatibilitas Next.js / PWA, buat PNG valid
const createSimplePng = (filePath: string) => {
  // 1x1 transparent/blue PNG buffer
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAE4wH/xRj+fAAAAABJRU5ErkJggg==';
  fs.writeFileSync(filePath, Buffer.from(pngBase64, 'base64'));
};

createSimplePng(path.join(iconsDir, 'icon-192.png'));
createSimplePng(path.join(iconsDir, 'icon-512.png'));

console.log('✅ Ikon PWA (SVG & PNG) berhasil dibuat di public/icons/');
