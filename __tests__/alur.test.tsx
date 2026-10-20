import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { deviceById, MAIN_AC_ID } from '@/sample/store';
import { advance, currentRoute, go, currentStack, mockParams, restoreParams, sampleState, showRoute } from './harness';

// Empat alur prototipe dari rencana Fase 0b, masing-masing dalam satu penyimpanan contoh dan satu tumpukan navigasi.

beforeEach(() => {
  jest.clearAllMocks();
  mockParams();
});
afterAll(restoreParams);

test('alur 1: tahan Inti, Mode Suara mematikan AC, Beranda dan Riwayat mencatatnya', async () => {
  await showRoute('/');
  expect(screen.getByText('AC kamar nyala · 24°')).toBeOnTheScreen();

  await fireEvent(screen.getByRole('button', { name: 'Bicara dengan Nadia' }), 'longPress');
  expect(router.navigate).toHaveBeenCalledWith('/suara');
  expect(currentRoute()).toBe('/suara');
  expect(deviceById(sampleState(), MAIN_AC_ID)!.on).toBe(true);

  await advance(3400); // masuk keadaan berbicara
  expect(deviceById(sampleState(), MAIN_AC_ID)!.on).toBe(false);
  await advance(4500);
  await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
  expect(router.back).toHaveBeenCalled();
  expect(currentRoute()).toBe('/');

  expect(screen.getByText('AC kamar mati')).toBeOnTheScreen();
  await go('/riwayat');
  expect(currentRoute()).toBe('/riwayat');
  // Satu entri baru dari suara, satu lagi contoh dari kemarin.
  expect(screen.getAllByText('Mematikan AC kamar')).toHaveLength(2);
  expect(screen.getByText(/lewat suara/)).toBeOnTheScreen();
});

test('alur 2: Lihat, Kirim, Dikirim 10.47, Batalkan di Riwayat dengan toast dan entri tercoret', async () => {
  await showRoute('/');
  expect(screen.getByText('Butuh persetujuan Anda')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Lihat' }));
  expect(currentRoute()).toBe('/chat');
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
  expect(screen.getByText('Dikirim 10.47')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Batalkan' })).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));
  expect(currentRoute()).toBe('/');
  expect(screen.queryByText('Butuh persetujuan Anda')).toBeNull();

  await go('/riwayat');
  expect(screen.getByText('Mengirim balasan ke Pak Budi')).toBeOnTheScreen();
  expect(screen.getByText('sampai 10.47')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
  expect(screen.getByText('Kiriman ke Pak Budi dibatalkan.')).toBeOnTheScreen();
  expect(screen.queryByText('sampai 10.47')).toBeNull();
  expect(screen.getByText('Mengirim balasan ke Pak Budi')).toHaveStyle({ textDecorationLine: 'line-through' });
});

test('alur 3: alarm Tunda 10 menit, kembali ke Agenda, item ditunda sampai 07.10', async () => {
  await showRoute('/agenda');
  await go('/alarm');
  expect(currentRoute()).toBe('/alarm');
  expect(screen.getByText('Berangkat ke bandara')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Tunda 10 menit' }));
  expect(currentRoute()).toBe('/agenda');
  await fireEvent.press(screen.getByRole('tab', { name: 'Minggu ini' }));
  expect(screen.getByText('Berangkat ke bandara')).toBeOnTheScreen();
  expect(screen.getByText('Ditunda sampai 07.10')).toBeOnTheScreen();
});

test('alur 4: Terhubung, Sambungkan TikTok Shop, Masuk, Selesai, Beranda punya 8 simpul', async () => {
  await showRoute('/');
  await fireEvent.press(screen.getByRole('button', { name: '7 terhubung · CCTV tidak terjangkau' }));
  expect(currentRoute()).toBe('/terhubung');
  await fireEvent.press(screen.getByRole('button', { name: 'Sambungkan TikTok Shop & Tokopedia' }));
  expect(currentRoute()).toBe('/terhubung/masuk');
  await fireEvent.press(screen.getByRole('button', { name: 'Masuk (contoh)' }));
  await advance(250);
  expect(currentRoute()).toBe('/terhubung/tersambung');
  expect(screen.getByText('TikTok Shop sudah terhubung')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
  expect(currentStack()).toEqual(['/']);
  expect(screen.getByText('8 terhubung · CCTV tidak terjangkau')).toBeOnTheScreen();
  expect(screen.getByTestId('simpul-tiktok')).toBeOnTheScreen();
});
