/**
 * Tanggal untuk data contoh. Kalender contoh memakai hari seperti desain: Senin, 20 Okt, jadi 25 Okt = Sabtu
 * dan 1 Okt = Rabu (susunan hari tahun 2025, bukan kalender sungguhan 2026). Dihitung dari tanggal saja.
 */
export const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;
export const DAY_SHORT = ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'] as const;
export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parts(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

/** 0 = Senin ... 6 = Minggu. */
export function weekdayIndex(date: string): number {
  const { m, d } = parts(date);
  const sunFirst = new Date(Date.UTC(2025, m - 1, d)).getUTCDay();
  return (sunFirst + 6) % 7;
}

/** "Sabtu, 25 Okt" */
export function dayLabel(date: string): string {
  const { m, d } = parts(date);
  return `${DAY_NAMES[weekdayIndex(date)]}, ${d} ${MONTH_SHORT[m - 1]}`;
}

export function addDays(date: string, n: number): string {
  const { y, m, d } = parts(date);
  const t = new Date(Date.UTC(2025, m - 1, d + n));
  return isoDate(y, t.getUTCMonth() + 1, t.getUTCDate());
}

/** Jumlah hari dalam bulan (bulan 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(2025, month, 0)).getUTCDate();
}

/** "HH.MM" ditambah menit, melewati tengah malam kembali ke 00.xx. */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split('.').map(Number);
  const total = (((h! * 60 + m! + minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}.${pad(total % 60)}`;
}
