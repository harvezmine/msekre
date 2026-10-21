import { gradients } from '@/theme/tokens';

/**
 * Hitungan gelombang Mode Suara (spesifikasi §5.1), tanpa Skia: dipakai `WavesSkia` di utas UI (fungsi `worklet`) dan
 * diuji langsung di Jest. Semua fungsi murni dan tanpa alokasi, jadi aman dipanggil di setiap frame.
 */

export type WaveState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'off' | 'error';

export interface WaveLayer {
  /** Tinggi dasar puncak, pecahan tinggi kanvas dari atas. */
  base: number;
  /** Simpangan gelombang (pecahan tinggi kanvas) pada level 1. */
  amp: number;
  /** Jumlah lengkungan selebar layar. */
  freq: number;
  /** Laju aliran; tanda menentukan arah. */
  speed: number;
  phase: number;
  /** Gradasi kiri, tengah, kanan. */
  colors: readonly [string, string, string];
  alpha: number;
  /** Sigma blur, dp. */
  blur: number;
  /** Tinggi pita cahaya di bawah puncak, pecahan tinggi kanvas. */
  band: number;
}

const W = gradients.waves;

/** Empat lapis, belakang ke depan (tabel §5.1). */
export const WAVE_LAYERS: readonly WaveLayer[] = [
  {
    base: 0.34,
    amp: 0.2,
    freq: 0.85,
    speed: 0.55,
    phase: 0,
    colors: [W.green, W.teal, W.blue],
    alpha: 0.85,
    blur: 34,
    band: 0.55,
  },
  {
    base: 0.4,
    amp: 0.17,
    freq: 1.3,
    speed: -0.7,
    phase: 1.7,
    colors: [W.blue, W.teal, W.green],
    alpha: 0.75,
    blur: 24,
    band: 0.45,
  },
  {
    base: 0.46,
    amp: 0.14,
    freq: 1.75,
    speed: 0.95,
    phase: 3.1,
    colors: [W.green, W.blue, W.periwinkle],
    alpha: 0.62,
    blur: 14,
    band: 0.35,
  },
  {
    base: 0.52,
    amp: 0.1,
    freq: 2.3,
    speed: -1.25,
    phase: 4.4,
    colors: [W.lime, W.mint, W.blue],
    alpha: 0.55,
    blur: 8,
    band: 0.28,
  },
];

/** Titik per lapis (papan: 56). */
export const WAVE_POINTS = 56;
/** Tinggi kanvas gelombang terhadap tinggi layar (papan: 540 dari 873). */
export const WAVE_HEIGHT_RATIO = 0.62;
/** Peralihan antar keadaan (kecepatan, terang, kilau), ms. */
export const WAVE_CROSSFADE_MS = 300;
/** Lantai level saat mendengar: gelombang tidak pernah rata selagi Inti ditahan. */
export const LISTEN_FLOOR = 0.12;

/** Selubung horizontal: tepi tetap bergerak sedikit, tengah paling tinggi. */
export function waveEnv(u: number): number {
  'worklet';
  return 0.38 + 0.62 * Math.pow(Math.sin(Math.PI * u), 1.3);
}

/**
 * Tinggi garis lapis di titik `u` (0..1 dari kiri), dalam dp dari atas kanvas setinggi `h`. `p` = jam fase (detik yang
 * sudah dikali kecepatan keadaan, jadi pergantian kecepatan tidak melompat), `level` 0..1.
 */
export function waveY(layer: WaveLayer, u: number, p: number, level: number, h: number): number {
  'worklet';
  const env = waveEnv(u);
  const f = layer.freq;
  const sp = layer.speed;
  const w =
    0.62 * Math.sin(2 * Math.PI * f * u + 1.6 * sp * p + layer.phase) +
    0.38 * Math.sin(2 * Math.PI * 1.9 * f * u - 2.1 * sp * p + 2 * layer.phase);
  return h * layer.base - h * layer.amp * level * env * w - 0.1 * h * level * env;
}

/** Pita cahaya lapis: dari sedikit di atas puncak tertinggi sampai `band` di bawahnya. */
export function bandTop(layer: WaveLayer, level: number, h: number): number {
  'worklet';
  return h * (layer.base - layer.amp * level - 0.06);
}

export function bandBottom(layer: WaveLayer, level: number, h: number): number {
  'worklet';
  return Math.min(h, bandTop(layer, level, h) + h * layer.band);
}

/**
 * Selubung bicara tiruan selama balasan diputar (pemutar tidak memberi RMS): kira-kira 3,4 suku kata per detik dengan
 * ayunan kalimat yang pelan. Kisaran 0,22 sampai 0,52.
 */
export function speechEnvelope(t: number): number {
  'worklet';
  const syllable = Math.pow(Math.abs(Math.sin(Math.PI * 3.4 * t + 0.8 * Math.sin(2 * Math.PI * 0.6 * t))), 1.5);
  const phrase = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.23 * t + 1.1));
  return 0.22 + 0.3 * syllable * phrase;
}

/** Level yang dituju per keadaan; `mic` = level mikrofon (sudah lewat `levelFromRms`). */
export function targetLevel(state: WaveState, t: number, mic: number, muted: boolean): number {
  'worklet';
  switch (state) {
    case 'listening':
      return Math.max(LISTEN_FLOOR, Math.min(1, mic));
    case 'thinking':
      return 0.14 + 0.04 * Math.sin(1.3 * t);
    case 'speaking':
      return speechEnvelope(t);
    case 'idle':
      return muted ? 0.08 : 0.1 + 0.03 * Math.sin((2 * Math.PI * t) / 4.2);
    default:
      return 0.06;
  }
}

/** Kecepatan aliran per keadaan (1 = mendengar). Mati/kendala: berhenti pelan-pelan. */
export function goalSpeed(state: WaveState, muted: boolean): number {
  'worklet';
  switch (state) {
    case 'listening':
      return 1;
    case 'thinking':
      return 0.45;
    case 'speaking':
      return 0.8;
    case 'idle':
      return muted ? 0.3 : 0.35;
    default:
      return 0;
  }
}

/** Terang keseluruhan per keadaan; `quiet` (kartu konfirmasi atau kolom ketik tampil) meredupkan separuh. */
export function goalAlpha(state: WaveState, muted: boolean, quiet: boolean): number {
  'worklet';
  let a: number;
  switch (state) {
    case 'listening':
    case 'speaking':
      a = 1;
      break;
    case 'thinking':
      a = 0.7;
      break;
    case 'idle':
      a = muted ? 0.5 : 0.75;
      break;
    default:
      a = 0.35;
  }
  return quiet ? a * 0.5 : a;
}

/** Kilau yang menyapu pelan hanya saat berpikir. */
export function goalShimmer(state: WaveState): number {
  'worklet';
  return state === 'thinking' ? 1 : 0;
}

/**
 * Level halus per frame (§5.1): naik cepat (0,35 per frame 60 fps, kira-kira 40 ms), turun pelan (0,10, kira-kira 160
 * ms). Tidak bergantung laju frame: `dt` dalam detik.
 */
export function smoothLevel(current: number, target: number, dt: number): number {
  'worklet';
  const rate = target > current ? 0.35 : 0.1;
  const k = 1 - Math.pow(1 - rate, Math.max(0, dt) * 60);
  return current + (target - current) * k;
}

/** Mendekati nilai tujuan dengan peluruhan eksponensial: sekitar 95% dalam `ms` (bawaan 300 ms). */
export function approach(current: number, target: number, dt: number, ms = WAVE_CROSSFADE_MS): number {
  'worklet';
  const k = 1 - Math.exp((-3 * Math.max(0, dt) * 1000) / ms);
  return current + (target - current) * k;
}

/** Bingkai diam ("kurangi gerakan"): jam fase tetap (papan: 1,2) dan level khas tiap keadaan. */
export const STILL_PHASE = 1.2;
export function stillLevel(state: WaveState): number {
  'worklet';
  switch (state) {
    case 'listening':
      return 0.5;
    case 'speaking':
      return 0.4;
    case 'thinking':
      return 0.14;
    case 'idle':
      return 0.12;
    default:
      return 0.06;
  }
}

/** Posisi kilau berpikir (pecahan lebar), menyapu dari kiri ke kanan tiap 6,4 detik. */
export function shimmerX(t: number): number {
  'worklet';
  return ((t * 0.22) % 1.4) - 0.2;
}
