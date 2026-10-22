import { act, fireEvent, screen, within } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { HELP_TEXT, WA_UNAVAILABLE_TEXT } from '@/api/account';
import { waUrl } from '@/api/waNumber';
import Akun from '../app/akun';
import Beranda from '../app/(tabs)/index';
import Usaha from '../app/(tabs)/usaha';
import { createTestApi, renderWithProviders, toastNow, useSample } from './helpers';
import { useEffect } from 'react';
import { type SampleState } from '@/sample/store';
import { dark } from '@/theme/tokens';

const config = Constants.expoConfig as { extra?: Record<string, unknown> };

beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  delete config.extra;
  jest.restoreAllMocks();
});

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
const row = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}(\\.|$)`) });

/** Baris pengaturan Akun: yang bisa ditekan, selain Perpanjang, Keluar, dan Coba. */
const ROWS = ['Asisten', 'Pemberitahuan', 'Keamanan', 'Layanan tersambung', 'Bantuan'];

test('profil: avatar bercincin, nama, paket satu baris dengan Perpanjang; tanpa nomor contoh', async () => {
  await show();
  expect(screen.getByText('Rina Wulandari')).toBeTruthy();
  // Avatar hanya hiasan (tersembunyi dari pembaca layar), jadi dicari bersama elemen tersembunyi.
  expect(screen.getByTestId('avatar-profil', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.getByText('RW', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(await screen.findByText(/^Aktif sampai 12 Jan/)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Perpanjang' })).toBeOnTheScreen();
  // Bukan masa coba: tanpa batang hari.
  expect(screen.queryByTestId('batang-hari')).toBeNull();
  expect(screen.queryByText('+62 812-2045-7781')).toBeNull();
  // Versi dan nomor build dari aplikasi terpasang (expo-application, tiruan di jest.setup.ts).
  expect(screen.getByText('Versi 1.0.0 (7)')).toBeTruthy();
});

test('enam baris paling banyak, judul satu-dua kata, nilai di kanan, tanpa kalimat keterangan', async () => {
  await show();
  expect(await screen.findByRole('button', { name: 'Asisten. Nadia' })).toBeOnTheScreen();
  // Di luar PushProvider izin notifikasi belum diberikan.
  expect(screen.getByRole('button', { name: 'Pemberitahuan. Perlu izin' })).toBeOnTheScreen();
  expect(await screen.findByRole('button', { name: 'Keamanan. Mati' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: `Layanan tersambung. ${latest.services.length}` })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Bantuan' })).toBeOnTheScreen();
  // Tampilan langsung di Akun (bukan baris yang membuka halaman).
  for (const option of ['Ikuti HP', 'Terang', 'Gelap']) {
    expect(screen.getByRole('tab', { name: option })).toBeOnTheScreen();
  }
  expect(screen.getByRole('tab', { name: 'Ikuti HP' })).toBeSelected();
  for (const title of ROWS) expect(row(title)).toBeOnTheScreen();
  expect(ROWS.length + 1).toBeLessThanOrEqual(6);
  // Tombol di halaman ini: lima baris, Perpanjang, Keluar, dan Coba (mode contoh). Tidak ada yang lain.
  const names = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
  expect(names.filter((n) => !/^(Kembali|Perpanjang|Keluar|Coba)$/.test(n))).toHaveLength(ROWS.length);
  // Judul paling banyak dua kata; label tiap baris hanya judul dan nilai.
  for (const n of names) expect(n.split('. ').length).toBeLessThanOrEqual(2);
  for (const title of ROWS) expect(title.split(' ').length).toBeLessThanOrEqual(2);
  // Kalimat keterangan lama tidak ada lagi.
  for (const old of [/Lihat dan hapus/, /Semua yang sudah/, /Tanya jawab/, /layanan dan perangkat/, /^Langganan$/]) {
    expect(screen.queryByText(old)).toBeNull();
  }
  expect(screen.queryByText(/^Paket /)).toBeNull();
});

test('Layanan tersambung: tiga logo pertama sebagai dok kecil di bawah judul, jumlahnya di kanan', async () => {
  await show();
  const linked = await screen.findByRole('button', { name: `Layanan tersambung. ${latest.services.length}` });
  const dock = within(linked).getByTestId('dok-layanan');
  expect(within(dock).getByTestId('logo-gcal')).toBeOnTheScreen();
  expect(within(dock).getByTestId('logo-gmail')).toBeOnTheScreen();
  expect(within(dock).getByTestId('logo-wa')).toBeOnTheScreen();
  expect(within(dock).queryByTestId('logo-moka')).toBeNull();
  expect(within(linked).getByText(String(latest.services.length))).toBeOnTheScreen();
});

test('baris membuka halamannya; Layanan tersambung membuka Terhubung', async () => {
  await show();
  const opened: [string, string][] = [
    ['Asisten', '/akun/asisten'],
    ['Pemberitahuan', '/akun/notifikasi'],
    ['Keamanan', '/akun/keamanan'],
    ['Layanan tersambung', '/terhubung'],
  ];
  for (const [title, route] of opened) {
    await fireEvent.press(row(title));
    expect(router.push).toHaveBeenLastCalledWith(route);
  }
});

test('Keamanan menyebut PIN bila permintaan PIN hidup', async () => {
  const api = createTestApi({ security: { pinEnabled: true, pin: '123456' } });
  await renderWithProviders(<Akun />, { api });
  await fireEvent.press(await screen.findByRole('button', { name: 'Keamanan. PIN' }));
  expect(router.push).toHaveBeenCalledWith('/akun/keamanan');
});

test('Bantuan membuka WhatsApp dengan kalimat lapor kendala; tanpa nomor: kalimat ramah', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockImplementation(async () => {});
  config.extra = { waNumber: '6281110003333' };
  await show();
  await fireEvent.press(row('Bantuan'));
  expect(open).toHaveBeenCalledWith(waUrl('6281110003333', HELP_TEXT));
  delete config.extra;
  await fireEvent.press(row('Bantuan'));
  expect(toastNow()?.text).toBe(WA_UNAVAILABLE_TEXT);
  expect(toastNow()?.text).not.toMatch(/Fase|dibangun|segera hadir/);
  expect(router.push).not.toHaveBeenCalled();
});

test('mode server: tanpa keterangan contoh milik akun lain', async () => {
  const api = createTestApi({ mode: 'server', token: 'tok' });
  await renderWithProviders(<Akun />, { api });
  expect(screen.queryByText(/ramah dan singkat|Wulandari/)).toBeNull();
  expect(screen.queryByText('Data contoh')).toBeNull();
});

test('Coba: satu baris paling bawah membuka lembar dengan layar uji', async () => {
  await show();
  // Jalan pintas tidak ada di daftar utama.
  for (const hidden of ['Layar pertama kali', 'Alarm', 'Mode data', 'Pemeriksa Inti', 'Komponen']) {
    expect(screen.queryByText(hidden)).toBeNull();
  }
  await fireEvent.press(row('Coba'));
  const sheet = within(screen.getByTestId('lembar-coba'));
  await fireEvent.press(sheet.getByRole('button', { name: 'Layar pertama kali' }));
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(router.push).toHaveBeenLastCalledWith('/mulai');
  await fireEvent.press(row('Coba'));
  await fireEvent.press(within(screen.getByTestId('lembar-coba')).getByRole('button', { name: 'Pemeriksa Inti' }));
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(router.push).toHaveBeenLastCalledWith('/inti');
});

test('Coba hanya di mode contoh atau build pengembangan; Mode data hanya untuk pengembangan', async () => {
  const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  try {
    await show();
    await fireEvent.press(row('Coba'));
    const sheet = within(screen.getByTestId('lembar-coba'));
    expect(sheet.getByText('Layar pertama kali')).toBeOnTheScreen();
    expect(sheet.getByText('Alarm')).toBeOnTheScreen();
    expect(sheet.queryByText('Mode data')).toBeNull();
    expect(sheet.queryByText('Pemeriksa Inti')).toBeNull();
    await screen.unmount();
    // Mode server di build biasa: tidak ada Coba sama sekali.
    await renderWithProviders(<Akun />, { api: createTestApi({ mode: 'server', token: 'tok' }) });
    expect(screen.queryByRole('button', { name: /^Coba/ })).toBeNull();
  } finally {
    (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
  }
});

test('avatar RW di Beranda membuka Akun', async () => {
  await renderWithProviders(<Beranda />);
  await fireEvent.press(screen.getByRole('button', { name: 'Akun' }));
  expect(router.push).toHaveBeenLastCalledWith('/akun');
});

test('Usaha tanpa avatar Akun: Akun selalu di satu tempat, Beranda', async () => {
  await renderWithProviders(<Usaha />);
  expect(await screen.findByText('Rp 4,25 jt')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Akun' })).toBeNull();
});

test('mode gelap memakai warna gelap', async () => {
  await show('dark');
  expect(screen.getByText('Rina Wulandari')).toHaveStyle({ color: dark.text });
  expect(screen.getByText('Asisten')).toHaveStyle({ color: dark.text });
});

test('Keluar: tombol teks koral membuka lembar konfirmasi', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Keluar' }));
  expect(router.push).toHaveBeenCalledWith('/keluar');
});
