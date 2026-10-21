/** Hitungan grafik garis halus (§5 Sparkline/AreaChart). */

export type Pt = readonly [number, number];

/** Titik dalam kotak w×h: x merata dari `pad` sampai w−pad, y dari `top` sampai h−4 (nilai kecil di bawah). */
export function scalePoints(values: readonly number[], w: number, h: number, pad = 6, top = 6): Pt[] {
  if (values.length === 0) return [];
  const lo = Math.min(...values) * 0.92;
  const hi = Math.max(...values) * 1.02;
  const span = hi - lo || 1;
  const n = values.length;
  return values.map((v, i) => [
    n === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (n - 1),
    top + (h - top - 4) * (1 - (v - lo) / span),
  ]);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Catmull-Rom (tegangan 0,18) menjadi kurva Bézier kubik, seperti `smooth()` di papan desain. */
export function smoothPath(pts: readonly Pt[], k = 0.18): string {
  if (pts.length === 0) return '';
  const [x0, y0] = pts[0]!;
  let d = `M${r2(x0)},${r2(y0)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * k;
    const c1y = p1[1] + (p2[1] - p0[1]) * k;
    const c2x = p2[0] - (p3[0] - p1[0]) * k;
    const c2y = p2[1] - (p3[1] - p1[1]) * k;
    d += ` C${r2(c1x)},${r2(c1y)} ${r2(c2x)},${r2(c2y)} ${r2(p2[0])},${r2(p2[1])}`;
  }
  return d;
}

/** Jalur area: garis halus lalu turun ke dasar dan kembali ke awal. */
export function areaPath(pts: readonly Pt[], bottom: number): string {
  if (pts.length === 0) return '';
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  return `${smoothPath(pts)} L${r2(last[0])},${bottom} L${r2(first[0])},${bottom} Z`;
}
