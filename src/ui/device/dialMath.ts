import { AC_MAX, AC_MIN } from '@/sample/devices';

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

/**
 * Suhu (bulat, 16–30) untuk sentuhan di titik (x, y) pada kotak putaran. `prev` mencegah loncat dari 30 ke 16
 * (atau sebaliknya) saat jari melewati celah di bawah: suhu tertahan di ujung terdekat.
 */
export function pointToTemp(x: number, y: number, prev: number): number {
  'worklet';
  const c = DIAL.size / 2;
  const deg = (Math.atan2(y - c, x - c) * 180) / Math.PI;
  // 0 di awal busur (kiri bawah), naik searah jarum jam sampai 270 di ujung (kanan bawah); 270..360 = celah.
  const rel = (((deg - DIAL.start) % 360) + 360) % 360;
  const gapMid = DIAL.sweep + (360 - DIAL.sweep) / 2;
  const frac = rel <= DIAL.sweep ? rel / DIAL.sweep : rel >= gapMid ? 0 : 1;
  const next = Math.round(AC_MIN + frac * SPAN);
  if (Math.abs(next - prev) > SPAN / 2) return prev > (AC_MIN + AC_MAX) / 2 ? AC_MAX : AC_MIN;
  return next;
}
