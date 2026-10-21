import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { wibIso } from '@/api/fake/clock';
import { formatJam } from '@/api/format';
import { THINK_MS } from '@/sample/chat';
import { deviceById, MAIN_AC_ID } from '@/sample/store';
import { audio } from './audioMock';
import { advance, currentRoute, go, currentStack, mockParams, restoreParams, sampleState, showRoute } from './harness';

// Alur prototipe dari rencana Fase 0b, masing-masing dalam satu penyimpanan contoh dan satu tumpukan navigasi.
// Chat memakai server tiruan lewat useChat(); server tiruan memegang penyimpanan contoh yang sama dengan Beranda dan Riwayat.

/** Chat memuat riwayat dan kejadian stream berjalan lewat promise dan timer palsu. */
async function settle() {
  for (let i = 0; i < 3; i++) await advance(0);
}

beforeEach(() => {
  jest.clearAllMocks();
  audio.reset();
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

  // Tahan Inti, bicara setengah detik, lepas: server tiruan mendengar "Matikan AC kamar" lalu menjawab.
  const inti = screen.getByRole('button', { name: 'Tahan untuk bicara' });
  await fireEvent(inti, 'pressIn');
  await advance(1);
  for (let i = 0; i < 6; i++) await act(async () => audio.emitBuffer(new Array<number>(1600).fill(9000)));
  await fireEvent(inti, 'pressOut');
  await advance(1);
  expect(deviceById(sampleState(), MAIN_AC_ID)!.on).toBe(true);
  await advance(THINK_MS); // masuk keadaan berbicara
  expect(deviceById(sampleState(), MAIN_AC_ID)!.on).toBe(false);
  await advance(4500);
  await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
  expect(router.back).toHaveBeenCalled();
  expect(currentRoute()).toBe('/');

  expect(screen.getByText('AC kamar mati')).toBeOnTheScreen();
  await go('/riwayat');
  await settle();
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
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
  await advance(1);
  expect(screen.getByText(`Dikirim ${formatJam(wibIso(10, 20, '10.47'))}`)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Batalkan' })).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));
  expect(currentRoute()).toBe('/');
  expect(screen.queryByText('Butuh persetujuan Anda')).toBeNull();

  await go('/riwayat');
  await settle();
  expect(screen.getByText('Mengirim balasan ke Pak Budi')).toBeOnTheScreen();
  expect(screen.getByText(/^sisa [45]:\d\d$/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
  await settle();
  expect(screen.getByText('Kiriman dibatalkan.')).toBeOnTheScreen();
  expect(screen.queryByText(/^sisa /)).toBeNull();
  expect(screen.getByText('Dibatalkan')).toBeOnTheScreen();
  expect(screen.getByText('Mengirim balasan ke Pak Budi')).toHaveStyle({ textDecorationLine: 'line-through' });

  // Batalkan di Riwayat sampai ke server tiruan: kartu di chat ikut dibatalkan.
  await advance(1);
  await go('/chat');
  await settle();
  expect(screen.getByText('Dibatalkan · tidak jadi terkirim')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Batalkan' })).toBeNull();
});

test('alur 2b: Batalkan di chat juga membatalkan di Riwayat (sampai ke penyimpanan contoh)', async () => {
  await showRoute('/chat');
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
  await advance(1);
  expect(sampleState().outgoing['o-budi']!.status).toBe('held');
  await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
  await advance(1);
  expect(sampleState().outgoing['o-budi']!.status).toBe('cancelled');
  await go('/riwayat');
  await settle();
  expect(screen.getByText('Mengirim balasan ke Pak Budi')).toHaveStyle({ textDecorationLine: 'line-through' });
});

test('alur Usaha: Pesan lagi membuka chat dengan kartu draf pesanan; Kirim tampil di Riwayat', async () => {
  await showRoute('/usaha');
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: 'Pesan lagi Susu UHT' }));
  await settle();
  expect(currentRoute()).toBe('/chat');
  await settle();
  expect(screen.getByText('PT Sumber Susu')).toBeOnTheScreen();
  expect(screen.getByText('Ini draf pesanannya. Saya kirim setelah Anda setuju.')).toBeOnTheScreen();
  // yang terbaru lebih dulu di pohon: draf supplier, lalu draf Pak Budi
  await fireEvent.press(screen.getAllByRole('button', { name: 'Kirim' })[0]!);
  await advance(1);
  expect(sampleState().outgoing['o-budi']!.status).toBe('draft');
  await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));
  await go('/riwayat');
  await settle();
  expect(screen.getByText('Mengirim pesanan ke PT Sumber Susu')).toBeOnTheScreen();
});

test('alur 3: alarm Tunda 10 menit, kembali ke Agenda, item ditunda sampai 07.10', async () => {
  // Jam sekarang sebelum alarm (di jam contoh 0b), jadi tundanya 10 menit dari waktu alarm itu: 07.10.
  const real = Date.now();
  jest.setSystemTime(new Date('2025-10-20T03:42:00.000Z'));
  try {
    await showRoute('/agenda');
    await go('/alarm');
    expect(currentRoute()).toBe('/alarm');
    expect(screen.getByText('Berangkat ke bandara')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tunda 10 menit' }));
    expect(currentRoute()).toBe('/agenda');
    await advance(0);
    await fireEvent.press(screen.getByRole('tab', { name: 'Minggu ini' }));
    expect(screen.getByText('Berangkat ke bandara')).toBeOnTheScreen();
    expect(screen.getByText('Ditunda sampai 07.10')).toBeOnTheScreen();
  } finally {
    jest.setSystemTime(real);
  }
});

test('alur 4: Terhubung, Sambungkan TikTok Shop, Masuk, Selesai, Beranda punya 8 simpul', async () => {
  await showRoute('/');
  await fireEvent.press(screen.getByRole('button', { name: '7 terhubung · CCTV tidak terjangkau' }));
  expect(currentRoute()).toBe('/terhubung');
  await fireEvent.press(await screen.findByRole('button', { name: 'Sambungkan TikTok Shop & Tokopedia' }));
  expect(currentRoute()).toBe('/terhubung/masuk');
  await fireEvent.press(await screen.findByRole('button', { name: 'Masuk (contoh)' }));
  await advance(500);
  await advance(250);
  expect(currentRoute()).toBe('/terhubung/tersambung');
  expect(await screen.findByText('TikTok Shop sudah terhubung')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
  expect(currentStack()).toEqual(['/']);
  expect(await screen.findByText('8 terhubung · CCTV tidak terjangkau')).toBeOnTheScreen();
  expect(screen.getByTestId('simpul-tiktok')).toBeOnTheScreen();
});
