export const SPARK_W = 320;
export const SPARK_H = 64;

export interface SparkPoint {
  x: number;
  y: number;
}

/** Jarak titik untuk tujuh titik, seperti di desain. */
const STEP_7 = 50.7;

/**
 * Titik grafik dalam kotak 320×64, rumus `spark()` di desain: x = 8 + i·50,7 dan y = 58 - (nilai - min)/rentang·50.
 * Bawaan (min 2,6, rentang 2,5, tujuh titik) sama persis dengan desain. Jumlah titik lain dibagi rata di lebar yang sama.
 */
export function sparkPoints(series: number[], min = 2.6, span = 2.5): SparkPoint[] {
  const step = series.length === 7 ? STEP_7 : series.length > 1 ? (STEP_7 * 6) / (series.length - 1) : 0;
  return series.map((v, i) => ({ x: 8 + i * step, y: 58 - ((v - min) / span) * 50 }));
}

/** Batas bawah dan rentang sumbu supaya garis memenuhi tinggi grafik, dengan sedikit ruang di atas dan bawah. */
export function sparkRange(values: number[]): { min: number; span: number } {
  if (values.length === 0) return { min: 0, span: 1 };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const gap = hi - lo || Math.abs(hi) || 1;
  return { min: lo - gap * 0.1, span: gap * 1.2 };
}
