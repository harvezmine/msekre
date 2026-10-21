/** Hitungan penggeser dan dial yang sama di JS dan worklet. */

export function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
}

/** Nilai 0..1 → nilai bulat ke `step` dalam min..max. */
export function steppedValue(pos: number, min: number, max: number, step: number): number {
  'worklet';
  const raw = min + clamp(pos, 0, 1) * (max - min);
  const v = Math.round((raw - min) / step) * step + min;
  // Membuang sisa pecahan floating point (0.1 + 0.2).
  const decimals = step < 1 ? Math.min(6, Math.ceil(-Math.log10(step))) : 0;
  return clamp(Number(v.toFixed(decimals)), min, max);
}

/** Nilai → posisi 0..1. */
export function normalize(value: number, min: number, max: number): number {
  'worklet';
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

/** Langkah pembaca layar: `step` bila rentang ≤ 20 langkah, selain itu kira-kira 5% rentang (dibulatkan ke `step`). */
export function defaultA11yStep(min: number, max: number, step: number): number {
  const n = (max - min) / step;
  if (n <= 20) return step;
  return Math.max(step, Math.round((max - min) / 20 / step) * step);
}
