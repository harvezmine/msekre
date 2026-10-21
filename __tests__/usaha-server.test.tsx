import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Usaha from '../app/(tabs)/usaha';
import UsahaLainnya from '../app/usaha/lainnya';
import { ERROR_TEXT } from '@/api/errors';
import { HttpTransport, type SocketLike } from '@/api/http';
import { createMemorySession } from '@/api/session';
import { ToastHost } from '@/ui/Toast';
import { renderWithProviders } from './helpers';

const BASE = 'https://app.sekertaris.com';
const homeBody = {
  place: 'Kedai Dago',
  greetingName: null,
  summary: '',
  approvals: [],
  agendaToday: [],
  house: { lines: [] },
  business: null,
  ring: { nodes: [] },
  rev: 1,
};
const businessBody = {
  place: 'Kedai Dago',
  period: 'hari',
  sales: { total: 3_000_000, change: 7, down: true, compareLabel: 'Senin lalu' },
  series: [
    { label: 'Min', value: 2_000_000 },
    { label: 'Sen', value: 3_000_000 },
  ],
  branches: [],
  moneyIn: [{ id: 'm1', source: 'QRIS Dago', amount: 500_000, at: '2026-10-21T03:00:00Z', note: 'tunai' }],
  lowStock: [
    { id: 's1', name: 'Gula', left: 3, unit: 'kg', supplier: { name: 'Toko Manis' } },
    { id: 's2', name: 'Teh', left: 1, unit: 'dus' },
    { id: 's3', name: 'Kopi', left: 2, unit: 'kg', supplier: { name: 'CV Kopi' }, reorderDraftId: 'd-9' },
  ],
  orders: [
    {
      id: 'o1',
      channel: 'toko_baru',
      summary: 'Topi 1',
      amount: 90_000,
      status: 'sedang_diproses',
      at: '2026-10-21T03:00:00Z',
    },
  ],
  report: { mediaId: 'rep-1', name: 'Laporan.pdf', size: 2048, period: '14-20 Okt' },
  sources: [
    { key: 'moka', label: 'Moka', connected: true, provides: ['sales', 'stock'] },
    { key: 'gojek', label: 'GoFood', connected: false },
  ],
  rev: 5,
};

class Socket implements SocketLike {
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data?: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: { code?: number }) => void) | null = null;
  close() {}
}

function serverApi(handler: (path: string, init: RequestInit) => { status?: number; body?: unknown } | undefined) {
  const sockets: Socket[] = [];
  const fetch = jest.fn(async (url: string, init: RequestInit) => {
    const path = url.replace(`${BASE}/app/v1`, '');
    const r =
      handler(path, init) ??
      (path === '/home'
        ? { body: homeBody }
        : path.startsWith('/business?')
          ? { body: businessBody }
          : path.startsWith('/messages')
            ? { body: { items: [], before: null } }
            : { status: 404, body: { error: 'tidak_ditemukan' } });
    const status = r.status ?? 200;
    return { status, ok: status < 300, text: async () => JSON.stringify(r.body ?? {}) };
  });
  const transport = new HttpTransport(BASE, createMemorySession('tok'), {
    fetch: fetch as unknown as typeof globalThis.fetch,
    socket: () => {
      const s = new Socket();
      sockets.push(s);
      return s;
    },
    appVersion: '1.0.0',
  });
  return { api: { mode: 'server' as const, session: createMemorySession('tok'), transport }, fetch, sockets };
}

beforeEach(() => jest.clearAllMocks());

test('mode server: Usaha dari GET /business, saluran dan status baru tetap tampil, sumber belum tersambung', async () => {
  const { api, fetch } = serverApi(() => undefined);
  const main = await renderWithProviders(<Usaha />, { api });
  expect(await screen.findByText('Rp 3 jt')).toBeOnTheScreen();
  expect(fetch.mock.calls.some(([u]) => String(u).endsWith('/business?place=Kedai%20Dago&period=hari'))).toBe(true);
  expect(screen.getByLabelText('Penjualan hari ini Rp3.000.000, turun 7% dari Senin lalu')).toBeOnTheScreen();
  // Layar utama: satu barang menipis, yang bisa dipesan lebih dulu.
  expect(screen.getByText('Tinggal 3 kg')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Pesan lagi Gula' })).toBeOnTheScreen();
  await main.unmount();

  await renderWithProviders(<UsahaLainnya />, { api });
  expect(await screen.findByText('QRIS Dago')).toBeOnTheScreen();
  expect(screen.getByText('Tinggal 3 kg')).toBeOnTheScreen();
  // saluran dan status yang belum dikenal aplikasi: kata biasa
  expect(screen.getByText('Toko baru: 1 pesanan')).toBeOnTheScreen();
  expect(screen.getByText('Sedang diproses')).toBeOnTheScreen();
  expect(screen.getByText('Laporan.pdf')).toBeOnTheScreen();
  // hanya barang bersupplier yang bisa dipesan; yang sudah punya draf menawarkan Lihat draf
  expect(screen.getByRole('button', { name: 'Pesan lagi Gula' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /Teh/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Lihat draf Kopi' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/chat', params: { draf: 'd-9' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Sambungkan GoFood' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung');
});

test('mode server: Pesan lagi memanggil POST /business/reorder lalu membuka chat; event business memperbarui', async () => {
  const { api, fetch, sockets } = serverApi((path) =>
    path === '/business/reorder' ? { body: { draftId: 'd-1', messageId: 'm-1' } } : undefined,
  );
  await renderWithProviders(<Usaha />, { api });
  await fireEvent.press(await screen.findByRole('button', { name: 'Pesan lagi Gula' }));
  await act(async () => {});
  const post = fetch.mock.calls.find(([u]) => String(u).endsWith('/business/reorder'))!;
  expect(post[1].body).toBe('{"stockId":"s1"}');
  expect(router.push).toHaveBeenCalledWith({ pathname: '/chat', params: { draf: 'd-1', pesan: 'm-1' } });
  expect(screen.getByRole('button', { name: 'Lihat draf Gula' })).toBeOnTheScreen();
  // draf dikirim: server menghapus tandanya lewat event
  await act(async () => {
    sockets[0]!.onopen?.({});
  });
  await act(async () => {
    sockets[0]!.onmessage?.({
      data: JSON.stringify({
        type: 'business',
        business: { ...businessBody, sales: { ...businessBody.sales, total: 3_500_000 }, rev: 6 },
      }),
    });
  });
  expect(screen.getByText('Rp 3,5 jt')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Pesan lagi Gula' })).toBeOnTheScreen();
  // event yang lebih lama dibuang
  await act(async () => {
    sockets[0]!.onmessage?.({
      data: JSON.stringify({ type: 'business', business: { ...businessBody, rev: 2 } }),
    });
  });
  expect(screen.getByText('Rp 3,5 jt')).toBeOnTheScreen();
});

test('mode server: reorder gagal menampilkan toast ramah dan tidak membuka chat', async () => {
  const { api } = serverApi((path) =>
    path === '/business/reorder' ? { status: 500, body: { error: 'server' } } : undefined,
  );
  await renderWithProviders(
    <>
      <Usaha />
      <ToastHost />
    </>,
    { api },
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Pesan lagi Gula' }));
  expect(await screen.findByText(ERROR_TEXT)).toBeOnTheScreen();
  expect(router.push).not.toHaveBeenCalled();
});

test('mode server: jawaban kosong menampilkan keadaan kosong, jawaban gagal menampilkan Coba lagi', async () => {
  const empty = {
    ...businessBody,
    sales: { total: 0, change: 0, down: false, compareLabel: 'Senin lalu' },
    series: [],
    moneyIn: [],
    lowStock: [],
    orders: [],
    report: null,
    sources: [],
  };
  const { api } = serverApi((path) => (path.startsWith('/business?') ? { body: empty } : undefined));
  await renderWithProviders(<Usaha />, { api });
  expect(await screen.findByText('Belum ada data usaha di sini.')).toBeOnTheScreen();
});

test('mode server: GET /business gagal menampilkan kalimat ramah dan Coba lagi', async () => {
  let fail = true;
  const { api } = serverApi((path) =>
    path.startsWith('/business?') && fail ? { status: 500, body: { error: 'server' } } : undefined,
  );
  await renderWithProviders(<Usaha />, { api });
  expect(await screen.findByText(ERROR_TEXT)).toBeOnTheScreen();
  fail = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
  expect(await screen.findByText('Rp 3 jt')).toBeOnTheScreen();
});

test('mode server: jam uang masuk mengikuti zona waktu dari server (bukan zona HP); jam bawaan WIB', async () => {
  const wit = serverApi((path) =>
    path.startsWith('/business?') ? { body: { ...businessBody, tzOffsetMinutes: 540 } } : undefined,
  );
  const view = await renderWithProviders(<UsahaLainnya />, { api: wit.api });
  // 03.00 UTC di WIT (UTC+9) = 12.00
  expect(await screen.findByText('12.00 · tunai')).toBeOnTheScreen();
  await view.unmount();

  // Server lama tanpa tzOffsetMinutes: WIB (UTC+7) = 10.00
  const old = serverApi(() => undefined);
  await renderWithProviders(<UsahaLainnya />, { api: old.api });
  expect(await screen.findByText('10.00 · tunai')).toBeOnTheScreen();
});

test('mode server: keterangan "dari {sumber}" memakai sumber tersambung yang menyebut bagiannya, tanpa nama sumber tertulis di aplikasi', async () => {
  const body = {
    ...businessBody,
    sources: [
      { key: 'kasir_x', label: 'Kasir Toko', connected: true, provides: ['sales', 'stock'] },
      { key: 'bank_y', label: 'Bank Mandiri', connected: true, provides: ['moneyIn'] },
    ],
  };
  const { api } = serverApi((path) => (path.startsWith('/business?') ? { body } : undefined));
  await renderWithProviders(<UsahaLainnya />, { api });
  await screen.findByText('QRIS Dago');
  expect(screen.getAllByText('dari Kasir Toko').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('dari Bank Mandiri')).toBeOnTheScreen();
  expect(screen.queryByText('dari Moka')).toBeNull();
});
