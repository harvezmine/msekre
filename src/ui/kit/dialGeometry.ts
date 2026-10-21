/** Geometri dial 270° (§5 Dial): busur dari 135° sampai 405° (0° = kanan, searah jarum jam seperti SVG). */

export const ARC_START = 135;
export const ARC_SWEEP = 270;

/** Sudut busur untuk nilai (ditahan di min..max). */
export function angleForValue(value: number, min: number, max: number): number {
  'worklet';
  const t = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  return ARC_START + ARC_SWEEP * t;
}

export function pointOn(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Jalur busur SVG searah jarum jam dari a0 ke a1. */
export function arcD(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = pointOn(cx, cy, r, a0);
  const p1 = pointOn(cx, cy, r, a1);
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M${f(p0.x)} ${f(p0.y)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(p1.x)} ${f(p1.y)}`;
}

/** Sudut sentuhan terhadap pusat. */
export function touchAngle(cx: number, cy: number, x: number, y: number): number {
  'worklet';
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

/** Apakah sentuhan ada di pita cincin (jari-jari ± band). */
export function onBand(cx: number, cy: number, r: number, band: number, x: number, y: number): boolean {
  'worklet';
  return Math.abs(Math.hypot(x - cx, y - cy) - r) <= band;
}

/** Posisi 0..270 di busur untuk sudut; null di celah 90° bawah. */
export function arcPosition(angleDeg: number): number | null {
  'worklet';
  const rel = (((angleDeg - ARC_START) % 360) + 360) % 360;
  return rel <= ARC_SWEEP ? rel : null;
}

/** Geser posisi sebesar selisih sudut terpendek, ditahan di 0..270 (tidak meloncat lewat celah bawah). */
export function nudgeArc(pos: number, prevAngle: number, angle: number): number {
  'worklet';
  let d = (((angle - prevAngle) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return Math.min(ARC_SWEEP, Math.max(0, pos + d));
}

/** Nilai bulat ke `step` untuk posisi busur. */
export function valueForArc(pos: number, min: number, max: number, step: number): number {
  'worklet';
  const p = Math.min(ARC_SWEEP, Math.max(0, pos)) / ARC_SWEEP;
  const v = Math.round((min + p * (max - min) - min) / step) * step + min;
  return Math.min(max, Math.max(min, v));
}

/** Posisi busur untuk nilai. */
export function arcForValue(value: number, min: number, max: number): number {
  'worklet';
  return angleForValue(value, min, max) - ARC_START;
}
