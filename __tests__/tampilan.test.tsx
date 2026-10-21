import { act, fireEvent, screen } from '@testing-library/react-native';
import { Appearance, StyleSheet, Text } from 'react-native';
import Akun from '../app/akun';
import Beranda from '../app/(tabs)/index';
import { renderWithProviders } from './helpers';
import { useTheme } from '@/theme/ThemeProvider';
import { dark, light } from '@/theme/tokens';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

type Listener = (p: { colorScheme: 'light' | 'dark' | null }) => void;
let phone: 'light' | 'dark';
let listener: Listener | undefined;
let setScheme: jest.SpyInstance;
const spies: jest.SpyInstance[] = [];

beforeEach(() => {
  mockStore.clear();
  phone = 'light';
  listener = undefined;
  setScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
  spies.push(
    setScheme,
    jest.spyOn(Appearance, 'getColorScheme').mockImplementation(() => phone),
    jest.spyOn(Appearance, 'addChangeListener').mockImplementation(((l: Listener) => {
      listener = l;
      return { remove: jest.fn() };
    }) as never),
  );
});
// Hanya tiruan Appearance yang dikembalikan; restoreAllMocks juga menghapus isi tiruan expo-secure-store.
afterEach(() => spies.splice(0).forEach((s) => s.mockRestore()));

function Probe() {
  const { scheme, c } = useTheme();
  return <Text testID="probe">{`${scheme} ${c.bg}`}</Text>;
}

// Tampilan dipilih langsung di Akun: segmen Ikuti HP / Terang / Gelap, tanpa halaman sendiri.
const show = async () => {
  const view = await renderWithProviders(
    <>
      <Probe />
      <Akun />
    </>,
    { appearance: true },
  );
  // Layar baru dipasang setelah pilihan tersimpan selesai dibaca.
  await screen.findByTestId('probe');
  return view;
};
const probe = () => screen.getByTestId('probe').props.children as string;
const option = (name: string) => screen.getByRole('tab', { name });
const systemChange = async (next: 'light' | 'dark') => {
  phone = next;
  await act(async () => listener?.({ colorScheme: next }));
};

test('bawaannya Ikuti HP dan mengikuti mode HP, juga saat HP berganti', async () => {
  await show();
  expect(option('Ikuti HP')).toBeSelected();
  expect(probe()).toBe(`light ${light.bg}`);
  await systemChange('dark');
  expect(probe()).toBe(`dark ${dark.bg}`);
  await systemChange('light');
  expect(probe()).toBe(`light ${light.bg}`);
});

test('Gelap berlaku seketika walau HP terang, dan diteruskan ke bagian native', async () => {
  await show();
  await fireEvent.press(option('Gelap'));
  expect(probe()).toBe(`dark ${dark.bg}`);
  expect(option('Gelap')).toBeSelected();
  expect(option('Ikuti HP')).not.toBeSelected();
  expect(setScheme).toHaveBeenLastCalledWith('dark');
  await systemChange('light');
  expect(probe()).toBe(`dark ${dark.bg}`);
  await fireEvent.press(option('Terang'));
  expect(setScheme).toHaveBeenLastCalledWith('light');
  expect(probe()).toBe(`light ${light.bg}`);
});

test('Ikuti HP mengembalikan ke sistem dan mengikuti HP lagi', async () => {
  phone = 'dark';
  await show();
  await fireEvent.press(option('Terang'));
  expect(probe()).toBe(`light ${light.bg}`);
  await fireEvent.press(option('Ikuti HP'));
  expect(setScheme).toHaveBeenLastCalledWith('unspecified');
  expect(probe()).toBe(`dark ${dark.bg}`);
});

test('pilihan tersimpan di HP dan dipakai lagi saat aplikasi dibuka ulang, sebelum layar tampil', async () => {
  const first = await show();
  await fireEvent.press(option('Gelap'));
  expect(mockStore.get('tampilan')).toBe('dark');
  await first.unmount();
  setScheme.mockClear();
  await show();
  expect(probe()).toBe(`dark ${dark.bg}`);
  expect(setScheme).toHaveBeenCalledWith('dark');
});

test('nilai tersimpan yang tidak dikenal dianggap Ikuti HP', async () => {
  mockStore.set('tampilan', 'ungu');
  await show();
  expect(probe()).toBe(`light ${light.bg}`);
  expect(setScheme).not.toHaveBeenCalled();
});

test('Beranda berlatar gelap di seluruh aplikasi walau HP terang', async () => {
  mockStore.set('tampilan', 'dark');
  await renderWithProviders(<Beranda />, { appearance: true });
  const backgrounds: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n === 'string') return;
    const node = n as { props?: { style?: never }; children?: unknown[] };
    const bg = (StyleSheet.flatten(node.props?.style) as { backgroundColor?: string } | undefined)?.backgroundColor;
    if (bg) backgrounds.push(bg.toLowerCase());
    node.children?.forEach(walk);
  };
  [screen.toJSON()].flat().forEach(walk);
  expect(backgrounds).toContain(dark.bg.toLowerCase());
  expect(backgrounds).not.toContain(light.bg.toLowerCase());
});

test('Akun tidak lagi punya halaman Tampilan: pilihannya ada di baris itu sendiri', async () => {
  await show();
  expect(screen.queryByRole('button', { name: /^Tampilan/ })).toBeNull();
  expect(screen.getByText('Tampilan')).toBeOnTheScreen();
  await fireEvent.press(option('Terang'));
  expect(option('Terang')).toBeSelected();
  expect(mockStore.get('tampilan')).toBe('light');
});
