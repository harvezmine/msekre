/** Pita "S" berukuran 282×310. Tiga titik gelembung chat ada di 27,8 / 39,2 / 50,5 % lebar dan 72,3 % tinggi. */
export const DOT_X = [0.278, 0.392, 0.505] as const;
export const DOT_Y = 0.723;

export function intiSize(size: number): { w: number; h: number; dot: number } {
  return { w: Math.round((size * 282) / 310), h: size, dot: Math.max(3, size * 0.068) };
}
