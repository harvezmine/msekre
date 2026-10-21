import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Beranda from '../app/(tabs)/index';
import Tempat from '../app/tempat';
import { DEVICE_UNAVAILABLE_TEXT, ERROR_TEXT } from '@/api/errors';
import { SUGGESTIONS } from '@/ui/beranda/blocks';
import { ToastHost } from '@/ui/Toast';
import { HttpTransport, type SocketLike } from '@/api/http';
import { createMemorySession } from '@/api/session';
import { renderWithProviders } from './helpers';

const BASE = 'https://app.sekertaris.com';

// Jam HP tetap pagi (tanpa jawaban agenda, sapaan memakai jam HP): tes tidak bergantung pada kapan dijalankan.
beforeEach(() => jest.setSystemTime(new Date(2025, 9, 20, 8, 0)));

/** Jawaban agenda dengan jam server `now`, untuk sapaan menurut waktu. */
const agendaAt = (now: string) => ({
  items: [],
  leftover: null,
  from: '2025-10-20',
  to: '2025-11-02',
  today: '2025-10-20',
  now,
  tzOffsetMinutes: 420,
  rev: 1,
});
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
  places: ['Rumah', 'Kedai Dago'],
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

const acDevice = {
  id: 'ac/1',
  place: 'Rumah',
  room: 'Ruang kerja',
  name: 'AC ruang kerja',
  short: 'AC kerja',
  icon: 'snow',
  kind: 'ac',
  on: true,
  reachable: true,
  capabilities: [{ type: 'power' }, { type: 'temperature', min: 16, max: 30, step: 1, unit: 'C' }],
  state: { on: true, temp: 23 },
  status: 'Nyala · 23°',
  favorite: true,
};
const devicesBody = {
  place: 'Semua',
  places: ['Rumah'],
  rooms: [{ place: 'Rumah', name: 'Ruang kerja' }],
  devices: [acDevice],
  box: null,
  routines: [],
  rev: 3,
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
            : path.startsWith('/devices')
              ? { body: devicesBody }
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

const settle = () =>
  act(async () => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
  });

test('mode server: Beranda dari GET /home dan GET /devices: sapaan, persetujuan, agenda berikutnya, favorit', async () => {
  const { api } = serverApi();
  await renderWithProviders(<Beranda />, { api });
  expect(await screen.findByText('Pagi, Budi')).toBeOnTheScreen();
  await settle();
  expect(screen.getByText('Bu Sari')).toBeOnTheScreen();
  expect(screen.getByText('Siap, Bu.')).toBeOnTheScreen();
  expect(screen.getByText('09.30')).toBeOnTheScreen();
  expect(screen.getByText('Telepon vendor')).toBeOnTheScreen();
  expect(await screen.findByRole('switch', { name: 'AC kerja' })).toBeChecked();
  expect(screen.getByText('23°')).toBeOnTheScreen();
  // Usaha, ringkasan, dan cincin tidak di Beranda; tidak ada data contoh yang bocor ke pengguna asli.
  expect(screen.queryByText('Rp9.900.000')).toBeNull();
  expect(screen.queryByText('Ada 1 hal yang perlu Anda hari ini.')).toBeNull();
  expect(screen.queryByText(/Rina|Pak Budi|Susu UHT/)).toBeNull();
});

test('mode server: Kirim memanggil POST /drafts/:id dengan send', async () => {
  const { api, fetch } = serverApi((path) =>
    path === '/drafts/d1'
      ? { body: { draft: { ...draft, status: 'held', heldUntil: '2025-10-20T01:05:00.000Z' }, rev: 9 } }
      : undefined,
  );
  await renderWithProviders(<Beranda />, { api });
  await screen.findByText('Bu Sari');
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim ke Bu Sari' }));
  await settle();
  const call = fetch.mock.calls.find(([u]) => String(u).endsWith('/drafts/d1'))!;
  expect(call[1].method).toBe('POST');
  expect(call[1].body).toBe('{"action":"send"}');
});

test('mode server: pengguna baru (tanpa persetujuan, agenda, perangkat): Halo dan satu contoh kalimat', async () => {
  const { api } = serverApi((path) =>
    path === '/home'
      ? { body: { ...homeBody, business: null, approvals: [], agendaToday: [], house: { lines: [] } } }
      : path.startsWith('/devices')
        ? { body: { ...devicesBody, devices: [] } }
        : undefined,
  );
  await renderWithProviders(<Beranda />, { api });
  expect(await screen.findByText('Halo, Budi')).toBeOnTheScreen();
  await settle();
  expect(screen.getByText('Coba bilang')).toBeOnTheScreen();
  expect(SUGGESTIONS.map((t) => `“${t}”`)).toContain(screen.getByText(/^“/).props.children);
  expect(screen.queryAllByRole('switch')).toHaveLength(0);
});

test('mode server: tanpa nama, sapaan netral', async () => {
  const { api } = serverApi((path) =>
    path === '/home' ? { body: { ...homeBody, greetingName: null, approvals: [] } } : undefined,
  );
  await renderWithProviders(<Beranda />, { api });
  expect(await screen.findByText('Selamat pagi')).toBeOnTheScreen();
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

test('mode server: sakelar favorit memanggil kendali perangkat; gagal -> toast ramah', async () => {
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
  await fireEvent.press(await screen.findByRole('switch', { name: 'AC kerja' }));
  expect(await screen.findByText(DEVICE_UNAVAILABLE_TEXT)).toBeOnTheScreen();
  const call = fetch.mock.calls.find(([u]) => String(u).endsWith('/home/devices/ac%2F1'))!;
  expect(call[1].method).toBe('POST');
  expect(call[1].body).toBe('{"on":false}');
  // Dikembalikan.
  expect(screen.getByRole('switch', { name: 'AC kerja' })).toBeChecked();
});

test('mode server: 428 pin_diperlukan dari sakelar favorit membuka lembar PIN', async () => {
  const { api } = serverApi((path) =>
    path === '/home/devices/ac%2F1' ? { status: 428, body: { error: 'pin_diperlukan' } } : undefined,
  );
  await renderWithProviders(<Beranda />, { api });
  await fireEvent.press(await screen.findByRole('switch', { name: 'AC kerja' }));
  await act(async () => {});
  expect(router.push).toHaveBeenCalledWith({ pathname: '/pin', params: { id: 'ac/1' } });
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
  expect(await screen.findByText('Pagi, Budi')).toBeOnTheScreen();
});

test('mode server: mode gelap', async () => {
  const { api } = serverApi();
  await renderWithProviders(<Beranda />, { api, scheme: 'dark' });
  expect(await screen.findByText('Pagi, Budi')).toBeOnTheScreen();
});

test('mode server: sapaan mengikuti jam di zona pengguna (dari agenda): pagi, siang, sore, malam', async () => {
  for (const [now, hello] of [
    ['06.30', 'Pagi, Budi'],
    ['12.05', 'Siang, Budi'],
    ['16.40', 'Sore, Budi'],
    ['20.10', 'Malam, Budi'],
    ['02.00', 'Malam, Budi'],
  ] as const) {
    const { api } = serverApi((path) => (path.startsWith('/agenda') ? { body: agendaAt(now) } : undefined));
    const view = await renderWithProviders(<Beranda />, { api });
    expect(await screen.findByText(hello)).toBeOnTheScreen();
    await view.unmount();
  }
});

test('mode server: agenda berikutnya hanya bila dalam 12 jam; tidak ada: bloknya tidak tampil', async () => {
  const { api } = serverApi((path) => (path === '/home' ? { body: { ...homeBody, agendaToday: [] } } : undefined));
  await renderWithProviders(<Beranda />, { api });
  expect(await screen.findByText('Pagi, Budi')).toBeOnTheScreen();
  await settle();
  expect(screen.queryByTestId('blok-agenda')).toBeNull();
  expect(screen.getByTestId('blok-persetujuan')).toBeOnTheScreen();
});

test('mode server: memilih tempat memanggil PUT /places/current', async () => {
  const { api, fetch } = serverApi((path) =>
    path === '/places/current' ? { body: { ...homeBody, place: 'Kedai Dago', rev: 6 } } : undefined,
  );
  await renderWithProviders(<Tempat />, { api });
  await fireEvent.press(await screen.findByRole('radio', { name: 'Kedai Dago' }));
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  const put = fetch.mock.calls.find(([u]) => String(u).endsWith('/places/current'))!;
  expect(put[1].method).toBe('PUT');
  expect(put[1].body).toBe('{"place":"Kedai Dago"}');
});

test('mode server: pemilih tempat memakai tempat dari server (Home.places), bukan tempat contoh', async () => {
  const { api } = serverApi();
  await renderWithProviders(<Tempat />, { api });
  await screen.findByRole('radio', { name: 'Kedai Dago' });
  expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual(['Semua', 'Rumah', 'Kedai Dago']);
  expect(screen.queryByRole('radio', { name: 'Kedai Riau' })).toBeNull();
});
