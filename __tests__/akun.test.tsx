import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { WA_UNAVAILABLE_TEXT } from '@/api/account';
import Akun from '../app/akun';
import Beranda from '../app/(tabs)/index';
import Usaha from '../app/(tabs)/usaha';
import { createTestApi, renderWithProviders, toastNow, useSample } from './helpers';
import { type SampleState } from '@/sample/store';
import { dark } from '@/theme/tokens';

beforeEach(() => jest.clearAllMocks());

let latest: SampleState;
function Probe() {
  const { state } = useSample();
  useEffect(() => {
    latest = state;
  });
  return null;
}
const show = (scheme?: 'dark') =>
  renderWithProviders(
    <>
      <Akun />
      <Probe />
    </>,
    { scheme },
  );
const row = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}\\.?`) });

test('profil, langganan, dan catatan PIN tanpa pembayaran', async () => {
  await show();
  expect(screen.getByText('Rina Wulandari')).toBeTruthy();
  expect(screen.getByText('+62 812-2045-7781')).toBeTruthy();
  expect(await screen.findByText('Paket Bisnis')).toBeTruthy();
  expect(screen.getByText('Aktif sampai 12 Jan 2027')).toBeTruthy();
  // PIN opsional, bawaan mati.
  expect(await screen.findByRole('button', { name: 'PIN. Mati' })).toBeTruthy();
  // Versi dan nomor build dari aplikasi terpasang (expo-application, tiruan di jest.setup.ts).
  expect(screen.getByText('Versi 1.0.0 (7)')).toBeTruthy();
});

test('Terhubung dan Riwayat membuka layarnya; jumlah layanan dari penyimpanan', async () => {
  await show();
  expect(screen.getByText(`${latest.services.length} layanan dan perangkat`)).toBeTruthy();
  await fireEvent.press(row('Terhubung'));
  expect(router.push).toHaveBeenCalledWith('/terhubung');
  await fireEvent.press(row('Riwayat'));
  expect(router.push).toHaveBeenCalledWith('/riwayat');
});

test('PIN membuka Keamanan; keterangannya mengikuti keadaan PIN', async () => {
  const api = createTestApi({ security: { pinEnabled: true, pin: '123456' } });
  await renderWithProviders(<Akun />, { api });
  await fireEvent.press(await screen.findByRole('button', { name: 'PIN. Aktif' }));
  expect(router.push).toHaveBeenCalledWith('/akun/keamanan');
});

test('Bantuan di mode contoh memunculkan toast "segera hadir"', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: /^Bantuan/ }));
  expect(toastNow()?.text).toBe('Bantuan segera hadir.');
  expect(router.push).not.toHaveBeenCalled();
});

test('baris pengaturan membuka halamannya', async () => {
  await show();
  expect(await screen.findByRole('button', { name: 'Nama dan gaya asisten. Nadia · ramah' })).toBeTruthy();
  const opened: [string, string][] = [
    ['Nama dan gaya asisten', '/akun/asisten'],
    ['Sapaan harian', '/akun/sapaan'],
    ['Privasi', '/akun/privasi'],
    ['Notifikasi', '/akun/notifikasi'],
    ['HP yang terhubung', '/akun/hp'],
  ];
  for (const [title, route] of opened) {
    await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${title}`) }));
    expect(router.push).toHaveBeenLastCalledWith(route);
  }
  expect(screen.getByRole('button', { name: 'Sapaan harian. Tiap hari jam 07.00' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'HP yang terhubung. Pixel 8 (HP ini) dan 1 lainnya' })).toBeTruthy();
});

test('mode server: Bantuan tanpa nomor WhatsApp memberi kalimat ramah, tanpa menyebut fase atau isian contoh', async () => {
  const api = createTestApi({ mode: 'server', token: 'tok' });
  await renderWithProviders(
    <>
      <Akun />
      <Probe />
    </>,
    { api },
  );
  await fireEvent.press(screen.getByRole('button', { name: /^Bantuan/ }));
  expect(toastNow()?.text).toBe(WA_UNAVAILABLE_TEXT);
  expect(toastNow()?.text).not.toMatch(/Fase|dibangun/);
  // Tidak ada keterangan contoh milik akun lain.
  expect(screen.queryByText(/ramah dan singkat/)).toBeNull();
});

test('bagian Coba (hanya development) membuka layar uji', async () => {
  await show();
  await fireEvent.press(row('Layar pertama kali'));
  expect(router.push).toHaveBeenLastCalledWith('/mulai');
  await fireEvent.press(row('Alarm'));
  expect(router.push).toHaveBeenLastCalledWith('/alarm');
  await fireEvent.press(row('Pemeriksa Inti'));
  expect(router.push).toHaveBeenLastCalledWith('/inti');
});

test('mode contoh: Coba tampil (jalan ke layar pertama kali); Mode data hanya untuk pengembangan', async () => {
  await show();
  expect(screen.getByText('Coba')).toBeOnTheScreen();
  expect(screen.getByText('Mode data')).toBeOnTheScreen(); // Jest berjalan sebagai __DEV__
  const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  try {
    await screen.unmount();
    await show();
    expect(screen.getByText('Coba')).toBeOnTheScreen();
    expect(screen.getByText('Layar pertama kali')).toBeOnTheScreen();
    expect(screen.queryByText('Mode data')).toBeNull();
    expect(screen.queryByText('Pemeriksa Inti')).toBeNull();
  } finally {
    (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
  }
});

test('avatar RW di Beranda membuka Akun', async () => {
  await renderWithProviders(<Beranda />);
  await fireEvent.press(screen.getByRole('button', { name: 'Akun' }));
  expect(router.push).toHaveBeenLastCalledWith('/akun');
});

test('avatar RW di Usaha membuka Akun', async () => {
  await renderWithProviders(<Usaha />);
  await fireEvent.press(screen.getByRole('button', { name: 'Akun' }));
  expect(router.push).toHaveBeenLastCalledWith('/akun');
});

test('mode gelap memakai warna gelap', async () => {
  await show('dark');
  expect(screen.getByText('Rina Wulandari')).toHaveStyle({ color: dark.text });
});

test('Keluar membuka lembar konfirmasi', async () => {
  await show();
  await fireEvent.press(row('Keluar'));
  expect(router.push).toHaveBeenCalledWith('/keluar');
});
