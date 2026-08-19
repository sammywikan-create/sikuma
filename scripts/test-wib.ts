import {
  getWIBDateParts,
  getWIBDateString,
  getWIBDayBoundsUtc,
  isSameWIBDay,
  formatWIB,
} from '../lib/utils/time';
import { formatIndonesianFullDateTime, formatIndonesianDate } from '../lib/utils/pdf-date';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    if (detail) console.error(`    Detail: ${detail}`);
    failed++;
  }
}

console.log('=== UJI BATAS WAKTU & ZONA WIB (ASIA/JAKARTA) ===\n');

// 1. Kasus Batas: 23:30 WIB (19 Agustus 2026 23:30:00 WIB = 2026-08-19T16:30:00.000Z)
const date2330WIB = new Date('2026-08-19T16:30:00.000Z');
const parts2330 = getWIBDateParts(date2330WIB);
assert(
  parts2330.year === '2026' &&
    parts2330.month === '08' &&
    parts2330.day === '19' &&
    parts2330.hour === '23' &&
    parts2330.minute === '30',
  'getWIBDateParts pada 23:30 WIB (16:30 UTC)',
  JSON.stringify(parts2330)
);
assert(
  getWIBDateString(date2330WIB) === '2026-08-19',
  'getWIBDateString pada 23:30 WIB',
  getWIBDateString(date2330WIB)
);

// 2. Kasus Batas: 00:30 WIB (20 Agustus 2026 00:30:00 WIB = 2026-08-19T17:30:00.000Z)
const date0030WIB = new Date('2026-08-19T17:30:00.000Z');
const parts0030 = getWIBDateParts(date0030WIB);
assert(
  parts0030.year === '2026' &&
    parts0030.month === '08' &&
    parts0030.day === '20' &&
    parts0030.hour === '00' &&
    parts0030.minute === '30',
  'getWIBDateParts pada 00:30 WIB (17:30 UTC hari sebelumnya di UTC, tetapi hari baru di WIB)',
  JSON.stringify(parts0030)
);
assert(
  getWIBDateString(date0030WIB) === '2026-08-20',
  'getWIBDateString pada 00:30 WIB harus 2026-08-20',
  getWIBDateString(date0030WIB)
);

// 3. Kasus Batas: 06:59 WIB (20 Agustus 2026 06:59:00 WIB = 2026-08-19T23:59:00.000Z)
const date0659WIB = new Date('2026-08-19T23:59:00.000Z');
const parts0659 = getWIBDateParts(date0659WIB);
assert(
  parts0659.year === '2026' &&
    parts0659.month === '08' &&
    parts0659.day === '20' &&
    parts0659.hour === '06' &&
    parts0659.minute === '59',
  'getWIBDateParts pada 06:59 WIB (23:59 UTC hari kemarin di UTC)',
  JSON.stringify(parts0659)
);
assert(
  getWIBDateString(date0659WIB) === '2026-08-20',
  'getWIBDateString pada 06:59 WIB harus 2026-08-20',
  getWIBDateString(date0659WIB)
);

// 4. Kasus Batas: 07:01 WIB (20 Agustus 2026 07:01:00 WIB = 2026-08-20T00:01:00.000Z)
const date0701WIB = new Date('2026-08-20T00:01:00.000Z');
const parts0701 = getWIBDateParts(date0701WIB);
assert(
  parts0701.year === '2026' &&
    parts0701.month === '08' &&
    parts0701.day === '20' &&
    parts0701.hour === '07' &&
    parts0701.minute === '01',
  'getWIBDateParts pada 07:01 WIB (00:01 UTC)',
  JSON.stringify(parts0701)
);
assert(
  getWIBDateString(date0701WIB) === '2026-08-20',
  'getWIBDateString pada 07:01 WIB harus 2026-08-20',
  getWIBDateString(date0701WIB)
);

// 5. Uji isSameWIBDay
assert(
  !isSameWIBDay(date2330WIB, date0030WIB),
  'isSameWIBDay(23:30 WIB tgl 19, 00:30 WIB tgl 20) harus false',
  `${getWIBDateString(date2330WIB)} vs ${getWIBDateString(date0030WIB)}`
);
assert(
  isSameWIBDay(date0030WIB, date0659WIB),
  'isSameWIBDay(00:30 WIB tgl 20, 06:59 WIB tgl 20) harus true',
  `${getWIBDateString(date0030WIB)} vs ${getWIBDateString(date0659WIB)}`
);
assert(
  isSameWIBDay(date0659WIB, date0701WIB),
  'isSameWIBDay(06:59 WIB tgl 20, 07:01 WIB tgl 20) harus true',
  `${getWIBDateString(date0659WIB)} vs ${getWIBDateString(date0701WIB)}`
);

// 6. Uji getWIBDayBoundsUtc
const bounds = getWIBDayBoundsUtc('2026-08-20');
assert(
  bounds.startUtc.toISOString() === '2026-08-19T17:00:00.000Z',
  'Batas awal 2026-08-20 WIB harus 2026-08-19T17:00:00.000Z',
  bounds.startUtc.toISOString()
);
assert(
  bounds.endUtc.toISOString() === '2026-08-20T16:59:59.999Z',
  'Batas akhir 2026-08-20 WIB harus 2026-08-20T16:59:59.999Z',
  bounds.endUtc.toISOString()
);
const durationMs = bounds.endUtc.getTime() - bounds.startUtc.getTime() + 1;
assert(
  durationMs === 24 * 60 * 60 * 1000,
  'Durasi batas hari kalender WIB tepat 24 jam (86.400.000 ms)',
  `${durationMs} ms`
);

// 7. Uji formatWIB & PDF date formatting
const formattedWIB = formatWIB(date2330WIB);
assert(
  formattedWIB === '19/08/2026 23:30 WIB',
  'formatWIB menghasilkan "19/08/2026 23:30 WIB"',
  formattedWIB
);

const fullIndoDateTime = formatIndonesianFullDateTime(date0030WIB);
assert(
  fullIndoDateTime.includes('20 Agustus 2026 00:30 WIB'),
  'formatIndonesianFullDateTime pada 00:30 WIB',
  fullIndoDateTime
);

const indoDate = formatIndonesianDate(date0659WIB);
assert(
  indoDate === '20 Agustus 2026',
  'formatIndonesianDate pada 06:59 WIB harus "20 Agustus 2026"',
  indoDate
);

console.log(`\n========================================`);
console.log(`Hasil Uji: ${passed} Passed, ${failed} Failed`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('Semua uji batas waktu WIB berhasil 100%!');
}
