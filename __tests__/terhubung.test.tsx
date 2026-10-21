import { act, fireEvent, screen } from '@testing-library/react-native';
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

test('daftar: tujuh layanan tersambung dengan akun dan terakhir dipakai, CCTV perlu perhatian, katalog menurut kelompok', async () => {
  await show();
  expect(await screen.findByText('Semua yang sudah Nadia kenal.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Moka. Kopi Rindang · Terakhir dipakai 1 menit lalu' })).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: 'Google Kalender. rina@kopirindang.id · Terakhir dipakai 5 menit lalu' }),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Imou · CCTV. Tidak terjangkau sejak 10.12' })).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: 'Perlu dilihat: Imou · CCTV. Tidak terjangkau sejak 10.12' }),
  ).toBeOnTheScreen();
  for (const title of ['Kerja', 'Catatan', 'Usaha', 'Rumah', 'Lainnya']) {
    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
  }
  // Sepuluh yang bisa disambungkan, ditambah "Sambungkan layanan lain".
  expect(screen.getAllByRole('button', { name: /^Sambungkan / })).toHaveLength(10 + 1);
  expect(screen.getByText('LG, Samsung, Philips Hue, Aqara, dan 5 lainnya')).toBeOnTheScreen();
});

test('katalog menandai layanan yang segera hadir tanpa tombol Sambungkan', async () => {
  await show();
  expect(await screen.findByLabelText('Shopee. Segera hadir')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Sambungkan Shopee' })).toBeNull();
  expect(screen.getAllByText('Segera hadir')).toHaveLength(2);
});

test('baris layanan membuka detailnya', async () => {
  await show();
  await fireEvent.press(await screen.findByRole('button', { name: /^Moka\./ }));
  expect(router.push).toHaveBeenCalledWith('/terhubung/moka');
});

test('Rumah membuka Tambah perangkat', async () => {
  await show();
  await fireEvent.press(await screen.findByRole('button', { name: /^Merek perangkat rumah/ }));
  expect(router.push).toHaveBeenCalledWith('/perangkat/tambah');
});

test('Sambungkan layanan lain memunculkan toast Fase 5', async () => {
  await show();
  await fireEvent.press(await screen.findByRole('button', { name: 'Sambungkan layanan lain' }));
  expect(sampleState().toast?.text).toBe('Menyambungkan layanan lain dibangun di Fase 5.');
});

test('Sambungkan layanan lain di mode server: toast netral, tanpa menyebut fase', async () => {
  await showRoute('/terhubung', { api: createTestApi({ mode: 'server', token: 'tok' }) });
  await fireEvent.press(await screen.findByRole('button', { name: 'Sambungkan layanan lain' }));
  expect(sampleState().toast?.text).toBe('Menyambungkan layanan lain segera hadir.');
});

test('alur 4: Sambungkan TikTok, Masuk (contoh), tersambung, Selesai, Beranda punya 8 simpul', async () => {
  await show();
  await fireEvent.press(await screen.findByRole('button', { name: 'Sambungkan TikTok Shop & Tokopedia' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung/masuk?id=tiktok');

  expect(await screen.findByText('Masuk ke TikTok Shop')).toBeOnTheScreen();
  expect(screen.getByText('seller.tiktokshop.com')).toBeOnTheScreen();
  expect(
    screen.getByText('Ini halaman resmi TikTok Shop. Kata sandi Anda tidak saya lihat atau simpan.'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Halaman masuk TikTok Shop')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Masuk (contoh)' }));
  expect(screen.getByRole('button', { name: 'Menyambungkan…' })).toBeDisabled();
  await advance(500);
  expect(sampleState().services.some((s) => s.id === 'tiktok')).toBe(true);
  await advance(250);
  expect(router.replace).toHaveBeenCalledWith('/terhubung/tersambung?id=tiktok');

  expect(await screen.findByText('TikTok Shop sudah terhubung')).toBeOnTheScreen();
  expect(screen.getByText('Mulai sekarang saya kabari pesanan baru dan yang perlu dikirim.')).toBeOnTheScreen();
  expect(screen.getByText('Baca saja')).toBeOnTheScreen();
  expect(screen.getByTestId('simpul-tiktok')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
  expect(router.dismissTo).toHaveBeenCalledWith('/');

  expect(await screen.findByText('8 terhubung · CCTV tidak terjangkau')).toBeOnTheScreen();
  expect(screen.getByTestId('simpul-tiktok')).toBeOnTheScreen();
});

test('tersambung: simpul baru ada, izin tampil, Ubah membuka detail layanan', async () => {
  await showRoute('/terhubung/tersambung?id=tiktok', { actions: [{ type: 'connect', id: 'tiktok' }] });
  expect(await screen.findByTestId('simpul-tiktok')).toBeOnTheScreen();
  await fireEvent.press(await screen.findByRole('button', { name: 'Ubah' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung/tiktok');
  expect(await screen.findByText('Baca saja')).toBeOnTheScreen();
});

test('tersambung untuk layanan yang belum tersambung menampilkan pesan, bukan layar kosong', async () => {
  await show('/terhubung/tersambung?id=tiktok');
  expect(await screen.findByText('Layanan ini tidak ditemukan.')).toBeOnTheScreen();
});

test('alamat kembali dengan ok=1 saat aplikasi dibuka dingin: daftar dimuat, layanan tampil tersambung', async () => {
  const api = createTestApi({ connectMs: 0 });
  // Seperti server asli: sambungan sudah tersimpan sebelum aplikasi dibuka oleh alamat kembali.
  await api.transport.startConnection('notion');
  await advance(10);
  await showRoute('/terhubung/tersambung?id=notion&ok=1', { api, state: api.transport.sample.getState() });
  expect(await screen.findByText('Notion sudah terhubung')).toBeOnTheScreen();
  expect(screen.getByTestId('simpul-notion')).toBeOnTheScreen();
});

test('alamat kembali dengan ok=0: kalimat ramah dan Coba lagi membuka lembar masuk', async () => {
  await show('/terhubung/tersambung?id=notion&ok=0&reason=ditolak');
  expect(await screen.findByText('Belum tersambung')).toBeOnTheScreen();
  expect(screen.getByText('Izin dari Notion belum diberikan, jadi belum tersambung.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
  expect(router.replace).toHaveBeenCalledWith('/terhubung/masuk?id=notion');
});

test('Masuk untuk layanan lain memakai nama dan alamatnya sendiri', async () => {
  await show('/terhubung/masuk?id=notion');
  expect(await screen.findByText('Masuk ke Notion')).toBeOnTheScreen();
  expect(screen.getByText('notion.so')).toBeOnTheScreen();
});

test('Masuk ke layanan yang segera hadir: tombol mati', async () => {
  await show('/terhubung/masuk?id=shopee');
  expect(await screen.findByText('Masuk ke Shopee')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Segera hadir' })).toBeDisabled();
});

test('detail Moka: tiga kemampuan, akun, dan izin Baca saja terpilih', async () => {
  await show('/terhubung/moka');
  expect(await screen.findByText('Yang bisa Nadia lakukan')).toBeOnTheScreen();
  expect(screen.getByText('Melihat penjualan tiap kedai, kapan saja Anda tanya.')).toBeOnTheScreen();
  expect(screen.getByText('Kopi Rindang · Terakhir dipakai 1 menit lalu')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Baca saja' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Baca dan tulis' })).not.toBeChecked();
});

test('izin: Baca dan tulis mengubah layanan dan mencatat riwayat', async () => {
  await show('/terhubung/moka');
  await fireEvent.press(await screen.findByRole('radio', { name: 'Baca dan tulis' }));
  expect(screen.getByRole('radio', { name: 'Baca dan tulis' })).toBeChecked();
  await act(async () => {});
  expect(sampleState().services.find((s) => s.id === 'moka')!.permission).toBe('act');
  expect(screen.getByRole('radio', { name: 'Baca dan tulis' })).toBeChecked();
  expect(sampleState().history[0]!.title).toBe('Mengubah izin Moka');
});

test('izin gagal di server: pilihan tampil dulu, lalu kembali dan toast ramah', async () => {
  const api = createTestApi({ latencyMs: 100 });
  await showRoute('/terhubung/moka', { api });
  await advance(300);
  const write = await screen.findByRole('radio', { name: 'Baca dan tulis' });
  api.transport.failNext('server');
  await fireEvent.press(write);
  expect(screen.getByRole('radio', { name: 'Baca dan tulis' })).toBeChecked();
  await advance(300);
  expect(screen.getByRole('radio', { name: 'Baca saja' })).toBeChecked();
  expect(sampleState().services.find((s) => s.id === 'moka')!.permission).toBe('read');
  expect(sampleState().toast?.text).toMatch(/kendala/);
});

test('Hapus yang Nadia tahu: konfirmasi, lalu jumlahnya hilang dan toast', async () => {
  await show('/terhubung/moka');
  const open = await screen.findByRole('button', {
    name: 'Hapus yang Nadia tahu dari layanan ini. 48 hal diingat Nadia.',
  });
  await fireEvent.press(open);
  expect(router.push).toHaveBeenCalledWith('/terhubung/konfirmasi?id=moka&aksi=lupa');
  expect(await screen.findByText('Hapus yang Nadia pelajari dari Moka?')).toBeOnTheScreen();
  expect(
    screen.getByText('Sambungannya tetap ada. Semua yang Nadia ingat dari layanan ini dihapus.'),
  ).toBeOnTheScreen();
  expect(sampleState().forgotten).not.toContain('moka');
  await fireEvent.press(screen.getByRole('button', { name: 'Ya, hapus' }));
  await advance(250);
  expect(sampleState().forgotten).toContain('moka');
  expect(sampleState().services.some((s) => s.id === 'moka')).toBe(true);
  expect(sampleState().toast?.text).toBe('Yang Nadia pelajari dari Moka sudah dihapus.');
  expect(router.back).toHaveBeenCalled();
});

test('Batal di konfirmasi tidak mengubah apa pun', async () => {
  await show('/terhubung/konfirmasi?id=moka&aksi=putus');
  await fireEvent.press(await screen.findByRole('button', { name: 'Batal' }));
  await advance(250);
  expect(sampleState().services.some((s) => s.id === 'moka')).toBe(true);
  expect(sampleState().toast).toBeNull();
});

test('Putuskan: konfirmasi, simpul hilang dari cincin Beranda, pindah ke Pernah tersambung dengan toast', async () => {
  await show('/terhubung/moka');
  await fireEvent.press(await screen.findByRole('button', { name: 'Putuskan' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung/konfirmasi?id=moka&aksi=putus');
  await fireEvent.press(await screen.findByRole('button', { name: 'Ya, putuskan' }));
  await advance(250);
  expect(sampleState().services.some((s) => s.id === 'moka')).toBe(false);
  expect(sampleState().toast?.text).toBe('Moka diputuskan.');
  expect(router.dismissTo).toHaveBeenCalledWith('/');
  expect(router.push).toHaveBeenLastCalledWith('/terhubung');
  // Moka bisa disambungkan lagi dari daftar.
  expect(await screen.findByText('Pernah tersambung')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Sambungkan Moka' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung/masuk?id=moka');
});

test('Putuskan dari Ubah di Tersambung: tumpukan bersih, kembali ke Beranda tanpa "tidak ditemukan"', async () => {
  await show('/');
  await go('/terhubung/tersambung?id=moka');
  await go('/terhubung/moka');
  await go('/terhubung/konfirmasi?id=moka&aksi=putus');
  await fireEvent.press(await screen.findByRole('button', { name: 'Ya, putuskan' }));
  await advance(250);
  expect(currentStack()).toEqual(['/', '/terhubung']);
  await fireEvent.press(await screen.findByRole('button', { name: 'Kembali' }));
  expect(currentStack()).toEqual(['/']);
  expect(screen.queryByText('Layanan ini tidak ditemukan.')).toBeNull();
});

test('Kotak Sekretaris AI di "Pernah tersambung" disambungkan lewat Tambah perangkat, bukan lembar masuk web', async () => {
  await renderWithProviders(<Terhubung />, { actions: [{ type: 'disconnect', id: 'kotak' }] });
  await fireEvent.press(await screen.findByRole('button', { name: 'Sambungkan Kotak Sekretaris AI' }));
  expect(router.push).toHaveBeenCalledWith('/perangkat/tambah');
});

test('Beranda: tulisan di bawah cincin dan cincinnya membuka Terhubung', async () => {
  await renderWithProviders(<Beranda />);
  await fireEvent.press(await screen.findByRole('button', { name: '7 terhubung · CCTV tidak terjangkau' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung');
  jest.mocked(router.push).mockClear();
  await fireEvent.press(screen.getByTestId('cincin'));
  expect(router.push).toHaveBeenCalledWith('/terhubung');
});

test('mode gelap: daftar Terhubung tampil', async () => {
  await renderWithProviders(<Terhubung />, { scheme: 'dark' });
  expect(await screen.findByText('Sudah terhubung')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Imou · CCTV. Tidak terjangkau sejak 10.12' })).toBeOnTheScreen();
});
