import type { LayoutClass } from '@/ui/kit/layout';
import { layoutClassFor } from '@/ui/kit/layout';
import type { OrbitNode } from '@/ui/orbit/types';

/**
 * Tata letak Inti besar di Beranda dan jaring layanan di sekelilingnya (hitungan murni, tanpa React, diuji langsung).
 *
 * - Ukuran Inti mengikuti layar: kira-kira 0,4 × lebar, dibatasi tinggi layar dan kelasnya (`compact` lebih kecil
 *   supaya blok tetap muat; HP panjang lebih besar dan kotaknya lebih tinggi).
 * - Simpul (5 sampai 7) duduk di cincin lonjong yang sengaja tidak rata: sudut dan jarak tiap simpul dari tabel per
 *   jumlah, seimbang kiri-kanan. Simpul yang terlalu dekat dengan Inti didorong keluar, dan bila kotaknya tidak cukup
 *   tinggi diputar pelan ke arah samping sampai muat.
 * - Garis: dari tepi Inti ke tepi tiap simpul, ditambah paling banyak dua garis tipis antar-tetangga (satu di kiri,
 *   satu di kanan) supaya terbaca sebagai jaring, bukan bintang.
 */

export interface HeroMetrics {
  cls: LayoutClass;
  /** Lebar kotak = lebar layar. */
  width: number;
  /** Tinggi kotak jaring. */
  height: number;
  /** Garis tengah Inti. */
  inti: number;
  /** Sisi ubin simpul. */
  node: number;
  /** Simpul paling banyak. */
  maxNodes: number;
  /** Simpangan melayang simpul (dp). */
  drift: number;
  /** Ruang paling sedikit antara tepi Inti dan tepi simpul: jari-jari terpendek tetap terlihat sebagai garis. */
  clear: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Tinggi yang dipakai sapaan, tiga blok terpanjang, bilah tab, dan bilah status di HP panjang. Sisanya untuk kotak
 * jaring, supaya di 393×873 ketiga blok tetap terlihat tanpa menggulir.
 */
const RESERVED = 640;

export function heroMetrics(width: number, height: number): HeroMetrics {
  const cls = layoutClassFor(width, height);
  if (cls === 'compact') {
    const inti = Math.round(clamp(Math.min(width * 0.34, height * 0.19), 112, 132));
    return { cls, width, height: inti + 60, inti, node: 28, maxNodes: 5, drift: 2, clear: 22 };
  }
  if (cls === 'regular') {
    const inti = Math.round(clamp(Math.min(width * 0.38, height * 0.2), 136, 176));
    const box = Math.round(clamp(height - RESERVED, inti + 64, inti + 100));
    return { cls, width, height: box, inti, node: 30, maxNodes: 6, drift: 2.5, clear: 26 };
  }
  const inti = Math.round(clamp(Math.min(width * 0.4, height * 0.2), 148, 188));
  const box = Math.round(clamp(height - RESERVED, inti + 64, inti + 110));
  return { cls, width, height: box, inti, node: 32, maxNodes: 7, drift: 2.5, clear: 28 };
}

/** Sudut (derajat, 0 = kanan, positif = ke bawah) dan jarak relatif tiap simpul, per jumlah simpul. */
const SLOTS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[-38, 1]],
  2: [
    [-150, 1],
    [24, 0.96],
  ],
  3: [
    [-146, 1],
    [-34, 0.97],
    [128, 0.95],
  ],
  4: [
    [-150, 1],
    [-40, 0.96],
    [30, 1],
    [146, 0.94],
  ],
  5: [
    [-152, 1],
    [-104, 1],
    [-36, 0.97],
    [28, 1],
    [150, 0.93],
  ],
  6: [
    [-150, 1],
    [-100, 1],
    [-34, 0.96],
    [16, 1],
    [64, 0.95],
    [160, 0.93],
  ],
  7: [
    [-148, 1],
    [-108, 1],
    [-56, 0.97],
    [-12, 1],
    [34, 0.95],
    [118, 1],
    [164, 0.92],
  ],
};

/** Jarak dari tepi layar ke tepi simpul. */
const EDGE = 18;
/** Celah antara ujung garis dan tepi ubin. */
const GAP = 3;

export interface WebNode extends OrbitNode {
  /** Simpul contoh untuk pengguna baru (redup, garis putus-putus). */
  placeholder?: boolean;
}

export interface WebPoint {
  node: WebNode;
  x: number;
  y: number;
  /** Arah dari pusat Inti ke simpul (radian). */
  angle: number;
  /** Garis jari-jari: dari tepi Inti ke dekat tepi ubin. */
  spoke: { x1: number; y1: number; x2: number; y2: number; length: number };
}

export interface WebLink {
  from: number;
  to: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface WebLayout {
  cx: number;
  cy: number;
  points: WebPoint[];
  links: WebLink[];
  /** Urutan simpul yang dikunjungi titik cahaya: bergantian kiri dan kanan, hanya yang terjangkau. */
  pulseOrder: number[];
}

/** Simpul jaring dari simpul cincin Beranda: paling banyak `max`, urutan dari server. */
export function webNodes(ring: readonly OrbitNode[], max: number): WebNode[] {
  return ring.slice(0, Math.max(0, max));
}

/** Pengguna baru (belum ada layanan): tiga simpul contoh yang redup, WhatsApp dan dua yang paling sering disambung. */
export const PLACEHOLDER_NODES: readonly WebNode[] = [
  { key: 'wa', icon: 'chat', label: 'WhatsApp', placeholder: true },
  { key: 'gcal', icon: 'calendar', label: 'Google Kalender', placeholder: true },
  { key: 'gmail', icon: 'mail', label: 'Gmail', placeholder: true },
];

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Satu simpul: tempatnya di cincin, didorong keluar dari Inti, diputar ke samping bila kotaknya terlalu pendek. */
function place(deg: number, k: number, rx: number, ry: number, rMin: number) {
  // Arah samping terdekat (0° atau ±180°); sudut didekatkan ke sana 3° per langkah sampai simpulnya muat.
  const side = Math.abs(deg) <= 90 ? 0 : deg >= 0 ? 180 : -180;
  let d = deg;
  for (let i = 0; i < 64; i++) {
    let dx = k * rx * Math.cos(rad(d));
    let dy = k * ry * Math.sin(rad(d));
    const dist = Math.hypot(dx, dy);
    if (dist < rMin && dist > 0) {
      dx = (dx / dist) * rMin;
      dy = (dy / dist) * rMin;
    }
    dx = clamp(dx, -rx, rx);
    dy = clamp(dy, -ry, ry);
    if (Math.hypot(dx, dy) >= rMin - 0.5 || d === side) return { dx, dy };
    d = d < side ? Math.min(side, d + 3) : Math.max(side, d - 3);
  }
  return { dx: Math.cos(rad(d)) * rx, dy: 0 };
}

/** Jarak titik (px, py) ke ruas (x1,y1)-(x2,y2). */
function segmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy;
  const t = len2 > 0 ? clamp(((px - x1) * vx + (py - y1) * vy) / len2, 0, 1) : 0;
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

export function webLayout(m: HeroMetrics, nodes: readonly WebNode[]): WebLayout {
  const cx = m.width / 2;
  const cy = m.height / 2;
  const half = m.node / 2;
  const rx = m.width / 2 - EDGE - half - m.drift;
  const ry = m.height / 2 - half - m.drift - 2;
  const rMin = m.inti / 2 + half + m.clear;
  const count = Math.min(nodes.length, 7);
  const slots = SLOTS[count] ?? [];

  const points: WebPoint[] = slots.map(([deg, k], i) => {
    const { dx, dy } = place(deg, k, rx, ry, rMin);
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const r0 = m.inti / 2 + 2;
    const r1 = dist - half - GAP;
    return {
      node: nodes[i]!,
      x: cx + dx,
      y: cy + dy,
      angle: Math.atan2(dy, dx),
      spoke: {
        x1: cx + ux * r0,
        y1: cy + uy * r0,
        x2: cx + ux * r1,
        y2: cy + uy * r1,
        length: Math.max(0, r1 - r0),
      },
    };
  });

  return { cx, cy, points, links: neighbourLinks(points, cx, cy, m), pulseOrder: pulseOrder(points, cx) };
}

/**
 * Paling banyak dua garis antar-tetangga (urut sudut), yang terpendek di kiri dan yang terpendek di kanan. Garis yang
 * melewati Inti tidak dipakai.
 */
function neighbourLinks(points: WebPoint[], cx: number, cy: number, m: HeroMetrics): WebLink[] {
  if (points.length < 3) return [];
  const half = m.node / 2 + GAP;
  const byAngle = points.map((p, i) => ({ p, i })).sort((a, b) => a.p.angle - b.p.angle);
  const pairs = byAngle.map((a, j) => [a, byAngle[(j + 1) % byAngle.length]!] as const);
  const candidates = pairs
    .filter(([a, b]) => segmentDistance(cx, cy, a.p.x, a.p.y, b.p.x, b.p.y) > m.inti / 2 + 16)
    .map(([a, b]) => ({ a, b, length: Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) }))
    .filter((c) => c.length > m.node + 2 * GAP + 8)
    .sort((x, y) => x.length - y.length);
  const left = candidates.find((c) => c.a.p.x < cx && c.b.p.x < cx);
  const right = candidates.find((c) => c.a.p.x > cx && c.b.p.x > cx);
  const chosen = [left, right].filter((c) => c !== undefined);
  for (const c of candidates) if (chosen.length < 2 && !chosen.includes(c)) chosen.push(c);
  return chosen.map(({ a, b, length }) => {
    const ux = (b.p.x - a.p.x) / length;
    const uy = (b.p.y - a.p.y) / length;
    return {
      from: a.i,
      to: b.i,
      x1: a.p.x + ux * half,
      y1: a.p.y + uy * half,
      x2: b.p.x - ux * half,
      y2: b.p.y - uy * half,
    };
  });
}

/** Simpul terjangkau bergantian kiri dan kanan (masing-masing urut dari atas), supaya titik cahaya tidak menumpuk. */
function pulseOrder(points: WebPoint[], cx: number): number[] {
  const live = points.map((p, i) => ({ p, i })).filter(({ p }) => !p.node.offline);
  const byHeight = (a: { p: WebPoint }, b: { p: WebPoint }) => a.p.y - b.p.y;
  const left = live.filter(({ p }) => p.x < cx).sort(byHeight);
  const right = live.filter(({ p }) => p.x >= cx).sort(byHeight);
  const out: number[] = [];
  for (let j = 0; j < Math.max(left.length, right.length); j++) {
    if (left[j]) out.push(left[j]!.i);
    if (right[j]) out.push(right[j]!.i);
  }
  return out;
}

/** Kalimat untuk pembaca layar: siapa saja yang tersambung, dan yang sedang tidak terjangkau. */
export function webLabel(nodes: readonly WebNode[]): string {
  if (nodes.length === 0) return '';
  if (nodes.every((n) => n.placeholder)) return 'Belum ada layanan tersambung';
  const on = nodes.filter((n) => !n.offline).map((n) => n.label);
  const off = nodes.filter((n) => n.offline).map((n) => `${n.label} tidak terjangkau`);
  return `Tersambung: ${[...on, ...off].join(', ')}`;
}
