import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Perangkat from '../app/(tabs)/perangkat';
import { ERROR_TEXT } from '@/api/errors';
import { HttpTransport, type SocketLike } from '@/api/http';
import { createMemorySession } from '@/api/session';
import { ToastHost } from '@/ui/Toast';
import { renderWithProviders } from './helpers';

const BASE = 'https://app.sekertaris.com';
const dev = (o: Record<string, unknown>) => ({
  place: 'Rumah',
  room: 'Ruang tamu',
  icon: 'bulb',
  kind: 'lamp',
  on: true,
  reachable: true,
  status: 'Nyala',
  ...o,
});
const lamp = dev({ id: 'l1', name: 'Lampu baca' });
const door = dev({ id: 'k1', name: 'Gerbang', icon: 'lock', kind: 'lock', sensitive: true, status: 'Terkunci' });
const devicesBody = {
  place: 'Rumah',
  places: ['Rumah'],
  rooms: [{ place: 'Rumah', name: 'Ruang tamu' }],
  devices: [lamp, door],
  box: null,
  routines: [{ id: 'tidur', name: 'Tidur', icon: 'moon', summary: 'Lampu mati', places: ['Rumah'] }],
  rev: 3,
};
const homeBody = {
  place: 'Rumah',
  greetingName: null,
  summary: '',
  approvals: [],
  agendaToday: [],
  house: { lines: [] },
  business: null,
  ring: { nodes: [] },
  rev: 1,
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
        : path.startsWith('/devices')
          ? { body: devicesBody }
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

test('mode server: Perangkat dari GET /devices, kendali lewat POST, dan event device', async () => {
  const { api, fetch, sockets } = serverApi((path) =>
    path === '/home/devices/l1'
      ? {
          body: {
            device: { ...lamp, on: false, status: 'Mati' },
            card: {
              kind: 'device',
              deviceId: 'l1',
              name: 'Lampu baca',
              on: false,
            },
          },
        }
      : undefined,
  );
  await renderWithProviders(<Perangkat />, { api });
  expect(await screen.findByText('Lampu baca')).toBeOnTheScreen();
  expect(screen.getByText('Gerbang')).toBeOnTheScreen();
  expect(screen.getByText('Lampu mati')).toBeOnTheScreen();
  expect(fetch.mock.calls.some(([u]) => String(u).endsWith('/devices?place=Rumah'))).toBe(true);
  await fireEvent.press(screen.getByRole('switch', { name: 'Lampu baca, Nyala' }));
  await act(async () => {});
  const post = fetch.mock.calls.find(([u]) => String(u).endsWith('/home/devices/l1'))!;
  expect(post[1].body).toBe('{"on":false}');
  expect(screen.getByText('Mati')).toBeOnTheScreen();
  // event stream menyalakan lagi
  await act(async () => {
    sockets[0]!.onopen?.({});
  });
  await act(async () => {
    sockets[0]!.onmessage?.({
      data: JSON.stringify({ type: 'device', devices: [{ ...lamp, status: 'Nyala · 50%' }], rev: 4 }),
    });
  });
  expect(screen.getByText('Nyala · 50%')).toBeOnTheScreen();
});

test('mode server: kendali gagal mengembalikan sakelar dan menampilkan toast', async () => {
  const { api } = serverApi((path) =>
    path === '/home/devices/l1' ? { status: 500, body: { error: 'server' } } : undefined,
  );
  await renderWithProviders(
    <>
      <Perangkat />
      <ToastHost />
    </>,
    { api },
  );
  await fireEvent.press(await screen.findByRole('switch', { name: 'Lampu baca, Nyala' }));
  expect(await screen.findByText(ERROR_TEXT)).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: 'Lampu baca, Nyala' })).toBeOnTheScreen();
});

test('mode server: 428 pin_diperlukan dari perangkat mana pun membuka lembar PIN (bukan toast buntu)', async () => {
  const { api } = serverApi((path) =>
    path === '/home/devices/l1' ? { status: 428, body: { error: 'pin_diperlukan' } } : undefined,
  );
  await renderWithProviders(<Perangkat />, { api });
  await fireEvent.press(await screen.findByRole('switch', { name: 'Lampu baca, Nyala' }));
  await act(async () => {});
  expect(router.push).toHaveBeenCalledWith({ pathname: '/pin', params: { id: 'l1' } });
});

test('mode server: PIN mati, membuka kunci bertanya dulu tanpa mengirim apa pun; PIN hidup membuka lembar PIN', async () => {
  let pinEnabled = false;
  const { api, fetch } = serverApi((path) =>
    path === '/account/security' ? { body: { pinEnabled, hasPin: pinEnabled } } : undefined,
  );
  await renderWithProviders(<Perangkat />, { api });
  await fireEvent.press(await screen.findByRole('switch', { name: 'Gerbang, Terkunci' }));
  await act(async () => {});
  expect(router.push).toHaveBeenCalledWith({ pathname: '/buka-kunci', params: { id: 'k1' } });
  expect(fetch.mock.calls.some(([u]) => String(u).endsWith('/home/devices/k1'))).toBe(false);
  jest.mocked(router.push).mockClear();
  pinEnabled = true;
  await fireEvent.press(screen.getByRole('switch', { name: 'Gerbang, Terkunci' }));
  await act(async () => {});
  expect(router.push).toHaveBeenCalledWith({ pathname: '/pin', params: { id: 'k1' } });
});

test('mode server: kotak ditaruh di ruangan perangkat ber-id box.deviceId, dengan nama ruangan apa pun', async () => {
  const kotak = dev({ id: 'kt', name: 'Kotak', icon: 'box', kind: 'box', room: 'Kamar utama', status: 'Aktif' });
  const lampuTamu = dev({ id: 'l2', name: 'Lampu tamu', room: 'Ruang keluarga' });
  const body = {
    ...devicesBody,
    rooms: [
      { place: 'Rumah', name: 'Ruang keluarga' },
      { place: 'Rumah', name: 'Kamar utama' },
    ],
    devices: [lampuTamu, kotak],
    box: { deviceId: 'kt', online: true, micOn: true, speaker: 'Speaker', roomTemp: 27, humidity: 60 },
  };
  const { api } = serverApi((path) => (path.startsWith('/devices') ? { body } : undefined));
  await renderWithProviders(<Perangkat />, { api });
  expect(await screen.findByText('Lampu tamu')).toBeOnTheScreen();
  // Ruangan pertama (Ruang keluarga) tidak memuat Kotak, dan Kotak tidak digambar sebagai ubin.
  expect(screen.queryByText('Kotak Sekretaris AI')).toBeNull();
  expect(screen.queryByText('Kotak')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Kamar utama' }));
  expect(screen.getByText('Kotak Sekretaris AI')).toBeOnTheScreen();
  expect(screen.queryByText('Lampu tamu')).toBeNull();
});

test('mode server: belum ada perangkat — kalimat yang membantu; selagi memuat — Sebentar ya', async () => {
  const empty = { ...devicesBody, devices: [], box: null, routines: [] };
  const { api } = serverApi((path) => (path.startsWith('/devices') ? { body: empty } : undefined));
  await renderWithProviders(<Perangkat />, { api });
  expect(
    await screen.findByText('Belum ada perangkat. Tambahkan dari tombol + atau sambungkan layanan rumah di Terhubung.'),
  ).toBeOnTheScreen();
});

test('mode server: gagal memuat menampilkan kalimat ramah dan Coba lagi', async () => {
  let fail = true;
  const { api } = serverApi((path) =>
    path.startsWith('/devices') && fail ? { status: 500, body: { error: 'server' } } : undefined,
  );
  await renderWithProviders(<Perangkat />, { api });
  expect(await screen.findByText(ERROR_TEXT)).toBeOnTheScreen();
  fail = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
  expect(await screen.findByText('Lampu baca')).toBeOnTheScreen();
});

test('mode server: mode gelap', async () => {
  const { api } = serverApi(() => undefined);
  await renderWithProviders(<Perangkat />, { api, scheme: 'dark' });
  expect(await screen.findByText('Lampu baca')).toBeOnTheScreen();
});
