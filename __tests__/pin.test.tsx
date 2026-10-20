import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import Pin from '../app/pin';
import { renderWithProviders } from './helpers';
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
  );
}
async function type(digits: string) {
  for (const d of digits) await fireEvent.press(screen.getByRole('button', { name: d }));
}
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
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
  expect(latest.toast?.text).toBe('Atur ulang PIN dibangun di Fase 3.');
});

test('pintu depan: keterangannya "membuka"', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'pintu-depan' });
  await show();
  expect(screen.getByText('Untuk membuka Pintu depan.')).toBeOnTheScreen();
});
