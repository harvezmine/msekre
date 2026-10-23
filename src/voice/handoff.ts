import type { HoldOrigin } from './holdBridge';

/**
 * Peralihan dari Inti bilah tab ke Mode Suara layar penuh tanpa lompatan: Inti Mode Suara muncul tepat di tempat jari
 * menahan (sebesar Inti bilah, lalu tumbuh), dan setelah jari diangkat Inti meluncur ke tempatnya di atas "Selesai". Hitungan murni, diuji langsung.
 */

/** Inti di Mode Suara (app/suara.tsx). */
export const VOICE_INTI = 88;
/** Tombol "Selesai" dan jarak antarbaris kontrol di bawah Inti. */
const DONE_HEIGHT = 56;
const CONTROL_GAP = 16;

/** Pusat Inti Mode Suara di jendela (kolom ketik tertutup): menempel di bawah, di atas "Selesai". */
export function restCentre(width: number, height: number, insetBottom: number): { x: number; y: number } {
  const bottomPad = Math.max(insetBottom, 12) + 18;
  return { x: width / 2, y: height - bottomPad - DONE_HEIGHT - CONTROL_GAP - VOICE_INTI / 2 };
}

export interface Handoff {
  /** Geser awal dari tempat istirahat ke jari, dp. */
  dx: number;
  dy: number;
  /** Skala awal (Inti bilah 48 dari 88), lalu tumbuh ke 1. */
  scale: number;
}

/** Geser dan skala awal supaya Inti Mode Suara tepat di bawah jari; `null` bila asalnya tidak diketahui. */
export function handoffFrom(origin: HoldOrigin | null, rest: { x: number; y: number }): Handoff | null {
  if (!origin) return null;
  const dx = origin.x - rest.x;
  const dy = origin.y - rest.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const scale = Math.min(1, Math.max(0.4, origin.size / VOICE_INTI));
  return { dx, dy, scale: Number.isFinite(scale) ? scale : 1 };
}
