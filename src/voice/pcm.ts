const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(128).fill(255);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

/** Base64 dari byte (tidak bergantung pada `btoa`/`Buffer`, yang tidak sama di setiap mesin JS). */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!;
    out += b === undefined ? '=' : ALPHABET[(n >> 6) & 63]!;
    out += c === undefined ? '=' : ALPHABET[n & 63]!;
  }
  return out;
}

/** Byte dari base64. Karakter di luar abjad (spasi, baris baru) dilewati. */
export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => (i + k < clean.length ? LOOKUP[clean.charCodeAt(i + k)]! : 0));
    const n = (v[0]! << 18) | (v[1]! << 12) | (v[2]! << 6) | v[3]!;
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/**
 * PCM 16-bit dari mikrofon menjadi mono 16 kHz yang dijanjikan kontrak. HP boleh memberi laju lain atau lebih dari satu
 * saluran; yang diambil saluran pertama, lalu dicuplik ulang secara linear.
 */
export function toVoiceFormat(data: ArrayBuffer, sampleRate: number, channels: number, target = 16000): Int16Array {
  const all = new Int16Array(data, 0, Math.floor(data.byteLength / 2));
  const step = Math.max(1, channels);
  let mono = all;
  if (step > 1) {
    mono = new Int16Array(Math.floor(all.length / step));
    for (let i = 0; i < mono.length; i++) mono[i] = all[i * step]!;
  }
  if (sampleRate === target || sampleRate <= 0) return mono;
  const length = Math.floor((mono.length * target) / sampleRate);
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const pos = (i * sampleRate) / target;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const s0 = mono[i0] ?? 0;
    const s1 = mono[Math.min(i0 + 1, mono.length - 1)] ?? s0;
    out[i] = Math.round(s0 + (s1 - s0) * frac);
  }
  return out;
}

export function pcmBytes(samples: Int16Array): Uint8Array {
  return new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
}

/** Keras-pelannya suara dari RMS (0..1) dalam desibel: -50 dB → 0, -10 dB → 1 (§5.1). Hening = 0. */
export function levelFromRms(rms: number): number {
  if (!(rms > 0)) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db + 50) / 40));
}

/**
 * Keras-pelannya suara, 0 sampai 1, untuk gelombang dan cahaya Inti: akar rata-rata kuadrat dalam desibel (-50 dB → 0,
 * -10 dB → 1, §5.1), jadi bisikan tetap terlihat dan teriakan tidak memenuhi layar.
 */
export function level(samples: Int16Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
  return levelFromRms(Math.sqrt(sum / samples.length) / 32768);
}

/** Lama audio PCM 16 kHz mono, dalam milidetik. */
export const pcmMs = (samples: number, rate = 16000) => Math.round((samples / rate) * 1000);

/** Gabungkan potongan byte jadi satu. */
export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** WAV 8-bit mono berisi hening, untuk balasan suara dari server tiruan. */
export function silentWav(ms: number, rate = 8000): Uint8Array {
  const n = Math.floor((rate * ms) / 1000);
  const out = new Uint8Array(44 + n);
  const view = new DataView(out.buffer);
  const tag = (at: number, text: string) => [...text].forEach((ch, i) => (out[at + i] = ch.charCodeAt(0)));
  tag(0, 'RIFF');
  view.setUint32(4, 36 + n, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  tag(36, 'data');
  view.setUint32(40, n, true);
  out.fill(128, 44);
  return out;
}
