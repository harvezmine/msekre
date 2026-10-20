import { act, fireEvent, screen } from '@testing-library/react-native';
import Beranda from '../app/(tabs)/index';
import Tempat from '../app/tempat';
import { ERROR_TEXT, UNAVAILABLE_TEXT } from '@/api/errors';
import { ToastHost } from '@/ui/Toast';
import { HttpTransport, type SocketLike } from '@/api/http';
import { createMemorySession } from '@/api/session';
import { renderWithProviders } from './helpers';

const BASE = 'https://app.sekertaris.com';
const me = {
  id: 'u1',
  name: 'Budi',
  assistantName: 'Nadia',
  plan: { name: 'Bisnis', activeUntil: null },
  phone: '6281220457781',
};
const draft = {
  id: 'd1',
  to: 'Bu Sari',
  channel: 'whatsapp',
  what: 'balasan',
  text: 'Siap, Bu.',
  status: 'draft',
  ask: 'Balasan untuk Bu Sari sudah siap. Kirim?',
};
const homeBody = {
  place: 'Semua',
  greetingName: 'Budi',
  summary: 'Ada 1 hal yang perlu Anda hari ini.',
  approvals: [draft],
  agendaToday: [{ id: 'a1', time: '09.30', title: 'Telepon vendor', kind: 'reminder' }],
  house: {
    lines: [
      {
        deviceId: 'ac/1',
        icon: 'snow',
        text: 'AC ruang kerja nyala · 23°',
        label: 'AC ruang kerja',
        on: true,
        switchable: true,
      },
      { deviceId: 'pintu', icon: 'ikon-baru', text: 'Pintu depan terkunci', switchable: false },
    ],
  },
  business: {
    source: 'dari Moka',
    sales: 'Rp9.900.000',
    change: 'turun 3% dari Senin lalu',
    down: true,
    alert: 'Gula tinggal 2 kg',
  },
  ring: {
    nodes: [
      { key: 'wa', icon: 'chat', label: 'WhatsApp', reachable: true },
      { key: 'cctv', icon: 'camera', label: 'CCTV', reachable: false },
    ],
  },
  rev: 5,
};

class Socket implements SocketLike {
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data?: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: { code?: number }) => void) | null = null;
  close() {}
}

type Handler = (url: string, init: RequestInit) => { status?: number; body?: unknown } | undefined;

function serverApi(handler: Handler = () => undefined) {
  const session = createMemorySession('tok');
  const sockets: Socket[] = [];
  const fetch = jest.fn(async (url: string, init: RequestInit) => {
    const path = url.replace(`${BASE}/app/v1`, '');
    const custom = handler(path, init);
    const r =
      custom ??
      (path === '/me'
        ? { body: me }
        : path.startsWith('/messages')
          ? { body: { items: [], before: null } }
          : path === '/home' || path === '/places/current'
            ? { body: homeBody }
            : { status: 404, body: { error: 'tidak_ditemukan' } });
    const status = r.status ?? 200;
    return { status, ok: status < 300, text: async () => JSON.stringify(r.body ?? {}) };
  });
  const transport = new HttpTransport(BASE, session, {
    fetch: fetch as unknown as typeof globalThis.fetch,
    socket: () => {
      const s = new Socket();
      sockets.push(s);
      return s;
    },
    appVersion: '1.0.0',
  });
  return { api: { mode: 'server' as const, session, transport }, fetch, sockets };
}

const send = (s: Socket, event: unknown) => s.onmessage?.({ data: JSON.stringify(event) });

test('mode server: Beranda dari GET /home, termasuk persetujuan, ikon baru, dan cincin', async () => {
  const { api } = serverApi();
  await renderWithProviders(<Beranda />, { api });
  expect(await screen.findByText('Selamat pagi, Budi')).toBeOnTheScreen();
  expect(screen.getByText('Ada 1 hal yang perlu Anda hari ini.')).toBeOnTheScreen();
  expect(screen.getByText('Butuh persetujuan Anda')).toBeOnTheScreen();
  expect(screen.getByText('Balasan untuk Bu Sari sudah siap. Kirim?')).toBeOnTheScreen();
  expect(screen.getByText('Telepon vendor')).toBeOnTheScreen();
  expect(screen.getByText('Pintu depan terkunci')).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: 'AC ruang kerja' })).toBeOnTheScreen();
  expect(screen.getByText('Rp9.900.000')).toBeOnTheScreen();
  expect(screen.getByText('Gula tinggal 2 kg')).toBeOnTheScreen();
  expect(screen.getByText('2 terhubung · CCTV tidak terjangkau')).toBeOnTheScreen();
  // tidak ada data contoh yang bocor ke pengguna asli
  expect(screen.queryByText(/Rina|Pak Budi|Susu UHT/)).toBeNull();
});

test('mode server: bisnis kosong menyembunyikan kartu Usaha; tanpa nama sapaan netral', async () => {
  const { api } = serverApi((path) =>
    path === '/home' ? { body: { ...homeBody, business: null, greetingName: null, approvals: [] } } : undefined,
  );
  await renderWithProviders(<Beranda />, { api });
  expect(await screen.findByText('Selamat pagi')).toBeOnTheScreen();
  expect(screen.queryByText('Usaha')).toBeNull();
  expect(screen.queryByText('Butuh persetujuan Anda')).toBeNull();
});

test('mode server: event home dari stream mengganti Beranda; yang lebih lama dibuang', async () => {
  const { api, sockets } = serverApi();
  await renderWithProviders(<Beranda />, { api });
  await screen.findByText('Telepon vendor');
  await act(async () => {
    sockets[0]!.onopen?.({});
  });
  await act(async () => {
    send(sockets[0]!, {
      type: 'home',
      home: { ...homeBody, rev: 6, agendaToday: [{ id: 'a2', time: '11.00', title: 'Rapat baru', kind: 'meeting' }] },
    });
  });
  expect(screen.getByText('Rapat baru')).toBeOnTheScreen();
  await act(async () => {
    send(sockets[0]!, { type: 'home', home: { ...homeBody, rev: 4 } });
  });
  expect(screen.getByText('Rapat baru')).toBeOnTheScreen();
  expect(screen.queryByText('Telepon vendor')).toBeNull();
});

test('mode server: sakelar AC memanggil kendali perangkat; gagal -> toast ramah', async () => {
  const { api, fetch } = serverApi((path) =>
    path === '/home/devices/ac%2F1' ? { status: 501, body: { error: 'belum_tersedia' } } : undefined,
  );
  await renderWithProviders(
    <>
      <Beranda />
      <ToastHost />
    </>,
    { api },
  );
  await fireEvent.press(await screen.findByRole('switch', { name: 'AC ruang kerja' }));
  expect(await screen.findByText(UNAVAILABLE_TEXT)).toBeOnTheScreen();
  const call = fetch.mock.calls.find(([u]) => String(u).endsWith('/home/devices/ac%2F1'))!;
  expect(call[1].method).toBe('POST');
  expect(call[1].body).toBe('{"on":false}');
});

test('mode server: gagal memuat -> kalimat ramah dan Coba lagi', async () => {
  let fail = true;
  const { api } = serverApi((path) =>
    path === '/home' && fail ? { status: 500, body: { error: 'server' } } : undefined,
  );
  await renderWithProviders(<Beranda />, { api });
  expect(await screen.findByText(ERROR_TEXT)).toBeOnTheScreen();
  fail = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
  expect(await screen.findByText('Selamat pagi, Budi')).toBeOnTheScreen();
});

test('mode server: memilih tempat memanggil PUT /places/current dan memakai jawabannya', async () => {
  const { api, fetch } = serverApi((path) =>
    path === '/places/current'
      ? { body: { ...homeBody, place: 'Kedai Dago', business: { ...homeBody.business, sales: 'Rp3.000.000' }, rev: 6 } }
      : undefined,
  );
  await renderWithProviders(
    <>
      <Beranda />
      <Tempat />
    </>,
    { api },
  );
  await screen.findByText('Rp9.900.000');
  await fireEvent.press(screen.getByRole('radio', { name: 'Kedai Dago' }));
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  const put = fetch.mock.calls.find(([u]) => String(u).endsWith('/places/current'))!;
  expect(put[1].method).toBe('PUT');
  expect(put[1].body).toBe('{"place":"Kedai Dago"}');
  expect(await screen.findByRole('button', { name: 'Tempat: Kedai Dago' })).toBeOnTheScreen();
  expect(screen.getByText('Rp3.000.000')).toBeOnTheScreen();
});

test('mode server: mode gelap', async () => {
  const { api } = serverApi();
  await renderWithProviders(<Beranda />, { api, scheme: 'dark' });
  expect(await screen.findByText('Selamat pagi, Budi')).toBeOnTheScreen();
});
