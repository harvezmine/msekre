import { useWindowDimensions } from 'react-native';

/**
 * Kelas tata letak dari ukuran layar (§6 spesifikasi):
 * - `compact`: tinggi < 700 (360×640);
 * - `tall`: tinggi/lebar ≥ 2,0 (360×800, 393×873 acuan, 412×915);
 * - `regular`: selain itu (412×780, lipat kecil).
 */
export type LayoutClass = 'compact' | 'regular' | 'tall';

export function layoutClassFor(width: number, height: number): LayoutClass {
  if (height < 700) return 'compact';
  if (width > 0 && height / width >= 2) return 'tall';
  return 'regular';
}

/** Kelas tata letak layar sekarang; ikut berubah saat jendela berubah ukuran (lipat, putar). */
export function useLayoutClass(): LayoutClass {
  const { width, height } = useWindowDimensions();
  return layoutClassFor(width, height);
}

/** Pilih nilai per kelas, contoh `byLayout(cls, { compact: 72, regular: 84, tall: 88 })`. */
export function byLayout<T>(cls: LayoutClass, values: Record<LayoutClass, T>): T {
  return values[cls];
}
