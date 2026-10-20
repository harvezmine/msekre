export const SPARK_W = 320;
export const SPARK_H = 64;

export interface SparkPoint {
  x: number;
  y: number;
}

/**
 * Titik grafik 7 hari dalam kotak 320×64, rumus `spark()` di desain: x = 8 + i·50,7 dan
 * y = 58 − (nilai − min)/rentang·50. Bawaan (min 2,6, rentang 2,5) sama persis dengan desain.
 */
export function sparkPoints(series: number[], min = 2.6, span = 2.5): SparkPoint[] {
  return series.map((v, i) => ({ x: 8 + i * 50.7, y: 58 - ((v - min) / span) * 50 }));
}
