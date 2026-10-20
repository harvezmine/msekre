/** Tinggi panel yang dipakai selama panel belum terukur (onLayout belum datang). */
export const FALLBACK_PANEL_H = 300;

/**
 * Geser ke bawah menutup lembar bila melewati seperempat tinggi panel yang terukur, atau bila lepasnya cepat.
 * Worklet: dipanggil dari utas UI, jadi hanya menerima angka (bukan ref React).
 */
export function shouldDismiss(translateY: number, measuredH: number, velocityY: number): boolean {
  'worklet';
  const h = measuredH > 0 ? measuredH : FALLBACK_PANEL_H;
  return translateY > h * 0.25 || velocityY > 900;
}
