import type { Box, Device } from '@/api/contract';
import { wideTemp } from './present';

export type GridItem = { type: 'device'; device: Device } | { type: 'box'; box: Box };
export type GridRow = { type: 'wide'; item: GridItem } | { type: 'pair'; items: GridItem[] };

/**
 * Kisi ubin yang bervariasi (papan 16): AC menyala selebar layar (dengan suhu besar) di atas, lalu ubin dua kolom sesuai
 * urutan server, Kotak di depannya, perangkat yang tidak terjangkau paling akhir.
 */
export function gridRows(devices: readonly Device[], box: Box | null): GridRow[] {
  const wide = devices.filter((d) => wideTemp(d) !== undefined);
  const rest = devices.filter((d) => wideTemp(d) === undefined);
  const half: GridItem[] = [
    ...(box ? [{ type: 'box' as const, box }] : []),
    ...rest.filter((d) => d.reachable).map((device) => ({ type: 'device' as const, device })),
    ...rest.filter((d) => !d.reachable).map((device) => ({ type: 'device' as const, device })),
  ];
  const rows: GridRow[] = wide.map((device) => ({ type: 'wide', item: { type: 'device', device } }));
  for (let i = 0; i < half.length; i += 2) rows.push({ type: 'pair', items: half.slice(i, i + 2) });
  return rows;
}
