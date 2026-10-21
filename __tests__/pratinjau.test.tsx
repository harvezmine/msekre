import { act, fireEvent, screen, within } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { createApi } from '@/api/ApiProvider';
import { FAKE_WA_NUMBER } from '@/api/fake/FakeTransport';
import { deviceInfo } from '@/api/deviceInfo';
import Beranda from '../app/(tabs)/index';
import Mode from '../app/mode';
import NotFound from '../app/+not-found';
import Suara from '../app/suara';
import './audioMock';
import { createTestApi, renderWithProviders } from './helpers';

const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

// KeyboardAvoidingView jadi View biasa di tes; tiruan ini menandai `behavior`-nya supaya letak kolom ketik bisa diperiksa.
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const { View } = jest.requireActual('react-native');
  const { createElement } = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ behavior, children, style }: { behavior?: string; children?: unknown; style?: unknown }) =>
      createElement(View, { testID: `kav-${behavior}`, style }, children),
  };
});

beforeEach(() => jest.clearAllMocks());

describe('pratinjau: nomor WhatsApp contoh', () => {
  const config = Constants.expoConfig as { extra?: Record<string, unknown> };
  afterEach(() => {
    delete config.extra;
  });

  test('mode contoh memakai nomor sungguhan dari konfigurasi build', async () => {
    config.extra = { waNumber: '6288214533604' };
    const { transport } = createApi('contoh', null);
    const result = expect(transport.authStart({ phone: '6281200000000' })).rejects.toMatchObject({
      code: 'not_registered',
      waNumber: '6288214533604',
    });
    await advance(1000);
    await result;
    transport.dispose();
  });

  test('tanpa nomor di konfigurasi: bawaan server tiruan', async () => {
    const { transport } = createApi('contoh', null);
    const result = expect(transport.authStart({ phone: '6281200000000' })).rejects.toMatchObject({
      waNumber: FAKE_WA_NUMBER,
    });
    await advance(1000);
    await result;
    transport.dispose();
  });
});

test('deviceInfo: nama model dan jenis HP; kosong berarti tidak dikirim', () => {
  // expo-device ditiru jest-expo dengan modelName "mock".
  expect(deviceInfo()).toEqual({ name: 'mock', platform: 'ios' });
});

test('+not-found: kabar singkat dan jalan ke Beranda', async () => {
  await renderWithProviders(<NotFound />);
  expect(screen.getByText('Halaman ini tidak ada.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Ke Beranda' }));
  expect(router.replace).toHaveBeenCalledWith('/');
});

test('/mode tertutup di build rilis, terbuka di pengembangan', async () => {
  await renderWithProviders(<Mode />);
  expect(screen.getByText('Server')).toBeOnTheScreen();
  await screen.unmount();
  const g = globalThis as { __DEV__?: boolean };
  const dev = g.__DEV__;
  g.__DEV__ = false;
  try {
    await renderWithProviders(<Mode />);
    expect(screen.queryByText('Server')).toBeNull();
  } finally {
    g.__DEV__ = dev;
  }
});

test('Beranda di mode contoh bilang "Data contoh"; mode server tidak', async () => {
  await renderWithProviders(<Beranda />);
  expect(await screen.findByText('Data contoh')).toBeOnTheScreen();
  await screen.unmount();
  await renderWithProviders(<Beranda />, { api: createTestApi({ mode: 'server', token: 'token' }) });
  expect(await screen.findByText(/^Selamat /)).toBeOnTheScreen();
  expect(screen.queryByText('Data contoh')).toBeNull();
});

test('Mode Suara: kolom ketik ada di dalam KeyboardAvoidingView (edge-to-edge tidak mengecilkan jendela)', async () => {
  await renderWithProviders(<Suara />);
  await advance(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Ketik' }));
  const avoiding = screen.getByTestId('kav-padding');
  expect(within(avoiding).getByLabelText('Ketik pesan')).toBeOnTheScreen();
});
