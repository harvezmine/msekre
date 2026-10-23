import { clampTo, finiteOr, speechEnvelope } from './waveMath';

/**
 * Gelombang melingkar di sekitar Inti besar Beranda saat bicara di tempat (`RadialWaves`), dihitung di utas UI tiap
 * frame. Aturan sama dengan `waveMath.ts` dan `webMath.ts` (diperiksa __tests__/worklet-ui.test.tsx): setiap fungsi
 * `'worklet'`, tanpa nilai bawaan parameter, hanya memanggil worklet lain, dan semua masukan dijaga dari NaN dan tak
 * hingga (kesalahan worklet di utas UI menutup paksa build rilis).
 *
 * Mode (angka, supaya murah dibaca di utas UI): 0 tersembunyi, 1 mendengar, 2 berpikir, 3 menjawab, 4 tenang (balasan
 * sudah tampil).
 */

export const RADIAL_HIDDEN = 0;
export const RADIAL_LISTENING = 1;
export const RADIAL_THINKING = 2;
export const RADIAL_SPEAKING = 3;
export const RADIAL_REST = 4;

/** Putaran jam (detik); semua gerak periodik di sini membaginya. */
export const RADIAL_LOOP = 240;
/** Empat cincin yang berangkat dari tepi Inti, bergeser seperempat periode (seperti sinyal radio). */
export const RING_COUNT = 4;
/** Satu cincin dari tepi Inti sampai hilang, detik (saat mendengar; mode lain lebih pelan). */
export const RING_PERIOD = 2.4;

/** Level yang dituju: mikrofon saat mendengar (lantai 0,1), napas kecil saat berpikir, selubung bicara saat menjawab. */
export function radialTarget(mode: number, t: number, mic: number): number {
  'worklet';
  const time = finiteOr(t, 0);
  if (mode === 1) return clampTo(Math.max(0.1, finiteOr(mic, 0)), 0, 1);
  if (mode === 2) return 0.1 + 0.04 * Math.sin(1.3 * time);
  if (mode === 3) return 0.8 * speechEnvelope(time);
  return 0;
}

/** Seberapa terlihat cincin per mode. */
export function goalPresence(mode: number): number {
  'worklet';
  if (mode === 1) return 1;
  if (mode === 2) return 0.6;
  if (mode === 3) return 0.75;
  if (mode === 4) return 0.2;
  return 0;
}

/** Seberapa jauh cincin menyebar: mendengar jauh, berpikir memeluk Inti. */
export function goalSpread(mode: number): number {
  'worklet';
  if (mode === 1) return 1;
  if (mode === 2) return 0.1;
  if (mode === 3) return 0.6;
  return 0.25;
}

/** Laju cincin (1 = mendengar). */
export function goalPace(mode: number): number {
  'worklet';
  if (mode === 1) return 1;
  if (mode === 2) return 0.45;
  if (mode === 3) return 0.75;
  return 0.3;
}

/** Bagian pecahan, selalu 0..1 (NaN = 0). */
export function wrapUnit(v: number): number {
  'worklet';
  const x = finiteOr(v, 0);
  const f = x - Math.floor(x);
  return f >= 0 && f < 1 ? f : 0;
}

/** Fase jam cincin berikutnya: maju `dt × laju / periode`, berputar di 0..1. */
export function advancePhase(p: number, dt: number, pace: number): number {
  'worklet';
  return wrapUnit(
    finiteOr(p, 0) + (clampTo(finiteOr(dt, 0), 0, 0.05) * clampTo(finiteOr(pace, 0), 0, 2)) / RING_PERIOD,
  );
}

/** Kemajuan cincin ke-`i` (0 di tepi Inti, 1 paling jauh). */
export function ringPhase(p: number, i: number, count: number): number {
  'worklet';
  const n = count > 0 ? count : 1;
  return wrapUnit(finiteOr(p, 0) + finiteOr(i, 0) / n);
}

/**
 * Skala cincin (1 = garis tengah Inti): berangkat dari tepi Inti dan melambat ke luar (ease-out, seperti riak), jangkauan
 * ikut sebaran dan level.
 */
export function ringScale(u: number, spread: number, lvl: number): number {
  'worklet';
  const k = clampTo(finiteOr(u, 0), 0, 1);
  const s = clampTo(finiteOr(spread, 0), 0, 1);
  const l = clampTo(finiteOr(lvl, 0), 0, 1);
  const eased = 1 - (1 - k) * (1 - k);
  return 1.04 + eased * (0.45 + 0.6 * s + 0.35 * s * l);
}

/** Terang cincin: muncul halus di tepi Inti, memudar pelan ke luar; ikut level dan keberadaan; meredup saat digeser batal. */
export function ringAlpha(u: number, lvl: number, presence: number, cancel: number): number {
  'worklet';
  const k = clampTo(finiteOr(u, 0), 0, 1);
  const rise = clampTo(k / 0.1, 0, 1);
  const fade = Math.pow(1 - k, 1.6);
  const base = 0.35 + 0.55 * clampTo(finiteOr(lvl, 0), 0, 1);
  const a = rise * fade * base * clampTo(finiteOr(presence, 0), 0, 1) * (1 - 0.75 * clampTo(finiteOr(cancel, 0), 0, 1));
  return clampTo(a, 0, 1);
}

/** "Kurangi gerakan": satu cincin diam, terangnya per mode. */
export function stillRingAlpha(mode: number): number {
  'worklet';
  return 0.45 * goalPresence(mode);
}
