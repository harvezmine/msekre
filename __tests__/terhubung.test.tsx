import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Beranda from '../app/(tabs)/index';
import Terhubung from '../app/terhubung/index';
import { advance, currentStack, go, mockParams, restoreParams, sampleState, showRoute } from './harness';
import { createTestApi, renderWithProviders } from './helpers';

async function show(start = '/terhubung') {
  await showRoute(start);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams();
});
afterAll(() => {
  restoreParams();
});

test('daftar: tujuh layanan tersambung, CCTV tidak terjangkau berwarna clay, kelompok Kerja dan Usaha', async () => {
  await show();
  expect(screen.getByText('Semua yang sudah Nadia kenal.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Moka. Aktif · terakhir dibaca 1 menit lalu' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Imou · CCTV. Tidak terjangkau sejak 10.12' })).toBeOnTheScreen();
  expect(screen.getByText('Kerja')).toBeOnTheScreen();
  expect(screen.getByText('Usaha')).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: /^Sambungkan / })).toHaveLength(7 + 1);
  expect(screen.getByText('LG, Samsung, Philips Hue, Aqara, dan 5 lainnya')).toBeOnTheScreen();
});

test('baris layanan membuka detailnya', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: /^Moka\./ }));
  expect(router.push).toHaveBeenCalledWith('/terhubung/moka');
});

test('Rumah membuka Tambah perangkat', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: /^Merek perangkat rumah/ }));
  expect(router.push).toHaveBeenCalledWith('/perangkat/tambah');
});

test('Sambungkan layanan lain memunculkan toast Fase 5', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Sambungkan layanan lain' }));
  expect(sampleState().toast?.text).toBe('Menyambungkan layanan lain dibangun di Fase 5.');
});

test('Sambungkan layanan lain di mode server: toast netral, tanpa menyebut fase', async () => {
  await showRoute('/terhubung', { api: createTestApi({ mode: 'server', token: 'tok' }) });
  await fireEvent.press(screen.getByRole('button', { name: 'Sambungkan layanan lain' }));
  expect(sampleState().toast?.text).toBe('Menyambungkan layanan lain segera hadir.');
});

test('alur 4: Sambungkan TikTok, Masuk (contoh), tersambung, Selesai, Beranda punya 8 simpul', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Sambungkan TikTok Shop & Tokopedia' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung/masuk?id=tiktok');

  expect(screen.getByText('Masuk ke TikTok Shop')).toBeOnTheScreen();
  expect(screen.getByText('seller.tiktokshop.com')).toBeOnTheScreen();
  expect(
    screen.getByText('Ini halaman resmi TikTok Shop. Kata sandi Anda tidak saya lihat atau simpan.'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Halaman masuk TikTok Shop')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Masuk (contoh)' }));
  await advance(250);
  expect(sampleState().services.some((s) => s.id === 'tiktok')).toBe(true);
  expect(router.replace).toHaveBeenCalledWith('/terhubung/tersambung?id=tiktok');

  expect(screen.getByText('TikTok Shop sudah terhubung')).toBeOnTheScreen();
  expect(screen.getByText('Mulai sekarang saya kabari pesanan baru dan yang perlu dikirim.')).toBeOnTheScreen();
  expect(screen.getByText('Hanya membaca')).toBeOnTheScreen();
  expect(screen.getByTestId('simpul-tiktok')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
  expect(router.dismissTo).toHaveBeenCalledWith('/');

  expect(screen.getByText('8 terhubung · CCTV tidak terjangkau')).toBeOnTheScreen();
  expect(screen.getByTestId('simpul-tiktok')).toBeOnTheScreen();
});

test('tersambung: simpul baru ada, izin tampil, Ubah membuka detail layanan', async () => {
  await showRoute('/terhubung/tersambung?id=tiktok', { actions: [{ type: 'connect', id: 'tiktok' }] });
  expect(screen.getByTestId('simpul-tiktok')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Ubah' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung/tiktok');
  expect(screen.getByRole('radio', { name: 'Hanya membaca' })).toBeChecked();
});

test('tersambung untuk layanan yang belum tersambung menampilkan pesan, bukan layar kosong', async () => {
  await show('/terhubung/tersambung?id=tiktok');
  expect(screen.getByText('Layanan ini tidak ditemukan.')).toBeOnTheScreen();
});

test('Masuk untuk layanan lain memakai nama dan alamatnya sendiri', async () => {
  await show('/terhubung/masuk?id=notion');
  expect(screen.getByText('Masuk ke Notion')).toBeOnTheScreen();
  expect(screen.getByText('notion.so')).toBeOnTheScreen();
});

test('detail Moka: tiga kemampuan dan izin Hanya membaca terpilih', async () => {
  await show('/terhubung/moka');
  expect(screen.getByText('Yang bisa Nadia lakukan')).toBeOnTheScreen();
  expect(screen.getByText('Melihat penjualan tiap kedai, kapan saja Anda tanya.')).toBeOnTheScreen();
  expect(screen.getByText('Aktif · terakhir dibaca 1 menit lalu')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Hanya membaca' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Boleh bertindak' })).not.toBeChecked();
});

test('izin: Boleh bertindak mengubah layanan dan mencatat riwayat', async () => {
  await show('/terhubung/moka');
  await fireEvent.press(screen.getByRole('radio', { name: 'Boleh bertindak' }));
  expect(sampleState().services.find((s) => s.id === 'moka')!.permission).toBe('act');
  expect(screen.getByRole('radio', { name: 'Boleh bertindak' })).toBeChecked();
  expect(sampleState().history[0]!.title).toBe('Mengubah izin Moka');
});

test('Hapus semua yang Nadia tahu: konfirmasi, lalu forget dan toast', async () => {
  await show('/terhubung/moka');
  await fireEvent.press(screen.getByRole('button', { name: 'Hapus semua yang Nadia tahu dari layanan ini' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung/konfirmasi?id=moka&aksi=lupa');
  expect(screen.getByText('Hapus yang Nadia tahu dari Moka?')).toBeOnTheScreen();
  expect(sampleState().forgotten).not.toContain('moka');
  await fireEvent.press(screen.getByRole('button', { name: 'Ya, hapus' }));
  await advance(250);
  expect(sampleState().forgotten).toContain('moka');
  expect(sampleState().toast?.text).toBe('Yang Nadia tahu dari Moka sudah dihapus.');
  expect(router.back).toHaveBeenCalled();
});

test('Batal di konfirmasi tidak mengubah apa pun', async () => {
  await show('/terhubung/konfirmasi?id=moka&aksi=putus');
  await fireEvent.press(screen.getByRole('button', { name: 'Batal' }));
  await advance(250);
  expect(sampleState().services.some((s) => s.id === 'moka')).toBe(true);
  expect(sampleState().toast).toBeNull();
});

test('Putuskan: konfirmasi, simpul hilang dari cincin Beranda, kembali ke Terhubung dengan toast', async () => {
  await show('/terhubung/moka');
  await fireEvent.press(screen.getByRole('button', { name: 'Putuskan' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung/konfirmasi?id=moka&aksi=putus');
  await fireEvent.press(screen.getByRole('button', { name: 'Ya, putuskan' }));
  await advance(250);
  expect(sampleState().services.some((s) => s.id === 'moka')).toBe(false);
  expect(sampleState().toast?.text).toBe('Moka diputuskan.');
  expect(router.dismissTo).toHaveBeenCalledWith('/');
  expect(router.push).toHaveBeenLastCalledWith('/terhubung');
  // Moka bisa disambungkan lagi dari daftar.
  expect(screen.getByRole('button', { name: 'Sambungkan Moka' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Sambungkan Moka' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung/masuk?id=moka');
});

test('Putuskan dari Ubah di Tersambung: tumpukan bersih, kembali ke Beranda tanpa "tidak ditemukan"', async () => {
  await show('/');
  await go('/terhubung/tersambung?id=moka');
  await go('/terhubung/moka');
  await go('/terhubung/konfirmasi?id=moka&aksi=putus');
  await fireEvent.press(screen.getByRole('button', { name: 'Ya, putuskan' }));
  await advance(250);
  expect(currentStack()).toEqual(['/', '/terhubung']);
  await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));
  expect(currentStack()).toEqual(['/']);
  expect(screen.queryByText('Layanan ini tidak ditemukan.')).toBeNull();
});

test('Kotak Sekretaris AI di "Pernah tersambung" disambungkan lewat Tambah perangkat, bukan lembar masuk web', async () => {
  await renderWithProviders(<Terhubung />, { actions: [{ type: 'disconnect', id: 'kotak' }] });
  await fireEvent.press(screen.getByRole('button', { name: 'Sambungkan Kotak Sekretaris AI' }));
  expect(router.push).toHaveBeenCalledWith('/perangkat/tambah');
});

test('Beranda: tulisan di bawah cincin dan cincinnya membuka Terhubung', async () => {
  await renderWithProviders(<Beranda />);
  await fireEvent.press(screen.getByRole('button', { name: '7 terhubung · CCTV tidak terjangkau' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung');
  jest.mocked(router.push).mockClear();
  await fireEvent.press(screen.getByTestId('cincin'));
  expect(router.push).toHaveBeenCalledWith('/terhubung');
});

test('mode gelap: daftar Terhubung tampil', async () => {
  await renderWithProviders(<Terhubung />, { scheme: 'dark' });
  expect(screen.getByText('Sudah terhubung')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Imou · CCTV. Tidak terjangkau sejak 10.12' })).toBeOnTheScreen();
});
