import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import Akun from '../app/akun';
import Beranda from '../app/(tabs)/index';
import Usaha from '../app/(tabs)/usaha';
import { createTestApi, renderWithProviders } from './helpers';
import { useSample, type SampleState } from '@/sample/store';
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
  expect(screen.getByText('Paket Bisnis')).toBeTruthy();
  expect(screen.getByText('Aktif sampai 12 Jan 2027')).toBeTruthy();
  // PIN opsional, bawaan mati.
  expect(await screen.findByRole('button', { name: 'PIN. Mati' })).toBeTruthy();
  expect(screen.getByText('Versi 1.0')).toBeTruthy();
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

test('baris lain memunculkan toast yang menyebut fase', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Kelola' }));
  expect(latest.toast?.text).toBe('Kelola langganan dibangun di Fase 5.');
  expect(router.push).not.toHaveBeenCalled();
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
  expect(screen.getByText('Rina Wulandari')).toHaveStyle({ color: dark.ink });
});

test('Keluar membuka lembar konfirmasi', async () => {
  await show();
  await fireEvent.press(row('Keluar'));
  expect(router.push).toHaveBeenCalledWith('/keluar');
});
