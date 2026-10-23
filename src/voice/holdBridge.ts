import { reportError } from '@/crash';

/**
 * Serah-terima tahan-untuk-bicara dari Inti (Beranda/bilah tab) ke Mode Suara, dalam satu gerakan jari:
 * 1. Inti ditahan: `begin()`, lalu `/suara?hold=1` dibuka selagi jari masih menempel.
 * 2. Mode Suara terbuka: masih ditahan (`isHeld()`), jadi langsung mendengar dan berlangganan `onRelease`.
 * 3. Jari diangkat dari Inti yang sama (Pressable-nya tetap terpasang di bawah Mode Suara): `release()` mengakhiri
 *    ucapan dan mengirimnya.
 * Dilepas sebelum Mode Suara siap: tidak mendengar sama sekali (sama dengan ketukan biasa). Mode Suara ditutup selagi
 * masih ditahan: `cancel()`, tahanan dilupakan tanpa mengirim apa pun.
 *
 * `release()` dipanggil dari sentuhan (`onPressOut`): kesalahan di pendengar tidak boleh keluar dari sana, karena
 * kesalahan di penangan sentuhan menutup paksa aplikasi di build rilis.
 */
/** Pusat Inti yang ditahan (jendela, dp) dan garis tengahnya: Mode Suara memunculkan Inti-nya tepat di bawah jari. */
export interface HoldOrigin {
  x: number;
  y: number;
  size: number;
}

let held = false;
let origin: HoldOrigin | null = null;
const listeners = new Set<() => void>();

const validOrigin = (o: HoldOrigin | null | undefined): HoldOrigin | null =>
  o && Number.isFinite(o.x) && Number.isFinite(o.y) && Number.isFinite(o.size) && o.size > 0 ? { ...o } : null;

export const holdBridge = {
  begin(from?: HoldOrigin | null): void {
    held = true;
    origin = validOrigin(from);
  },
  /** Tempat Inti yang ditahan, bila diketahui (bilah tab). */
  origin(): HoldOrigin | null {
    return origin;
  },
  /** Jari diangkat (atau sentuhan dibatalkan sistem). Hanya yang pertama setelah `begin` yang berarti. */
  release(): void {
    if (!held) return;
    held = false;
    for (const l of [...listeners]) {
      try {
        l();
      } catch (e) {
        reportError('tahan Inti: lepas', e);
      }
    }
  },
  /** Tahanan dilupakan tanpa memberi tahu pendengar (Mode Suara ditutup, atau gagal dibuka). */
  cancel(): void {
    held = false;
  },
  isHeld(): boolean {
    return held;
  },
  onRelease(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Untuk tes. */
  reset(): void {
    held = false;
    origin = null;
    listeners.clear();
  },
};
