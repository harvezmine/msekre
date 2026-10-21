import { AC_MAX, AC_MIN } from '@/api/constants';

/** Ukuran putaran suhu (desain 2d, dial()): 280×280, jari-jari 116, busur 270° dari 135° sampai 405°. */
export const DIAL = { size: 280, radius: 116, stroke: 16, knob: 15, start: 135, sweep: 270 } as const;

const SPAN = AC_MAX - AC_MIN;

/** Sudut busur (derajat, 0 = kanan, searah jarum jam seperti SVG) untuk suhu; suhu dibatasi 16–30. */
export function tempToAngle(temp: number): number {
  'worklet';
  const t = Math.min(AC_MAX, Math.max(AC_MIN, temp));
  return DIAL.start + (DIAL.sweep * (t - AC_MIN)) / SPAN;
}

/** Titik pada lingkaran putaran untuk sudut tertentu. */
export function pointAt(angle: number): { x: number; y: number } {
  const c = DIAL.size / 2;
  const rad = (angle * Math.PI) / 180;
  return { x: c + DIAL.radius * Math.cos(rad), y: c + DIAL.radius * Math.sin(rad) };
}

/** Jalur busur SVG dari sudut a0 ke a1. */
export function arcPath(a0: number, a1: number): string {
  const p0 = pointAt(a0);
  const p1 = pointAt(a1);
  return `M${p0.x} ${p0.y}A${DIAL.radius} ${DIAL.radius} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1.x} ${p1.y}`;
}

/** Lebar pita cincin yang bisa disentuh: jari-jari ± ini. Di luar pita (angka tengah, sudut kotak) sentuhan diabaikan. */
export const RING_BAND = 28;

/** Sudut sentuhan (derajat, 0 = kanan, searah jarum jam) terhadap pusat putaran. */
export function angleOf(x: number, y: number): number {
  'worklet';
  const c = DIAL.size / 2;
  return (Math.atan2(y - c, x - c) * 180) / Math.PI;
}

/** Apakah sentuhan jatuh di pita cincin (bukan di angka tengah atau sudut kotak). */
export function onRing(x: number, y: number): boolean {
  'worklet';
  const c = DIAL.size / 2;
  return Math.abs(Math.hypot(x - c, y - c) - DIAL.radius) <= RING_BAND;
}

/** Posisi busur 0–270 (0 = 16° di 135°) untuk sudut; null bila sudut jatuh di celah 90° di bawah. */
export function arcPosFromAngle(angleDeg: number): number | null {
  'worklet';
  const rel = (((angleDeg - DIAL.start) % 360) + 360) % 360;
  return rel <= DIAL.sweep ? rel : null;
}

/** Selisih sudut terpendek bertanda, dinormalkan ke (−180, 180]. */
function shortestDelta(from: number, to: number): number {
  'worklet';
  let d = (((to - from) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/** Geser posisi busur sebesar selisih sudut terpendek sejak sentuhan sebelumnya, ditahan di 0–270. */
export function stepArc(pos: number, prevAngle: number, angle: number): number {
  'worklet';
  return Math.min(DIAL.sweep, Math.max(0, pos + shortestDelta(prevAngle, angle)));
}

/** Suhu bulat 16–30 untuk posisi busur. */
export function tempFromArc(pos: number): number {
  'worklet';
  const p = Math.min(DIAL.sweep, Math.max(0, pos));
  return Math.round(AC_MIN + (p / DIAL.sweep) * SPAN);
}

/** Posisi busur 0–270 untuk suhu (ditahan di 16–30). */
export function arcFromTemp(temp: number): number {
  'worklet';
  const t = Math.min(AC_MAX, Math.max(AC_MIN, temp));
  return ((t - AC_MIN) / SPAN) * DIAL.sweep;
}
