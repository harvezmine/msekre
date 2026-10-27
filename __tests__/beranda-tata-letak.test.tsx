import { act, screen, within } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet } from 'react-native';
import { getAnimatedStyle as animatedStyle } from 'react-native-reanimated';
import Beranda from '../app/(tabs)/index';
import { renderWithProviders } from './helpers';
import { newUserSampleState } from '@/sample/fresh';
import { heroMetrics, PLACEHOLDER_NODES, webLayout, type WebNode } from '@/ui/beranda/heroLayout';
import { TabBar } from '@/ui/TabBar';

// Ukuran layar diganti per tes: 393×873 (HP panjang acuan), 360×640 (pendek), 412×915.
let mockDims = { width: 393, height: 873, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims,
}));

const settle = () =>
  act(async () => {
    for (let i = 0; i < 3; i++) await Promise.resolve();
  });

const tabProps = {
  state: { index: 0, routes: ['index', 'agenda', 'perangkat', 'usaha'].map((name) => ({ key: name, name })) },
  descriptors: {},
  emitter: { emit: () => ({ defaultPrevented: false }) },
  navigateToTab: () => {},
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
} as unknown as BottomTabBarProps;

async function show(width: number, height: number, state?: typeof newUserSampleState) {
  mockDims = { width, height, scale: 3, fontScale: 1 };
  await renderWithProviders(
    <>
      <Beranda />
      <TabBar {...tabProps} />
    </>,
    { state },
  );
  await settle();
}

const HIDDEN = { includeHiddenElements: true };
const getAnimatedStyle = animatedStyle as unknown as (el: unknown) => { marginTop: number };
/** Jarak Inti besar dari sapaan (bergerak saat Inti turun di halaman tanpa blok). */
const heroMargin = () => getAnimatedStyle(screen.getByTestId('beranda-inti')).marginTop;
const style = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, number>;
/** Garis tengah Inti besar (di atas Beranda) dan Inti bilah tab. */
const heroOrb = () => style(within(screen.getByTestId('inti-besar', HIDDEN)).getByTestId('inti-bola', HIDDEN)).width;
const tabOrb = () => style(within(screen.getByTestId('inti-tab', HIDDEN)).getByTestId('inti-bola', HIDDEN)).width;

/** Ukuran per kelas layar: Inti besar, kotak jaring, ubin simpul, jumlah simpul paling banyak. */
const UKURAN = [
  { w: 360, h: 640, cls: 'compact', inti: 134, box: 194, node: 28, max: 5, tile: 104 },
  { w: 393, h: 873, cls: 'tall', inti: 173, box: 237, node: 32, max: 7, tile: 132 },
  { w: 412, h: 915, cls: 'tall', inti: 181, box: 275, node: 32, max: 7, tile: 132 },
] as const;

test.each(UKURAN)(
  '$w×$h ($cls): Inti besar $inti, kotak jaring $box, ubin simpul $node, paling banyak $max simpul; Inti bilah tab 48',
  async ({ w, h, cls, inti, box, node, max, tile }) => {
    const m = heroMetrics(w, h);
    expect(m).toMatchObject({ cls, inti, height: box, node, maxNodes: max });
    await show(w, h);
    // Bilah atas aplikasi berukuran sama di semua HP (judul 20).
    expect(style(within(screen.getByTestId('bilah-atas')).getByRole('header')).fontSize).toBe(20);
    expect(style(screen.getByTestId('favorit-ac-kamar')).minHeight).toBe(tile);
    expect(heroOrb()).toBe(inti);
    expect(style(screen.getByTestId('inti-besar', HIDDEN))).toMatchObject({ width: w, height: box });
    // Inti bilah tab tetap kecil di Beranda (tidak membesar atau naik di atas bilah).
    expect(tabOrb()).toBe(48);
  },
);

test('Inti besar mengikuti layar: kira-kira 0,44 × lebar, dibatasi tinggi layar; HP pendek lebih kecil', () => {
  expect(heroMetrics(360, 800).inti).toBe(164);
  expect(heroMetrics(412, 780)).toMatchObject({ cls: 'regular', inti: 172, node: 30, maxNodes: 6 });
  expect(heroMetrics(480, 1000).inti).toBe(208);
  expect(heroMetrics(320, 568).inti).toBe(124);
});

/** Ukuran yang diuji untuk tata letak jaring, termasuk HP sedang dan lipat kecil. */
const LAYAR = [
  [360, 640],
  [393, 873],
  [412, 915],
  [360, 800],
  [412, 780],
  [320, 568],
  [480, 1000],
] as const;

test.each(LAYAR)(
  'jaring %ix%i: semua simpul di dalam layar, tidak menempel Inti, tidak bertumpuk, seimbang kiri-kanan',
  (w, h) => {
    const m = heroMetrics(w, h);
    for (let n = 1; n <= m.maxNodes; n++) {
      const nodes: WebNode[] = Array.from({ length: n }, (_, i) => ({ key: `k${i}`, icon: 'link', label: `L${i}` }));
      const { cx, cy, points, links } = webLayout(m, nodes);
      expect(points).toHaveLength(n);
      const reach = m.node / 2 + m.drift;
      let left = 0;
      for (const p of points) {
        // Tepi ubin (termasuk melayang) paling dekat 16 dp dari tepi layar, dan di dalam kotak jaring.
        expect(p.x - reach).toBeGreaterThanOrEqual(16);
        expect(p.x + reach).toBeLessThanOrEqual(w - 16);
        expect(p.y - reach).toBeGreaterThanOrEqual(0);
        expect(p.y + reach).toBeLessThanOrEqual(m.height);
        // Jari-jari terpendek tetap terlihat sebagai garis.
        expect(Math.hypot(p.x - cx, p.y - cy)).toBeGreaterThanOrEqual(m.inti / 2 + m.node / 2 + 20);
        expect(p.spoke.length).toBeGreaterThanOrEqual(15);
        if (p.x < cx) left += 1;
      }
      for (const a of points) {
        for (const b of points) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(m.node + 8);
      }
      if (n >= 2) {
        expect(left).toBeGreaterThanOrEqual(1);
        expect(n - left).toBeGreaterThanOrEqual(1);
      }
      expect(links.length).toBeLessThanOrEqual(2);
      if (n >= 4) expect(links).toHaveLength(2);
    }
  },
);

/** testID di layar, dari atas ke bawah. */
function idsInOrder(): string[] {
  const ids: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const node = n as { props?: { testID?: string }; children?: unknown[] };
    if (node.props?.testID) ids.push(node.props.testID);
    node.children?.forEach(walk);
  };
  [screen.toJSON()].flat().forEach(walk);
  return ids;
}

test('dengan blok: Inti besar tepat di bawah sapaan (tanpa turun), ketiga blok di bawahnya', async () => {
  await show(393, 873);
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
  expect(heroMargin()).toBe(6);
  const ids = idsInOrder().filter((id) => id === 'beranda-inti' || id.startsWith('blok-'));
  expect(ids).toEqual(['beranda-inti', 'blok-persetujuan', 'blok-agenda', 'blok-favorit']);
});

test('pengguna baru: Inti, lalu widget cuaca dan agenda, lalu kartu Coba bilang; tanpa Inti yang diturunkan', async () => {
  await show(393, 873, newUserSampleState);
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
  expect(heroMargin()).toBe(6);
  const ids = idsInOrder().filter((id) => id === 'beranda-inti' || id.startsWith('blok-'));
  expect(ids).toEqual(['beranda-inti', 'blok-agenda', 'blok-saran']);
  expect(webLayout(heroMetrics(393, 873), PLACEHOLDER_NODES).points).toHaveLength(3);
});

test('HP panjang: ruang lentur dibagi di atas Inti dan di atas widget, kartu contoh paling bawah (zona jempol)', async () => {
  await show(393, 873, newUserSampleState);
  const card = screen.getByTestId('blok-saran');
  const parent = card.parent!;
  const siblings = parent.children.filter((c): c is typeof card => typeof c !== 'string');
  expect(siblings.indexOf(card)).toBe(siblings.length - 1);
  const hero = siblings.findIndex((c) => c.props.testID === 'beranda-inti');
  expect(style(siblings[hero - 1]!).flexGrow).toBe(2);
  const grow = siblings.map((c) => style(c).flexGrow).filter((g) => g !== undefined);
  expect(grow).toEqual([2, 3]);
});
