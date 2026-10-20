export interface OrbitPoint {
  /** Sudut simpul dari pusat (radian), untuk arah luar. */
  angle: number;
  x: number;
  y: number;
  /** Garis dari tepi dalam (dekat Inti) ke tepi simpul. Aliran titik berjalan dari (x2,y2) ke (x1,y1). */
  line: { x1: number; y1: number; x2: number; y2: number };
}

/** Sama dengan SK.orbit di desain: simpul pertama di puncak, berputar searah jarum jam. */
export function orbitLayout(
  count: number,
  opts: { W?: number; H?: number; r?: number; ri?: number; node?: number } = {},
): { cx: number; cy: number; nodes: OrbitPoint[] } {
  const W = opts.W ?? 360;
  const H = opts.H ?? 304;
  const r = opts.r ?? 126;
  const ri = opts.ri ?? 80;
  const half = (opts.node ?? 44) / 2;
  const cx = W / 2;
  const cy = H / 2;
  const nodes = Array.from({ length: count }, (_, i) => {
    const t = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const x = cx + r * cos;
    const y = cy + r * sin;
    return { angle: t, x, y, line: { x1: cx + ri * cos, y1: cy + ri * sin, x2: x - half * cos, y2: y - half * sin } };
  });
  return { cx, cy, nodes };
}
