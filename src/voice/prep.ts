import { toBase64 } from './pcm';

/**
 * Ucapan disiapkan di HP sebelum dikirim (JavaScript biasa, bukan worklet; dijalankan sekali saat Inti dilepas):
 *
 * 1. Mono 16 kHz PCM16 (kontrak `voiceFormatSchema`). Mikrofon diminta 16 kHz, tetapi HP boleh memberi laju lain:
 *    turun laju memakai rata-rata per jendela (penyaring lolos-rendah sederhana, supaya desis di atas 8 kHz tidak terlipat
 *    ke suara bicara), naik laju memakai interpolasi linear. Dicuplik sekali untuk seluruh ucapan, jadi tidak ada sambungan
 *    di batas potongan.
 * 2. Hening di awal dan akhir dipangkas (dengan sisa 240 ms sebelum dan 360 ms sesudah suara), karena mesin pengenal ucapan
 *    sering "mendengar" kalimat karangan di hening panjang.
 * 3. Kerasnya disamakan: suara pelan (HP jauh dari mulut) dinaikkan sampai sekitar -20 dBFS, paling banyak 6 kali, dan
 *    tidak pernah sampai terpotong. Suara yang sudah keras tidak dikecilkan.
 * 4. Tanpa suara sama sekali (semua bingkai di bawah -55 dBFS, atau kurang dari 80 ms suara): `null`, tidak dikirim.
 *
 * Hasilnya dipotong 200 ms per pesan `audio` (base64).
 */

export const VOICE_RATE = 16000;
/** Bingkai analisis: 20 ms di 16 kHz. */
const FRAME = 320;
const FRAME_MS = 20;
/** Potongan per pesan `audio`: 200 ms (§5a: sekitar 50 sampai 200 ms). */
export const SEND_CHUNK_SAMPLES = 3200;
export const PRE_ROLL_MS = 240;
export const POST_ROLL_MS = 360;
/** Di bawah ini di semua bingkai: tidak ada suara yang bisa dikenali. */
export const SILENT_DBFS = -55;
/** Ambang suara paling rendah. */
const FLOOR_DBFS = -52;
/** Paling sedikit sekian bingkai bersuara (80 ms) supaya dihitung ucapan, bukan ketukan atau desah. */
const MIN_VOICED_FRAMES = 4;
/** Tingkat derau = persentil ke-15 kerasnya bingkai; suara = dua kali derau (+6 dB). */
const NOISE_PERCENTILE = 0.15;
const ABOVE_NOISE = 2;
/** Ambang tidak pernah lebih tinggi dari seperempat bingkai terkeras (ucapan tanpa hening sama sekali tetap utuh). */
const OF_LOUDEST = 0.25;
export const TARGET_DBFS = -20;
export const MAX_GAIN = 6;
const PEAK_LIMIT = 0.95 * 32767;

const fromDb = (db: number) => Math.pow(10, db / 20);

/** Saluran pertama dari PCM16 berselang-seling, sebagai salinan. */
export function firstChannel(data: ArrayBuffer, channels: number): Int16Array {
  const all = new Int16Array(data, 0, Math.floor(data.byteLength / 2));
  const step = Math.max(1, Math.floor(channels) || 1);
  if (step === 1) return all.slice();
  const out = new Int16Array(Math.floor(all.length / step));
  for (let i = 0; i < out.length; i++) out[i] = all[i * step]!;
  return out;
}

export function concatPcm(parts: readonly Int16Array[]): Int16Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Int16Array(n);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Mono berlaju `from` menjadi berlaju `to`. Laju tidak dikenal (0, NaN) atau sama: apa adanya. */
export function resample(mono: Int16Array, from: number, to: number): Int16Array {
  if (!(from > 0) || !(to > 0) || from === to || mono.length === 0) return mono;
  const ratio = from / to;
  const length = Math.floor(mono.length / ratio);
  const out = new Int16Array(length);
  if (ratio > 1) {
    // Turun laju: rata-rata contoh di jendela [i·r, (i+1)·r).
    for (let i = 0; i < length; i++) {
      const start = Math.floor(i * ratio);
      const stop = Math.max(start + 1, Math.min(mono.length, Math.floor((i + 1) * ratio)));
      let sum = 0;
      for (let k = start; k < stop; k++) sum += mono[k]!;
      out[i] = Math.round(sum / (stop - start));
    }
    return out;
  }
  // Naik laju: interpolasi linear.
  for (let i = 0; i < length; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const s0 = mono[i0] ?? 0;
    const s1 = mono[Math.min(i0 + 1, mono.length - 1)] ?? s0;
    out[i] = Math.round(s0 + (s1 - s0) * (pos - i0));
  }
  return out;
}

/** Mono berlaju `rate` menjadi 16 kHz (kontrak). */
export const resampleTo16k = (mono: Int16Array, rate: number): Int16Array => resample(mono, rate, VOICE_RATE);

/** Kerasnya tiap bingkai 20 ms (RMS, 0..1); bingkai terakhir yang kurang dari separuh dibuang. */
export function frameLevels(pcm: Int16Array): Float64Array {
  const count = Math.floor((pcm.length + FRAME / 2) / FRAME);
  const out = new Float64Array(count);
  for (let f = 0; f < count; f++) {
    const from = f * FRAME;
    const to = Math.min(pcm.length, from + FRAME);
    let sum = 0;
    for (let i = from; i < to; i++) sum += pcm[i]! * pcm[i]!;
    out[f] = to > from ? Math.sqrt(sum / (to - from)) / 32768 : 0;
  }
  return out;
}

export interface PreparedUtterance {
  /** PCM16 mono 16 kHz yang dikirim. */
  pcm: Int16Array;
  /** Lama yang dikirim, ms. */
  speechMs: number;
  /** Hening yang dipangkas di awal dan akhir, ms. */
  leadMs: number;
  trailMs: number;
  /** Penguatan yang dipakai (1 = tidak diubah). */
  gain: number;
}

/** Pangkas hening dan samakan keras; `null` bila tidak ada suara yang bisa dikenali. `pcm` sudah mono 16 kHz. */
export function prepareUtterance(pcm: Int16Array): PreparedUtterance | null {
  const levels = frameLevels(pcm);
  if (levels.length === 0) return null;
  let loudest = 0;
  for (const v of levels) if (v > loudest) loudest = v;
  if (!(loudest >= fromDb(SILENT_DBFS))) return null;
  const sorted = Array.from(levels).sort((a, b) => a - b);
  const noise = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * NOISE_PERCENTILE))]!;
  const threshold = Math.max(fromDb(FLOOR_DBFS), Math.min(noise * ABOVE_NOISE, loudest * OF_LOUDEST));

  let first = -1;
  let last = -1;
  let voiced = 0;
  let voicedPower = 0;
  for (let f = 0; f < levels.length; f++) {
    if (levels[f]! < threshold) continue;
    if (first < 0) first = f;
    last = f;
    voiced += 1;
    voicedPower += levels[f]! * levels[f]!;
  }
  if (voiced < MIN_VOICED_FRAMES || first < 0) return null;

  const start = Math.max(0, (first - Math.ceil(PRE_ROLL_MS / FRAME_MS)) * FRAME);
  const end = Math.min(pcm.length, (last + 1 + Math.ceil(POST_ROLL_MS / FRAME_MS)) * FRAME);
  let peak = 1;
  for (let i = start; i < end; i++) {
    const a = Math.abs(pcm[i]!);
    if (a > peak) peak = a;
  }
  const voicedRms = Math.sqrt(voicedPower / voiced);
  let gain = Math.min(MAX_GAIN, fromDb(TARGET_DBFS) / Math.max(voicedRms, 1e-6), PEAK_LIMIT / peak);
  if (!(gain > 1.05)) gain = 1;

  const out = new Int16Array(end - start);
  for (let i = 0; i < out.length; i++) {
    const v = Math.round(pcm[start + i]! * gain);
    out[i] = v > 32767 ? 32767 : v < -32768 ? -32768 : v;
  }
  const ms = (n: number) => Math.round((n / VOICE_RATE) * 1000);
  return { pcm: out, speechMs: ms(out.length), leadMs: ms(start), trailMs: ms(pcm.length - end), gain };
}

/** PCM menjadi potongan base64 (little-endian) untuk pesan `audio`, berurutan. */
export function encodeChunks(pcm: Int16Array, size: number = SEND_CHUNK_SAMPLES): string[] {
  const step = Math.max(1, Math.floor(size));
  const out: string[] = [];
  for (let at = 0; at < pcm.length; at += step) {
    const part = pcm.subarray(at, Math.min(pcm.length, at + step));
    out.push(toBase64(new Uint8Array(part.buffer, part.byteOffset, part.byteLength)));
  }
  return out;
}
