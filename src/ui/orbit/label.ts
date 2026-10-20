import type { OrbitNode } from './types';

/** "7 terhubung · CCTV tidak terjangkau". Jumlahnya menghitung semua simpul, termasuk yang tidak terjangkau. */
export function ringLabel(nodes: Pick<OrbitNode, 'label' | 'offline'>[]): string {
  const off = nodes.filter((n) => n.offline).map((n) => n.label);
  const base = `${nodes.length} terhubung`;
  return off.length ? `${base} · ${off.join(', ')} tidak terjangkau` : base;
}
