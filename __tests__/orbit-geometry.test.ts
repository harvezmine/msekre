import { orbitLayout } from '@/ui/orbit/geometry';
import { ringLabel } from '@/ui/orbit/label';

test('simpul pertama ada di puncak cincin, garisnya dari Inti ke tepi simpul', () => {
  const { cx, cy, nodes } = orbitLayout(7);
  expect(cx).toBe(180);
  expect(cy).toBe(152);
  expect(nodes).toHaveLength(7);
  const top = nodes[0]!;
  expect(top.x).toBeCloseTo(180);
  expect(top.y).toBeCloseTo(26);
  expect(top.line.x1).toBeCloseTo(180);
  expect(top.line.y1).toBeCloseTo(72);
  expect(top.line.y2).toBeCloseTo(48);
});

test('dengan 4 simpul, simpul kedua ada di kanan', () => {
  const right = orbitLayout(4).nodes[1]!;
  expect(right.x).toBeCloseTo(306);
  expect(right.y).toBeCloseTo(152);
  expect(right.line.x1).toBeCloseTo(260);
  expect(right.line.x2).toBeCloseTo(284);
});

test('ukuran bisa diperkecil untuk layar 360', () => {
  const { cx, nodes } = orbitLayout(7, { W: 320, H: 270, r: 112, ri: 71 });
  expect(cx).toBe(160);
  expect(nodes[0]!.y).toBeCloseTo(135 - 112);
});

test('tulisan cincin menyebut yang tidak terjangkau', () => {
  const nodes = [{ label: 'Gmail' }, { label: 'CCTV', offline: true }, { label: 'Bank' }];
  expect(ringLabel(nodes)).toBe('3 terhubung · CCTV tidak terjangkau');
  expect(ringLabel([{ label: 'Gmail' }])).toBe('1 terhubung');
});
