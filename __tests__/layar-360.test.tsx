import { act, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { LAYAR } from './daftar-layar';
import { renderWithProviders } from './helpers';
import Beranda from '../app/(tabs)/index';
import DetailPerangkat from '../app/perangkat/[id]';

// Ponsel sempit: 360 x 740 dp. Hanya useWindowDimensions yang dipakai kode aplikasi (tidak ada Dimensions.get).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 3, fontScale: 1 }),
}));

afterEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({}));

test('mock lebar 360 berlaku', () => {
  expect(useWindowDimensions().width).toBe(360);
});

describe.each(LAYAR)('lebar 360: $nama', ({ Layar, params, actions, state }) => {
  test('tampil tanpa crash', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue(params ?? {});
    await renderWithProviders(<Layar />, { actions, state });
    expect(screen.toJSON()).not.toBeNull();
  });
});

test('Beranda di 360: tiga sakelar favorit berbagi lebar dalam satu baris, tepi 16 dp', async () => {
  await renderWithProviders(<Beranda />);
  await act(async () => {});
  const row = screen.getByTestId('blok-favorit');
  expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row', paddingHorizontal: 16 });
  for (const id of ['ac-kamar', 'lampu-teras', 'tv-ruang-tamu']) {
    expect(StyleSheet.flatten(screen.getByTestId(`favorit-${id}`).props.style).flex).toBe(1);
  }
});

test('dial suhu muat di 360 (740 tinggi = tall): 320 dp, gutter 20 di kedua sisi', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'ac-kamar' });
  await renderWithProviders(<DetailPerangkat />);
  const w = StyleSheet.flatten(screen.getByTestId('putaran-suhu').props.style).width as number;
  expect(w).toBe(2 * (134 + 26));
  expect(w + 2 * 20).toBeLessThanOrEqual(360);
});
