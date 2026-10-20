import { screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { LAYAR } from './daftar-layar';
import { renderWithProviders } from './helpers';
import Beranda from '../app/(tabs)/index';
import DetailPerangkat from '../app/perangkat/[id]';
import { DIAL } from '@/ui/device/dialMath';

// Ponsel sempit: 360 x 740 dp. Hanya useWindowDimensions yang dipakai kode aplikasi (tidak ada Dimensions.get).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 3, fontScale: 1 }),
}));

afterEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({}));

test('mock lebar 360 berlaku', () => {
  expect(useWindowDimensions().width).toBe(360);
});

describe.each(LAYAR)('lebar 360: $nama', ({ Layar, params, actions }) => {
  test('tampil tanpa crash', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue(params ?? {});
    await renderWithProviders(<Layar />, { actions });
    expect(screen.toJSON()).not.toBeNull();
  });
});

test('cincin Beranda mengecil di bawah 360 dan tetap muat di antara gutter 20 dp', async () => {
  await renderWithProviders(<Beranda />);
  const w = StyleSheet.flatten(screen.getByTestId('cincin').props.style).width as number;
  expect(w).toBeLessThan(360);
  expect(w).toBeLessThanOrEqual(360 - 40);
});

test('putaran suhu muat di 360: 280 dp ditambah gutter 16 di kedua sisi tidak lebih dari 320', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'ac-kamar' });
  await renderWithProviders(<DetailPerangkat />);
  const w = StyleSheet.flatten(screen.getByTestId('putaran-suhu').props.style).width as number;
  expect(w).toBe(DIAL.size);
  expect(w + 2 * 16).toBeLessThanOrEqual(320);
});
