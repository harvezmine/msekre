/**
 * Tanggal untuk data contoh, dengan kalender sungguhan. Desain dibuat di kalender 2025 (Senin, 20 Okt; Sabtu, 25 Okt;
 * Rabu, 1 Okt), jadi tahun contoh adalah 2025. Dihitung dalam UTC supaya zona waktu HP tidak menggeser hari.
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
export const MONTH_NAMES = [
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
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "2025-10-20" → { y: 2025, m: 10, d: 20 } */
export function parts(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

/** 0 = Senin ... 6 = Minggu. */
export function weekdayIndex(date: string): number {
  const { y, m, d } = parts(date);
  const sunFirst = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (sunFirst + 6) % 7;
}

/** "Sabtu, 25 Okt" */
export function dayLabel(date: string): string {
  const { m, d } = parts(date);
  return `${DAY_NAMES[weekdayIndex(date)]}, ${d} ${MONTH_SHORT[m - 1]}`;
}

export function addDays(date: string, n: number): string {
  const { y, m, d } = parts(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return isoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Jumlah hari dalam bulan (bulan 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "HH.MM" ditambah menit, melewati tengah malam kembali ke 00.xx. */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split('.').map(Number);
  const total = (((h! * 60 + m! + minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}.${pad(total % 60)}`;
}
