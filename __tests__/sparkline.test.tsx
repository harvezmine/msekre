import { screen } from '@testing-library/react-native';
import { renderWithProviders } from './helpers';
import { businessFrom } from '@/api/fake/business';
import { AreaChart, areaPath, scalePoints, smoothPath } from '@/ui/kit';

const SERIES = [3.1, 3.6, 2.9, 3.8, 4.4, 4.9, 4.25];

test('titik grafik Usaha merata di lebar, nilai terbesar paling atas dan terkecil paling bawah', () => {
  const pts = scalePoints(SERIES, 320, 180, 8, 24);
  expect(pts).toHaveLength(7);
  expect(pts[0]![0]).toBe(8);
  expect(pts[6]![0]).toBe(312);
  const ys = pts.map((p) => p[1]);
  expect(Math.min(...ys)).toBe(ys[SERIES.indexOf(4.9)]);
  expect(Math.max(...ys)).toBe(ys[SERIES.indexOf(2.9)]);
  for (const y of ys) {
    expect(y).toBeGreaterThanOrEqual(24);
    expect(y).toBeLessThanOrEqual(176);
  }
});

test('kurva halus melewati setiap titik dan area menutup ke dasar', () => {
  const pts = scalePoints(SERIES, 320, 180);
  const d = smoothPath(pts);
  expect(d.startsWith(`M${pts[0]![0]},`)).toBe(true);
  expect((d.match(/C/g) ?? []).length).toBe(6);
  expect(areaPath(pts, 180).endsWith('Z')).toBe(true);
  expect(smoothPath([])).toBe('');
});

test('semua tempat punya 7 hari dan jumlah cabang sama dengan Semua', () => {
  const none = () => undefined;
  const [semua, dago, riau] = ['Semua', 'Kedai Dago', 'Kedai Riau'].map((p) => businessFrom(p, 'hari', none));
  for (const d of [semua, dago, riau]) expect(d!.series).toHaveLength(7);
  semua!.series.forEach((p, i) => expect(dago!.series[i]!.value + riau!.series[i]!.value).toBe(p.value));
});

test('grafik terbaca sebagai gambar bagi pembaca layar', async () => {
  await renderWithProviders(<AreaChart values={SERIES} accessibilityLabel="Grafik penjualan 7 hari terakhir" />);
  expect(screen.getByRole('image', { name: 'Grafik penjualan 7 hari terakhir' })).toBeOnTheScreen();
});
