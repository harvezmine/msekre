import { screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import RemotePerangkat from '../app/perangkat/[id]';
import Perangkat from '../app/(tabs)/perangkat';
import { renderWithProviders } from './helpers';

// Remote dan Perangkat di layar pendek (360×640, `compact`) dan HP panjang (412×915, `tall`): kontrol utama tetap
// besar, sedikit mengecil di layar pendek supaya semuanya muat di atas zona jempol.
let mockSize = { width: 360, height: 640, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockSize,
}));

afterEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({}));

const width = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID, { includeHiddenElements: true }).props.style).width as number;

async function remote(id: string) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id });
  await renderWithProviders(<RemotePerangkat />);
}

describe.each([
  ['360×640 (compact)', { width: 360, height: 640 }, { dial: 268, power: 88, dpad: 216, mode: 60 }],
  ['412×915 (tall)', { width: 412, height: 915 }, { dial: 320, power: 100, dpad: 264, mode: 64 }],
] as const)('%s', (_name, size, expected) => {
  beforeEach(() => {
    mockSize = { ...size, scale: 3, fontScale: 1 };
  });

  test('AC: dial, tombol mode, dan daya sesuai kelas', async () => {
    await remote('ac-kamar');
    expect(width('putaran-suhu')).toBe(expected.dial);
    expect(width('tombol-daya')).toBe(expected.power);
    const kering = screen.getByRole('button', { name: 'Kering' });
    expect(StyleSheet.flatten(kering.props.style).width).toBe(expected.mode);
  });

  test('TV: D-pad sesuai kelas; tombol utama tidak di bawah 56', async () => {
    await remote('tv-ruang-tamu');
    expect(width('dpad')).toBe(expected.dpad);
    for (const name of ['Kembali di TV', 'Beranda di TV', 'Bisukan']) {
      expect(StyleSheet.flatten(screen.getByRole('button', { name }).props.style).width).toBeGreaterThanOrEqual(56);
    }
  });

  test('Perangkat: dua kolom ubin dengan tepi 16 dan jarak 12', async () => {
    await renderWithProviders(<Perangkat />, { actions: [{ type: 'setPlace', place: 'Rumah' }] });
    const half = (size.width - 16 * 2 - 12) / 2;
    expect(StyleSheet.flatten(screen.getByTestId('ubin-lampu-utama').props.style).width).toBe(half);
    expect(StyleSheet.flatten(screen.getByTestId('ubin-ac-kamar').props.style).width).toBe(size.width - 32);
  });
});
