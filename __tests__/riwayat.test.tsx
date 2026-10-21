import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { DRAFT_SENT_TEXT, ERROR_TEXT } from '@/api/errors';
import { ApiFailure } from '@/api/transport';
import { initialSampleState, type HistoryEntry as SampleEntry, type SampleState } from '@/sample/store';
import { dark } from '@/theme/tokens';
import { ToastHost } from '@/ui/Toast';
import Riwayat from '../app/riwayat';
import { advance } from './harness';
import { createTestApi, renderWithProviders } from './helpers';

beforeEach(() => jest.clearAllMocks());

/** Memuat daftar, stream, dan event berjalan lewat promise dan timer palsu. */
async function settle() {
  for (let i = 0; i < 3; i++) await advance(0);
}

async function show(options: Parameters<typeof renderWithProviders>[1] = {}) {
  const api = (options.api ?? createTestApi({ sample: options.state })) as ReturnType<typeof createTestApi>;
  const view = await renderWithProviders(
    <>
      <Riwayat />
      <ToastHost />
    </>,
    { ...options, api },
  );
  await settle();
  return { api, ...view };
}

/** Penyimpanan contoh dengan `count` entri Riwayat tambahan, terbaru dulu (semua "Hari ini", mundur tiap menit). */
function crowded(count: number): SampleState {
  const extra: SampleEntry[] = Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    day: 'Hari ini',
    time: `0${Math.floor((count - i) / 60)}.${String((count - i) % 60).padStart(2, '0')}`,
    kind: 'rumah',
    icon: 'bulb',
    title: `Lampu ${i}`,
    sub: 'lewat aplikasi',
  }));
  return { ...initialSampleState, history: [...extra, ...initialSampleState.history] };
}

test('entri per hari dengan jam dan keterangan, lalu keadaan kosong dan saringan', async () => {
  await show();
  expect(screen.getByText('Hari ini')).toBeOnTheScreen();
  expect(screen.getByText('Kemarin')).toBeOnTheScreen();
  expect(screen.getByText('Membeli token listrik')).toBeOnTheScreen();
  expect(screen.getByText(/^\d\d\.\d\d · Rp100\.000 lunas$/)).toBeOnTheScreen();
  expect(screen.getByText('Mengirim laporan penjualan harian')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Rumah' }));
  await settle();
  expect(screen.getByText('Mengunci pintu depan')).toBeOnTheScreen();
  expect(screen.queryByText('Membeli token listrik')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Kiriman' }));
  await settle();
  expect(
    screen.getByText('Belum ada yang dikerjakan di sini. Nanti muncul begitu Nadia mulai bekerja.'),
  ).toBeOnTheScreen();
  for (const name of ['Semua', 'Kiriman', 'Rumah', 'Agenda', 'Usaha']) {
    expect(screen.getByRole('button', { name })).toBeOnTheScreen();
  }
  expect(screen.queryByRole('button', { name: 'Pesan' })).toBeNull();
});

test('halaman demi halaman: tombol dan ujung gulir memuat yang lebih lama', async () => {
  await show({ state: crowded(45) });
  expect(screen.getByText('Lampu 0')).toBeOnTheScreen();
  expect(screen.queryByText('Lampu 25')).toBeNull();
  const more = screen.getByRole('button', { name: 'Tampilkan yang lebih lama' });
  await fireEvent.press(more);
  await settle();
  expect(screen.getByText('Lampu 25')).toBeOnTheScreen();
  expect(screen.queryByText('Lampu 44')).toBeNull();

  // Ujung gulir memuat tanpa menekan apa pun; jauh dari ujung tidak.
  const list = screen.getByTestId('riwayat-daftar');
  const at = (y: number) => ({
    nativeEvent: { contentOffset: { y }, contentSize: { height: 3000 }, layoutMeasurement: { height: 600 } },
  });
  await fireEvent.scroll(list, at(100));
  await settle();
  expect(screen.queryByText('Lampu 44')).toBeNull();
  await fireEvent.scroll(list, at(2300));
  await settle();
  expect(screen.getByText('Lampu 44')).toBeOnTheScreen();
  expect(screen.getByText('Membeli token listrik')).toBeOnTheScreen();
  // Sudah habis.
  expect(screen.queryByRole('button', { name: 'Tampilkan yang lebih lama' })).toBeNull();
});

test('gagal memuat: kalimat ramah dan Coba lagi', async () => {
  const api = createTestApi();
  api.transport.failNext('network');
  await show({ api });
  expect(screen.getByText(ERROR_TEXT)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
  await settle();
  expect(screen.getByText('Membeli token listrik')).toBeOnTheScreen();
  expect(screen.queryByText(ERROR_TEXT)).toBeNull();
});

test('kiriman ditahan: hitung mundur, Batalkan satu kali, lalu dibatalkan dan tercoret', async () => {
  const api = createTestApi({ latencyMs: 100 });
  await show({ api });
  await advance(150);
  await settle();
  const send = api.transport.draftAction('o-budi', { action: 'send' });
  await advance(150);
  await send;
  await settle();
  expect(screen.getByText('Mengirim balasan ke Pak Budi')).toBeOnTheScreen();
  expect(screen.getByText(/^sisa [45]:\d\d$/)).toBeOnTheScreen();
  const first = screen.getByText(/^sisa /).props.children.join('');
  await advance(20_000);
  expect(screen.getByText(/^sisa /).props.children.join('')).not.toBe(first);

  const spy = jest.spyOn(api.transport, 'draftAction');
  await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
  // Selagi permintaan berjalan tombolnya terkunci: ketukan kedua tidak mengirim lagi.
  expect(screen.getByRole('button', { name: 'Batalkan' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
  await advance(150);
  await settle();
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith('o-budi', { action: 'cancel' });
  expect(screen.getByText('Kiriman dibatalkan.')).toBeOnTheScreen();
  expect(screen.getByText('Dibatalkan')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Batalkan' })).toBeNull();
  expect(screen.getByText('Mengirim balasan ke Pak Budi')).toHaveStyle({ textDecorationLine: 'line-through' });
});

test('masa tahan habis: Batalkan hilang dan "Terkirim" tampil lewat event stream', async () => {
  const { api } = await show();
  await act(async () => {
    await api.transport.draftAction('o-budi', { action: 'send' });
  });
  await settle();
  expect(screen.getByRole('button', { name: 'Batalkan' })).toBeOnTheScreen();
  await advance(5 * 60_000 + 1000);
  await settle();
  expect(screen.queryByRole('button', { name: 'Batalkan' })).toBeNull();
  expect(screen.queryByText(/^sisa /)).toBeNull();
  expect(screen.getByText('Terkirim')).toBeOnTheScreen();
});

test('pengiriman gagal: tertulis "Tidak terkirim"', async () => {
  const { api } = await show();
  api.transport.failHeldSends();
  await act(async () => {
    await api.transport.draftAction('o-budi', { action: 'send' });
  });
  await advance(5 * 60_000 + 1000);
  await settle();
  expect(screen.getByText('Tidak terkirim')).toBeOnTheScreen();
});

test('Batalkan setelah sudah terkirim di tempat lain: kalimat ramah, daftar diperbarui', async () => {
  const { api } = await show();
  await act(async () => {
    await api.transport.draftAction('o-budi', { action: 'send' });
  });
  await settle();
  // Server menolak karena status draf sudah berubah (misalnya terkirim lewat WhatsApp).
  jest
    .spyOn(api.transport, 'draftAction')
    .mockRejectedValueOnce(new ApiFailure('server', { status: 409, error: 'status_draf' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
  await settle();
  expect(screen.getByText(DRAFT_SENT_TEXT)).toBeOnTheScreen();
});

test('entri baru masuk lewat stream di paling atas tanpa muat ulang', async () => {
  const { api } = await show();
  expect(screen.queryByText('Mematikan AC kamar', { exact: true })).toBeOnTheScreen();
  await act(async () => {
    api.transport.sample.dispatch({ type: 'toggleDevice', id: 'lampu-teras', on: false });
  });
  await settle();
  expect(screen.getAllByText(/^Mematikan lampu/).length).toBeGreaterThan(0);
});

test('mengetuk entri membuka layarnya: kiriman ke chat, perangkat ke detailnya', async () => {
  const { api } = await show();
  await act(async () => {
    await api.transport.draftAction('o-budi', { action: 'send' });
    api.transport.sample.dispatch({ type: 'toggleDevice', id: 'lampu-teras', on: false });
  });
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: /^Mengirim balasan ke Pak Budi/ }));
  expect(router.push).toHaveBeenLastCalledWith('/chat');
  await fireEvent.press(screen.getByRole('button', { name: /^Mematikan lampu/ }));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/perangkat/[id]', params: { id: 'lampu-teras' } });
  // Entri tanpa tautan bukan tombol.
  expect(screen.queryByRole('button', { name: /^Membeli token listrik/ })).toBeNull();
});

test('mode gelap memakai warna gelap', async () => {
  await show({ scheme: 'dark' });
  expect(screen.getByText('Membeli token listrik')).toHaveStyle({ color: dark.ink });
});

test('detak tiap detik hanya selagi ada kiriman yang masa tahannya belum lewat', async () => {
  const api = createTestApi();
  const real = await api.transport.history({});
  const past = (id: string): (typeof real.items)[number] => ({
    id,
    at: new Date(Date.now() - 60 * 60_000).toISOString(),
    kind: 'kirim',
    icon: 'mail',
    title: 'Mengirim balasan',
    status: 'menunggu',
    undoable: { draftId: `d-${id}`, until: new Date(Date.now() - 60_000).toISOString() },
  });
  jest
    .spyOn(api.transport, 'history')
    .mockResolvedValue({ ...real, now: new Date().toISOString(), items: [past('x')] });
  const every = jest.spyOn(globalThis, 'setInterval');
  await show({ api });
  expect(every.mock.calls.filter(([, ms]) => ms === 1000)).toHaveLength(0);
  every.mockRestore();
});
