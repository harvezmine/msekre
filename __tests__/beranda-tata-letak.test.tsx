import { act, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet } from 'react-native';
import Beranda from '../app/(tabs)/index';
import { renderWithProviders } from './helpers';
import { newUserSampleState } from '@/sample/fresh';
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

const style = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, number>;
const orbSize = () => style(screen.getByTestId('inti-bola', { includeHiddenElements: true })).width;

test.each([
  [393, 873],
  [412, 915],
])('HP panjang %ix%i: sapaan 32, ubin 132, Inti 92', async (w, h) => {
  await show(w, h);
  expect(style(screen.getByText('Pagi, Rina')).fontSize).toBe(32);
  expect(style(screen.getByTestId('favorit-ac-kamar')).minHeight).toBe(132);
  expect(orbSize()).toBe(92);
});

test('HP pendek 360x640 (compact): sapaan 28, ubin 104, Inti 76', async () => {
  await show(360, 640);
  expect(style(screen.getByText('Pagi, Rina')).fontSize).toBe(28);
  expect(style(screen.getByTestId('favorit-ac-kamar')).minHeight).toBe(104);
  expect(orbSize()).toBe(76);
});

test('HP panjang: blok di atas, ruang kosong lentur di bawahnya, kartu contoh di zona jempol tepat di atas Inti', async () => {
  await show(393, 873, newUserSampleState);
  const card = screen.getByTestId('blok-saran');
  const parent = card.parent!;
  const siblings = parent.children.filter((c): c is typeof card => typeof c !== 'string');
  const at = siblings.indexOf(card);
  // Tepat sebelum kartu: spacer lentur (bukan jarak tetap dari atas).
  expect(style(siblings[at - 1]!).flexGrow).toBe(1);
  expect(at).toBe(siblings.length - 1);
});
