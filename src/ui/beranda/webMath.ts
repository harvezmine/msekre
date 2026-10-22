import { clampTo, finiteOr } from '@/voice/waveMath';

/**
 * Gerak jaring Inti di Beranda, dihitung di utas UI tiap frame (fungsi `worklet`, diuji di __tests__/worklet-ui.test.tsx).
 *
 * Satu jam (`clock`, detik) memutar semuanya. Semua periode membagi {@link WEB_LOOP}, jadi saat jam berputar ulang
 * tidak ada yang melompat. Aturan yang sama dengan `src/voice/waveMath.ts`: setiap fungsi `'worklet'`, tanpa nilai
 * bawaan parameter, hanya memanggil worklet lain, dan semua masukan dijaga (NaN, tak hingga, indeks di luar larik).
 */

/** Satu putaran jam (detik). */
export const WEB_LOOP = 240;

/** Periode melayang simpul (detik), semuanya membagi {@link WEB_LOOP}. */
export const DRIFT_PERIODS = [8, 10, 12, 15, 16, 20, 24] as const;

/**
 * Dua jalur titik cahaya. Jalur 0: dari Inti ke simpul tiap 5 detik, lalu simpulnya berdenyut sekali. Jalur 1: balasan
 * kecil dari simpul ke Inti tiap 8 detik, mulai 2,5 detik kemudian. Kadang satu, sesekali dua, tidak pernah lebih.
 */
export const PULSE_LANES = [
  { every: 5, offset: 0, travel: 1.6, outward: true },
  { every: 8, offset: 2.5, travel: 1.9, outward: false },
] as const;

/** Lama denyut simpul setelah titik cahaya tiba (detik). */
export const PING_S = 1.1;

/** Jam berikutnya: maju `ms` (lama frame) dalam detik, paling banyak 50 ms per frame, berputar di `loop`. */
export function advanceClock(t: number, ms: number | null | undefined, loop: number): number {
  'worklet';
  const v = ms === null || ms === undefined ? 16 : ms;
  const dt = clampTo(finiteOr(v, 0) / 1000, 0, 0.05);
  const next = finiteOr(t, 0) + dt;
  const L = finiteOr(loop, 0);
  if (!(L > 0)) return next;
  return next >= L ? next % L : next;
}

/** Simpangan melayang (dp) simpul `i` pada sumbu x (`axis` 0) atau y (`axis` 1): gelombang sinus pelan per simpul. */
export function drift(t: number, i: number, axis: number, amp: number): number {
  'worklet';
  const n = DRIFT_PERIODS.length;
  const k = Math.abs(Math.floor(finiteOr(i, 0)));
  const period = DRIFT_PERIODS[(k + (axis === 1 ? 3 : 0)) % n] ?? 12;
  const phase = axis === 1 ? k * 2.3 + 1 : k * 1.7;
  const v = finiteOr(amp, 0) * Math.sin((2 * Math.PI * finiteOr(t, 0)) / period + phase);
  return finiteOr(v, 0);
}

/** Lengkung pelan di awal dan akhir (cubic in-out), 0..1. */
export function easeInOut(u: number): number {
  'worklet';
  const x = clampTo(finiteOr(u, 0), 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Urutan titik cahaya ke-`k` di jalur dengan periode `every` dan geser `offset`: -1 bila belum mulai. */
export function pulseIndex(t: number, every: number, offset: number): number {
  'worklet';
  const e = finiteOr(every, 0);
  if (!(e > 0)) return -1;
  const local = finiteOr(t, 0) - finiteOr(offset, 0);
  if (local < 0) return -1;
  return Math.floor(local / e);
}

/** Detik sejak titik cahaya terakhir di jalur itu berangkat (0..every), atau -1 bila belum mulai. */
export function pulseAge(t: number, every: number, offset: number): number {
  'worklet';
  const k = pulseIndex(t, every, offset);
  if (k < 0) return -1;
  return finiteOr(t, 0) - finiteOr(offset, 0) - k * every;
}

/** Terang titik cahaya pada kemajuan `u` (0..1): muncul cepat, memudar sebelum tiba di ubin. */
export function pulseAlpha(u: number): number {
  'worklet';
  const x = finiteOr(u, -1);
  if (x < 0 || x > 1) return 0;
  return clampTo(Math.min(x / 0.15, (1 - x) / 0.28), 0, 1);
}

/** Simpul tujuan: `order[k mod panjang]` (urutan dibalik untuk jalur balasan), atau -1. */
export function pulseTarget(order: readonly number[], k: number, reverse: boolean): number {
  'worklet';
  const n = order.length;
  if (n === 0 || k < 0) return -1;
  const j = Math.floor(finiteOr(k, 0)) % n;
  const v = order[reverse ? n - 1 - j : j];
  return typeof v === 'number' && Number.isFinite(v) ? v : -1;
}

/** Nilai ke-`i` dari larik angka, atau `fallback` bila di luar larik atau bukan angka terhingga. */
export function at(values: readonly number[], i: number, fallback: number): number {
  'worklet';
  if (!(i >= 0) || i >= values.length) return fallback;
  return finiteOr(values[Math.floor(i)] as number, fallback);
}
