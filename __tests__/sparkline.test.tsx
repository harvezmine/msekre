import { screen } from '@testing-library/react-native';
import { renderWithProviders } from './helpers';
import { businessByPlace } from '@/sample/business';
import { Sparkline } from '@/ui/business/Sparkline';
import { sparkPoints } from '@/ui/business/sparkMath';

const SERIES = [3.1, 3.6, 2.9, 3.8, 4.4, 4.9, 4.25];

test('titik grafik memakai rumus spark() di desain', () => {
  const pts = sparkPoints(SERIES);
  expect(pts).toHaveLength(7);
  pts.forEach((p, i) => {
    expect(p.x).toBeCloseTo(8 + i * 50.7, 6);
    expect(p.y).toBeCloseTo(58 - ((SERIES[i]! - 2.6) / 2.5) * 50, 6);
  });
  expect(pts[0]).toEqual({ x: 8, y: 58 - ((3.1 - 2.6) / 2.5) * 50 });
});

test('rentang sendiri: nilai terendah di dasar, tertinggi di puncak', () => {
  const pts = sparkPoints([1, 2], 1, 1);
  expect(pts[0]!.y).toBe(58);
  expect(pts[1]!.y).toBe(8);
});

test('grafik menggambar 7 titik dan menandai titik hari ini', async () => {
  await renderWithProviders(<Sparkline series={SERIES} />);
  const line = screen.getByTestId('spark-garis');
  const nums = String(line.props.d)
    .match(/-?[\d.]+(?:e-?\d+)?/g)!
    .map(Number);
  expect(nums).toHaveLength(14);
  sparkPoints(SERIES).forEach((p, i) => {
    expect(nums[2 * i]).toBeCloseTo(p.x, 6);
    expect(nums[2 * i + 1]).toBeCloseTo(p.y, 6);
  });
  const mark = screen.getByTestId('spark-titik-hari-ini');
  const last = sparkPoints(SERIES)[6]!;
  expect(Number(mark.props.cx)).toBeCloseTo(last.x, 6);
  expect(Number(mark.props.cy)).toBeCloseTo(last.y, 6);
});

test('semua tempat punya 7 hari dan jumlah cabang sama dengan Semua', () => {
  const { Semua, 'Kedai Dago': dago, 'Kedai Riau': riau } = businessByPlace;
  for (const d of [Semua, dago, riau]) expect(d!.series).toHaveLength(7);
  Semua!.series.forEach((v, i) => expect(dago!.series[i]! + riau!.series[i]!).toBeCloseTo(v, 6));
});
