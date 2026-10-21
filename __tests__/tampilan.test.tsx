import { act, fireEvent, screen } from '@testing-library/react-native';
import { Appearance, StyleSheet, Text } from 'react-native';
import Akun from '../app/akun';
import Beranda from '../app/(tabs)/index';
import Tampilan from '../app/akun/tampilan';
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
  return <Text testID="probe">{`${scheme} ${c.paper}`}</Text>;
}

const show = async () => {
  const view = await renderWithProviders(
    <>
      <Probe />
      <Tampilan />
    </>,
    { appearance: true },
  );
  // Layar baru dipasang setelah pilihan tersimpan selesai dibaca.
  await screen.findByTestId('probe');
  return view;
};
const probe = () => screen.getByTestId('probe').props.children as string;
const radio = (name: string) => screen.getByRole('radio', { name });
const systemChange = async (next: 'light' | 'dark') => {
  phone = next;
  await act(async () => listener?.({ colorScheme: next }));
};

test('bawaannya Ikuti HP dan mengikuti mode HP, juga saat HP berganti', async () => {
  await show();
  expect(radio('Ikuti HP').props.accessibilityState.checked).toBe(true);
  expect(probe()).toBe(`light ${light.paper}`);
  await systemChange('dark');
  expect(probe()).toBe(`dark ${dark.paper}`);
  await systemChange('light');
  expect(probe()).toBe(`light ${light.paper}`);
});

test('Gelap berlaku seketika walau HP terang, dan diteruskan ke bagian native', async () => {
  await show();
  await fireEvent.press(radio('Gelap'));
  expect(probe()).toBe(`dark ${dark.paper}`);
  expect(radio('Gelap').props.accessibilityState.checked).toBe(true);
  expect(setScheme).toHaveBeenLastCalledWith('dark');
  await systemChange('light');
  expect(probe()).toBe(`dark ${dark.paper}`);
  await fireEvent.press(radio('Terang'));
  expect(setScheme).toHaveBeenLastCalledWith('light');
  expect(probe()).toBe(`light ${light.paper}`);
});

test('Ikuti HP mengembalikan ke sistem dan mengikuti HP lagi', async () => {
  phone = 'dark';
  await show();
  await fireEvent.press(radio('Terang'));
  expect(probe()).toBe(`light ${light.paper}`);
  await fireEvent.press(radio('Ikuti HP'));
  expect(setScheme).toHaveBeenLastCalledWith('unspecified');
  expect(probe()).toBe(`dark ${dark.paper}`);
});

test('pilihan tersimpan di HP dan dipakai lagi saat aplikasi dibuka ulang, sebelum layar tampil', async () => {
  const first = await show();
  await fireEvent.press(radio('Gelap'));
  expect(mockStore.get('tampilan')).toBe('dark');
  await first.unmount();
  setScheme.mockClear();
  await show();
  expect(probe()).toBe(`dark ${dark.paper}`);
  expect(setScheme).toHaveBeenCalledWith('dark');
});

test('nilai tersimpan yang tidak dikenal dianggap Ikuti HP', async () => {
  mockStore.set('tampilan', 'ungu');
  await show();
  expect(probe()).toBe(`light ${light.paper}`);
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
  expect(backgrounds).toContain(dark.paper.toLowerCase());
  expect(backgrounds).not.toContain(light.paper.toLowerCase());
});

test('baris Tampilan di Akun menunjukkan pilihan sekarang', async () => {
  await renderWithProviders(
    <>
      <Akun />
      <Tampilan />
    </>,
    { appearance: true },
  );
  expect(await screen.findByRole('button', { name: 'Tampilan. Ikuti HP' })).toBeTruthy();
  await fireEvent.press(radio('Gelap'));
  expect(screen.getByRole('button', { name: 'Tampilan. Gelap' })).toBeTruthy();
  await fireEvent.press(radio('Terang'));
  expect(screen.getByRole('button', { name: 'Tampilan. Terang' })).toBeTruthy();
});
