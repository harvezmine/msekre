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
import { RELEASE_TAIL_MS } from '@/voice/controller';
import { holdBridge } from '@/voice/holdBridge';
import { inPlace } from '@/voice/inPlace';

const HIDDEN = { includeHiddenElements: true };

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

test('tahan Inti besar di Beranda: bicara di tempat; dilepas: ucapan dikirim, jawaban di kartu di bawah Inti', async () => {
  await showRoute('/');
  await settle();
  await fireEvent(screen.getByRole('button', { name: 'Nadia' }), 'longPress');
  await settle();
  // Tetap di Beranda: Inti di tengah, cincin suara di sekitarnya, dan mikrofon langsung menyala.
  expect(currentRoute()).toBe('/');
  expect(stream.start).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('suara-cincin', HIDDEN)).toBeTruthy();
  expect(screen.getByTestId('suara-ditempat-ucapan')).toHaveTextContent('Mendengarkan…');
  expect(screen.getByText('Lepas untuk kirim')).toBeOnTheScreen();
  for (let i = 0; i < 6; i++) await act(async () => audio.emitBuffer(new Array<number>(1600).fill(9000)));

  await act(async () => inPlace.release());
  await advance(RELEASE_TAIL_MS);
  await settle();
  expect(stream.stop).toHaveBeenCalled();
  expect(screen.getByTestId('suara-ditempat-ucapan')).toHaveTextContent('Matikan AC kamar.');
  expect(screen.getByTestId('inti-berpikir', HIDDEN)).toBeTruthy();
  await advance(THINK_MS);
  expect(screen.getByTestId('suara-ditempat-balasan')).toHaveTextContent('Sudah. AC kamar saya matikan.');
  await fireEvent.press(screen.getByRole('button', { name: 'Buka percakapan' }));
  expect(currentRoute()).toBe('/chat');
});

test('tahan Inti bilah tab: Mode Suara layar penuh mendengar tanpa kilatan cahaya; dilepas: dikirim', async () => {
  await showRoute('/agenda');
  await settle();
  await fireEvent(screen.getByRole('button', { name: 'Nadia' }), 'longPress', {
    nativeEvent: { pageX: 196, pageY: 830 },
  });
  expect(currentRoute()).toBe('/suara');
  await settle();
  expect(stream.start).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Mendengar')).toBeOnTheScreen();
  // Tanpa cahaya pembuka: setengah layar atas tidak pernah berkedip hijau.
  expect(screen.queryByTestId('suara-cahaya-asal', HIDDEN)).toBeNull();
  for (let i = 0; i < 6; i++) await act(async () => audio.emitBuffer(new Array<number>(1600).fill(9000)));
  await act(async () => holdBridge.release());
  await advance(RELEASE_TAIL_MS);
  await settle();
  expect(stream.stop).toHaveBeenCalled();
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
