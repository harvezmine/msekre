import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import Pin from '../app/pin';
import { ApiFailure } from '@/api/transport';
import { createTestApi, renderWithProviders } from './helpers';
import { deviceById, useSample, type SampleState } from '@/sample/store';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'kamera-tamu' });
});
afterAll(() => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

let latest: SampleState;
function Probe() {
  const { state } = useSample();
  useEffect(() => {
    latest = state;
  });
  return null;
}

async function show() {
  await renderWithProviders(
    <>
      <Pin />
      <Probe />
    </>,
    { api: createTestApi({ security: { pinEnabled: true, pin: '123456' } }) },
  );
}
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
/** Mengetik angka; PIN diperiksa server (janji), jadi beri waktu jawabannya sampai. */
async function type(digits: string) {
  for (const d of digits) await fireEvent.press(screen.getByRole('button', { name: d }));
  for (let i = 0; i < 4; i++) await advance(0);
}

test('lembar PIN: judul, nama perangkat, tombol dan Lupa PIN', async () => {
  await show();
  expect(screen.getByText('Masukkan PIN')).toBeOnTheScreen();
  expect(screen.getByText('Untuk mematikan Kamera ruang tamu.')).toBeOnTheScreen();
  for (const k of ['1', '5', '9', '0', 'Batal', 'Hapus', 'Lupa PIN?']) {
    expect(screen.getByRole('button', { name: k })).toBeOnTheScreen();
  }
  expect(screen.getByLabelText('PIN terisi 0 dari 6')).toBeOnTheScreen();
});

test('PIN benar mematikan kamera dan menutup lembar', async () => {
  await show();
  await type('123456');
  expect(deviceById(latest, 'kamera-tamu')!.on).toBe(false);
  await advance(250);
  expect(router.back).toHaveBeenCalled();
});

test('PIN salah: pesan muncul, titik dikosongkan, kamera tetap merekam', async () => {
  await show();
  await type('111111');
  expect(screen.getByText('PIN belum cocok, coba lagi.')).toBeOnTheScreen();
  expect(screen.getByLabelText('PIN terisi 0 dari 6')).toBeOnTheScreen();
  expect(deviceById(latest, 'kamera-tamu')!.on).toBe(true);
  expect(router.back).not.toHaveBeenCalled();
  // Mengetik lagi menghapus pesan dan bisa mencoba ulang dengan PIN benar.
  await type('1');
  expect(screen.queryByText('PIN belum cocok, coba lagi.')).toBeNull();
  await type('23456');
  expect(deviceById(latest, 'kamera-tamu')!.on).toBe(false);
});

test('Hapus menghapus satu angka dan Batal menutup tanpa mengubah apa pun', async () => {
  await show();
  await type('123');
  expect(screen.getByLabelText('PIN terisi 3 dari 6')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Hapus' }));
  expect(screen.getByLabelText('PIN terisi 2 dari 6')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Batal' }));
  await advance(250);
  expect(router.back).toHaveBeenCalled();
  expect(deviceById(latest, 'kamera-tamu')!.on).toBe(true);
});

test('Lupa PIN memunculkan toast', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Lupa PIN?' }));
  expect(latest.toast?.text).toBe('Atur ulang PIN segera hadir.');
});

test('pintu depan: keterangannya "membuka"', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'pintu-depan' });
  await show();
  expect(screen.getByText('Untuk membuka Pintu depan.')).toBeOnTheScreen();
});

test('PIN salah diumumkan ke pembaca layar', async () => {
  const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  await show();
  await type('111111');
  expect(spy).toHaveBeenCalledWith('PIN belum cocok, coba lagi.');
  spy.mockRestore();
});

test('selagi PIN diperiksa server, titik terkunci dan Hapus tidak berlaku', async () => {
  const api = createTestApi({ security: { pinEnabled: true, pin: '123456' }, latencyMs: 300 });
  await renderWithProviders(
    <>
      <Pin />
      <Probe />
    </>,
    { api },
  );
  for (const d of '123456') await fireEvent.press(screen.getByRole('button', { name: d }));
  expect(screen.getByLabelText('PIN terisi 6 dari 6')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Hapus' }));
  await fireEvent.press(screen.getByRole('button', { name: '9' }));
  expect(screen.getByLabelText('PIN terisi 6 dari 6')).toBeOnTheScreen();
  await advance(300);
  for (let i = 0; i < 4; i++) await advance(0);
  expect(deviceById(latest, 'kamera-tamu')!.on).toBe(false);
});

test('tanpa sinyal: pesan ramah, bukan "PIN salah", kamera tetap merekam', async () => {
  const api = createTestApi({ security: { pinEnabled: true, pin: '123456' } });
  jest.spyOn(api.transport, 'verifyPin').mockRejectedValue(new ApiFailure('network'));
  await renderWithProviders(
    <>
      <Pin />
      <Probe />
    </>,
    { api },
  );
  await type('123456');
  expect(screen.getByText('Lagi ada kendala, sudah dilaporkan ke tim. Coba lagi sebentar ya.')).toBeOnTheScreen();
  expect(deviceById(latest, 'kamera-tamu')!.on).toBe(true);
});

test('dua ketukan cepat sebelum render tidak menjatuhkan angka', async () => {
  await show();
  const one = screen.getByRole('button', { name: '1' });
  const two = screen.getByRole('button', { name: '2' });
  await act(async () => {
    await Promise.all([fireEvent.press(one), fireEvent.press(two)]);
  });
  expect(screen.getByLabelText('PIN terisi 2 dari 6')).toBeOnTheScreen();
});
