import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ERROR_TEXT } from '@/api/errors';
import { HttpTransport, type SocketLike } from '@/api/http';
import { createMemorySession } from '@/api/session';
import { advance, mockParams, restoreParams, showRoute } from './harness';
import { createTestApi, toastNow } from './helpers';

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));

const BASE = 'https://app.sekertaris.com';
const homeBody = {
  place: 'Semua',
  greetingName: null,
  summary: '',
  approvals: [],
  agendaToday: [],
  house: { lines: [] },
  business: null,
  ring: { nodes: [{ key: 'gmail', icon: 'mail', label: 'Gmail', reachable: true }] },
  rev: 1,
};
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const gmail = {
  id: 'gmail',
  name: 'Gmail',
  icon: 'mail',
  category: 'kerja',
  status: 'connected',
  account: 'rina@kopirindang.id',
  lastUsed: ago(2),
  ring: true,
};
const notion = { id: 'notion', name: 'Notion', icon: 'note', category: 'catatan', status: 'available', ring: false };
const connectionsBody = {
  connected: [
    gmail,
    {
      id: 'imou',
      name: 'Imou',
      icon: 'camera',
      category: 'rumah',
      status: 'connected',
      ring: true,
      attention: { text: 'Perlu disambungkan ulang', action: 'reconnect' },
    },
    {
      id: 'baru',
      name: 'Layanan Baru',
      icon: 'ikon-masa-depan',
      category: 'masa_depan',
      status: 'connected',
      ring: false,
    },
  ],
  catalog: [
    notion,
    { id: 'shopee', name: 'Shopee', icon: 'bag', category: 'usaha', status: 'soon', ring: false },
    { id: 'aneh', name: 'Layanan Aneh', icon: 'globe', category: 'kerja', status: 'tak_dikenal', ring: false },
  ],
  formerly: [],
  rev: 3,
};
const notionDetail = {
  service: notion,
  capabilities: [{ key: 'baca', label: 'Membaca halaman', enabled: true }],
  permission: 'baca',
  what: ['Membaca halaman yang Anda bagikan.', 'Menyimpan notulen rapat.'],
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
        : path === '/connections'
          ? { body: connectionsBody }
          : path === '/connections/notion'
            ? { body: notionDetail }
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

const open = jest.mocked(WebBrowser.openAuthSessionAsync);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams();
});
afterAll(() => restoreParams());

test('mode server: daftar dari GET /connections, kelompok dan status baru dibaca longgar, banner perlu perhatian', async () => {
  const { api, fetch } = serverApi(() => undefined);
  await showRoute('/terhubung', { api });
  expect(
    await screen.findByRole('button', { name: 'Gmail. rina@kopirindang.id · Terakhir dipakai 2 menit lalu' }),
  ).toBeOnTheScreen();
  expect(fetch.mock.calls.some(([u]) => String(u).endsWith('/app/v1/connections'))).toBe(true);
  expect(screen.getByRole('button', { name: 'Perlu dilihat: Imou. Perlu disambungkan ulang' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Imou. Perlu disambungkan ulang' })).toBeOnTheScreen();
  // kelompok baru -> Lainnya, status baru -> bisa disambungkan
  expect(screen.getByRole('button', { name: 'Layanan Baru. Aktif' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Sambungkan Layanan Aneh' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Sambungkan Notion' })).toBeOnTheScreen();
  expect(screen.getByLabelText('Shopee. Segera hadir')).toBeOnTheScreen();
  expect(screen.queryByText('Fase 5')).toBeNull();
});

test('mode server: GET /connections gagal menampilkan kalimat ramah dan Coba lagi', async () => {
  let fail = true;
  const { api } = serverApi((path) =>
    path === '/connections' && fail ? { status: 500, body: { error: 'server' } } : undefined,
  );
  await showRoute('/terhubung', { api });
  expect(await screen.findByText(ERROR_TEXT)).toBeOnTheScreen();
  fail = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
  expect(await screen.findByRole('button', { name: /^Gmail\./ })).toBeOnTheScreen();
});

test('mode server: event connection menambah layanan tanpa muat ulang; yang lebih lama dibuang', async () => {
  const { api, sockets } = serverApi(() => undefined);
  await showRoute('/terhubung', { api });
  await screen.findByRole('button', { name: /^Gmail\./ });
  await act(async () => {
    sockets[0]!.onopen?.({});
  });
  const event = (rev: number, over: object) =>
    JSON.stringify({
      type: 'connection',
      rev,
      service: { ...notion, status: 'connected', account: 'ruang-kerja', ring: true, ...over },
    });
  await act(async () => {
    sockets[0]!.onmessage?.({ data: event(4, {}) });
  });
  expect(screen.getByRole('button', { name: 'Notion. ruang-kerja' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Sambungkan Notion' })).toBeNull();
  await act(async () => {
    sockets[0]!.onmessage?.({ data: event(2, { status: 'formerly' }) });
  });
  expect(screen.getByRole('button', { name: 'Notion. ruang-kerja' })).toBeOnTheScreen();
});

test('mode server: sambung dimulai dengan POST /start, halaman resmi dibuka dengan alamat kembali, lalu Tersambung', async () => {
  let connected = false;
  const { api, fetch } = serverApi((path, init) => {
    if (path === '/connections/notion/start' && init.method === 'POST') {
      return { body: { url: 'https://www.notion.so/install-integration?state=abc', callbackScheme: 'sekretarisai' } };
    }
    if (path === '/connections' && connected) {
      return {
        body: {
          ...connectionsBody,
          connected: [...connectionsBody.connected, { ...notion, status: 'connected', ring: true }],
          catalog: [],
          rev: 4,
        },
      };
    }
    return undefined;
  });
  open.mockImplementation(async () => {
    connected = true;
    return { type: 'success', url: 'sekretarisai://terhubung/tersambung?id=notion&ok=1' };
  });
  await showRoute('/terhubung/masuk?id=notion', { api });
  expect(await screen.findByText('Membaca halaman yang Anda bagikan.')).toBeOnTheScreen();
  expect(screen.queryByText('Halaman masuk Notion')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Buka halaman Notion' }));
  await act(async () => {});
  await advance(250);
  expect(open).toHaveBeenCalledWith(
    'https://www.notion.so/install-integration?state=abc',
    'sekretarisai://terhubung/tersambung',
  );
  const post = fetch.mock.calls.find(([u]) => String(u).endsWith('/connections/notion/start'))!;
  expect(post[1].method).toBe('POST');
  expect(router.replace).toHaveBeenCalledWith('/terhubung/tersambung?id=notion');
  expect(await screen.findByText('Notion sudah terhubung')).toBeOnTheScreen();
});

test('mode server: halaman ditutup tanpa selesai, kalimat ramah dan Coba lagi', async () => {
  const { api } = serverApi((path) =>
    path === '/connections/notion/start'
      ? { body: { url: 'https://www.notion.so/x', callbackScheme: 'sekretarisai' } }
      : undefined,
  );
  open.mockResolvedValue({ type: 'cancel' } as never);
  await showRoute('/terhubung/masuk?id=notion', { api });
  await fireEvent.press(await screen.findByRole('button', { name: 'Buka halaman Notion' }));
  await act(async () => {});
  expect(
    await screen.findByText('Halaman masuk ditutup sebelum selesai, jadi belum ada yang tersambung.'),
  ).toBeOnTheScreen();
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeEnabled();
});

test('mode server: layanan menolak (ok=0 dan alasan): izin belum diberikan', async () => {
  const { api } = serverApi((path) =>
    path === '/connections/notion/start'
      ? { body: { url: 'https://www.notion.so/x', callbackScheme: 'sekretarisai' } }
      : undefined,
  );
  open.mockResolvedValue({ type: 'success', url: 'sekretarisai://terhubung/tersambung?id=notion&ok=0&reason=ditolak' });
  await showRoute('/terhubung/masuk?id=notion', { api });
  await fireEvent.press(await screen.findByRole('button', { name: 'Buka halaman Notion' }));
  await act(async () => {});
  expect(await screen.findByText('Izin dari Notion belum diberikan, jadi belum tersambung.')).toBeOnTheScreen();
  expect(router.replace).not.toHaveBeenCalled();
});

test('mode server: POST /start gagal menampilkan kalimat ramah, halaman tidak dibuka', async () => {
  const { api } = serverApi((path) =>
    path === '/connections/notion/start' ? { status: 500, body: { error: 'server' } } : undefined,
  );
  await showRoute('/terhubung/masuk?id=notion', { api });
  await fireEvent.press(await screen.findByRole('button', { name: 'Buka halaman Notion' }));
  await act(async () => {});
  expect(await screen.findByText(ERROR_TEXT)).toBeOnTheScreen();
  expect(open).not.toHaveBeenCalled();
});

test('mode server: izin diubah lewat PUT, gagal dikembalikan; hapus yang Nadia tahu lewat POST /forget; putuskan lewat DELETE', async () => {
  let putFails = true;
  const { api, fetch } = serverApi((path, init) => {
    if (path === '/connections/gmail')
      return {
        body: { service: gmail, capabilities: [], permission: 'baca', what: ['Membaca email masuk.'], memoryCount: 12 },
      };
    if (path === '/connections/gmail/permission' && init.method === 'PUT') {
      if (putFails) return { status: 500, body: { error: 'server' } };
      return {
        body: {
          service: gmail,
          capabilities: [],
          permission: 'baca_tulis',
          what: ['Membaca email masuk.'],
          memoryCount: 12,
        },
      };
    }
    if (path === '/connections/gmail/forget') return { body: { ok: true, forgotten: 12 } };
    if (path === '/connections/gmail' && init.method === 'DELETE') return { body: { ok: true } };
    return undefined;
  });
  await showRoute('/terhubung/gmail', { api });
  expect(await screen.findByText('Membaca email masuk.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'Baca dan tulis' }));
  await act(async () => {});
  expect(screen.getByRole('radio', { name: 'Baca saja' })).toBeChecked();
  expect(toastNow()?.text).toBe(ERROR_TEXT);
  putFails = false;
  await fireEvent.press(screen.getByRole('radio', { name: 'Baca dan tulis' }));
  await act(async () => {});
  const put = fetch.mock.calls.filter(
    ([u, i]) => String(u).endsWith('/connections/gmail/permission') && i.method === 'PUT',
  );
  expect(put[1]![1].body).toBe('{"permission":"baca_tulis"}');
  expect(screen.getByRole('radio', { name: 'Baca dan tulis' })).toBeChecked();

  await fireEvent.press(
    screen.getByRole('button', { name: 'Hapus yang Nadia tahu dari layanan ini. 12 hal diingat Nadia.' }),
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Ya, hapus' }));
  await advance(300);
  expect(fetch.mock.calls.some(([u]) => String(u).endsWith('/connections/gmail/forget'))).toBe(true);
  expect(toastNow()?.text).toBe('Yang Nadia pelajari dari Gmail sudah dihapus.');
});

test('mode server: putuskan memanggil DELETE dan layanan pindah ke Pernah tersambung', async () => {
  let disconnected = false;
  const { api, fetch } = serverApi((path, init) => {
    if (path === '/connections/gmail' && init.method === 'DELETE') {
      disconnected = true;
      return { body: { ok: true } };
    }
    if (path === '/connections/gmail')
      return { body: { service: gmail, capabilities: [], permission: 'baca', what: ['Membaca email masuk.'] } };
    if (path === '/connections' && disconnected) {
      return {
        body: {
          ...connectionsBody,
          connected: connectionsBody.connected.slice(1),
          formerly: [{ ...gmail, status: 'formerly', ring: false }],
          rev: 5,
        },
      };
    }
    return undefined;
  });
  await showRoute('/terhubung/gmail', { api });
  await fireEvent.press(await screen.findByRole('button', { name: 'Putuskan' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Ya, putuskan' }));
  await advance(300);
  expect(fetch.mock.calls.some(([u, i]) => String(u).endsWith('/connections/gmail') && i.method === 'DELETE')).toBe(
    true,
  );
  expect(toastNow()?.text).toBe('Gmail diputuskan.');
  expect(router.push).toHaveBeenLastCalledWith('/terhubung');
});

test('tiruan dalam mode server: sambung memakai halaman resmi, logo Plaud bergabung di Tersambung', async () => {
  const api = createTestApi({ mode: 'server', token: 'tok', connectMs: 50 });
  open.mockImplementation(async () => {
    jest.advanceTimersByTime(100);
    return { type: 'success', url: 'sekretarisai://terhubung/tersambung?id=plaud&ok=1' };
  });
  await showRoute('/terhubung/masuk?id=plaud', { api });
  await fireEvent.press(await screen.findByRole('button', { name: 'Buka halaman Plaud' }));
  await act(async () => {});
  await advance(250);
  expect(open).toHaveBeenCalledWith(expect.stringContaining('app.plaud.ai'), 'sekretarisai://terhubung/tersambung');
  expect(router.replace).toHaveBeenCalledWith('/terhubung/tersambung?id=plaud');
  expect(await screen.findByText('Plaud sudah terhubung')).toBeOnTheScreen();
  expect(screen.getByTestId('sambungan-plaud')).toBeOnTheScreen();
});

test('mode gelap: detail layanan tampil', async () => {
  const { api } = serverApi((path) =>
    path === '/connections/gmail'
      ? {
          body: {
            service: gmail,
            capabilities: [],
            permission: 'baca',
            what: ['Membaca email masuk.'],
            memoryCount: 0,
          },
        }
      : undefined,
  );
  await showRoute('/terhubung/gmail', { api, scheme: 'dark' });
  expect(await screen.findByText('Yang bisa Nadia lakukan')).toBeOnTheScreen();
  expect(
    screen.getByRole('button', {
      name: 'Hapus yang Nadia tahu dari layanan ini. Tidak ada yang Nadia ingat dari sini.',
    }),
  ).toBeOnTheScreen();
  expect(screen.getByText('0 hal')).toBeOnTheScreen();
});

test('perlu disambungkan ulang: detail menawarkan Sambungkan ulang; tanpa jalan, hanya kalimatnya', async () => {
  const imou = connectionsBody.connected[1]!;
  const withAttention = (attention: unknown) => ({
    ...connectionsBody,
    connected: connectionsBody.connected.map((x) => (x.id === 'imou' ? { ...x, attention } : x)),
  });
  const detail = (attention: unknown) => (path: string) =>
    path === '/connections'
      ? { body: withAttention(attention) }
      : path === '/connections/imou'
        ? {
            body: {
              service: { ...imou, attention },
              capabilities: [],
              permission: 'baca',
              what: ['Memberi tahu kamera tidak terjangkau.'],
              memoryCount: 0,
            },
          }
        : undefined;
  const reconnect = serverApi(detail({ text: 'Perlu disambungkan ulang', action: 'reconnect' }));
  const view = await showRoute('/terhubung/imou', { api: reconnect.api });
  expect(await screen.findByRole('button', { name: 'Sambungkan ulang Imou' })).toBeOnTheScreen();
  await view.unmount();

  const plain = serverApi((path, init) => detail({ text: 'Tidak terjangkau sejak 10.12', action: 'none' })(path));
  await showRoute('/terhubung/imou', { api: plain.api });
  expect(await screen.findByText('Memberi tahu kamera tidak terjangkau.')).toBeOnTheScreen();
  expect(screen.getAllByText('Tidak terjangkau sejak 10.12').length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: 'Sambungkan ulang Imou' })).toBeNull();
});

test('perlu disambungkan ulang: lembar masuk berlabel Sambungkan ulang dan tidak berkata sudah tersambung', async () => {
  const { api } = serverApi((path) =>
    path === '/connections/imou'
      ? {
          body: {
            service: connectionsBody.connected[1],
            capabilities: [],
            permission: 'baca',
            what: ['Memberi tahu kamera tidak terjangkau.'],
          },
        }
      : undefined,
  );
  await showRoute('/terhubung/masuk?id=imou', { api });
  expect(await screen.findByRole('button', { name: 'Sambungkan ulang' })).toBeEnabled();
  expect(screen.queryByText('Imou sudah tersambung.')).toBeNull();
});
