import { act, fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import Beranda from '../app/(tabs)/index';
import Suara from '../app/suara';
import { audio, stream } from './audioMock';
import { advance, currentRoute, mockParams, restoreParams, showRoute } from './harness';
import { renderWithProviders } from './helpers';
import { THINK_MS } from '@/sample/chat';
import { newUserSampleState } from '@/sample/fresh';
import { TIP_TEXT } from '@/ui/tips';
import { holdBridge } from '@/voice/holdBridge';

// Penyimpanan HP di memori: tanda petunjuk yang sudah dilihat bertahan antar pembukaan aplikasi.
const mockStore = new Map<string, string>();
jest.mock('@/api/secureStore', () => ({
  readSecure: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  writeSecure: jest.fn(async (key: string, value: string | null) => {
    if (value === null) mockStore.delete(key);
    else mockStore.set(key, value);
    return true;
  }),
  secureStore: () => null,
}));

async function settle() {
  for (let i = 0; i < 3; i++) await advance(0);
}

beforeEach(() => {
  jest.clearAllMocks();
  audio.reset();
  mockParams();
});
afterAll(restoreParams);

test('tahan Inti di Beranda: Mode Suara terbuka dan langsung mendengar; jari diangkat: ucapan dikirim', async () => {
  await showRoute('/');
  await settle();
  await fireEvent(screen.getByRole('button', { name: 'Nadia' }), 'longPress');
  expect(currentRoute()).toBe('/suara');
  await settle();
  // Tanpa menekan apa pun di Mode Suara: mikrofon sudah menyala.
  expect(stream.start).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Mendengar')).toBeOnTheScreen();
  for (let i = 0; i < 6; i++) await act(async () => audio.emitBuffer(new Array<number>(1600).fill(9000)));

  // Jari diangkat dari Inti yang sama (di aplikasi Pressable-nya masih terpasang di bawah Mode Suara).
  await act(async () => holdBridge.release());
  await settle();
  expect(stream.stop).toHaveBeenCalled();
  expect(screen.getByText('Sebentar…')).toBeOnTheScreen();
  expect(screen.getByTestId('suara-ucapan')).toHaveTextContent('Matikan AC kamar.');
  await advance(THINK_MS);
  expect(screen.getByTestId('suara-balasan')).toHaveTextContent('Sudah. AC kamar saya matikan.');
});

test('jari sudah diangkat sebelum Mode Suara siap: tidak mendengar', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ hold: '1' });
  await renderWithProviders(<Suara />);
  await act(async () => {});
  expect(stream.start).not.toHaveBeenCalled();
  expect(screen.getByText('Tahan Inti sambil bicara')).toBeOnTheScreen();
});

test('petunjuk Inti hanya sekali: ditutup, lalu tidak muncul lagi saat aplikasi dibuka ulang', async () => {
  mockStore.clear();
  await renderWithProviders(<Beranda />, { state: newUserSampleState, tips: 'unknown' });
  await act(async () => {});
  expect(screen.getByText(TIP_TEXT.inti)).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('petunjuk'));
  expect(screen.queryByText(TIP_TEXT.inti)).toBeNull();
  expect(mockStore.get('petunjuk.inti')).toBe('1');
  await screen.unmount();

  await renderWithProviders(<Beranda />, { state: newUserSampleState, tips: 'unknown' });
  await act(async () => {});
  expect(screen.queryByText(TIP_TEXT.inti)).toBeNull();
  expect(screen.getByText('Coba bilang')).toBeOnTheScreen();
});
