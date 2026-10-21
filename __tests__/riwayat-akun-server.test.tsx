import { act, fireEvent, screen } from '@testing-library/react-native';
import { toastNow } from './helpers';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { DRAFT_SENT_TEXT, ERROR_TEXT, INVALID_NAME_TEXT } from '@/api/errors';
import { HttpTransport, type SocketLike } from '@/api/http';
import { createMemorySession } from '@/api/session';
import { dark } from '@/theme/tokens';
import { advance, mockParams, restoreParams, showRoute } from './harness';

const BASE = 'https://app.sekertaris.com';
const me = {
  id: 'u1',
  name: 'Budi Santoso',
  assistantName: 'Nadia',
  plan: { name: 'Bisnis', activeUntil: null },
  phone: '6281220457781',
};
const homeBody = {
  place: 'Semua',
  greetingName: null,
  summary: '',
  approvals: [],
  agendaToday: [],
  house: { lines: [] },
  business: null,
  ring: { nodes: [] },
  rev: 1,
};
const soon = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
// Masa coba berakhir tengah hari WIB, lima hari kalender dari hari ini: "tersisa 5 hari" tidak bergantung jam tes
// dijalankan (sebelumnya gagal antara 00.00 dan 01.00).
const trialEnd = () => {
  const wib = new Date(Date.now() + 7 * 3_600_000);
  const noonWib = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate(), 12) - 7 * 3_600_000;
  return new Date(noonWib + 5 * 86_400_000).toISOString();
};
const entry = (id: string, minAgo: number, over: object = {}) => ({
  id,
  at: soon(-minAgo),
  kind: 'rumah',
  icon: 'bulb',
  title: `Entri ${id}`,
  ...over,
});
const account = (over: object = {}) => ({
  me,
  plan: { name: 'Coba', status: 'trial', until: trialEnd(), price: 99000 },
  assistant: { name: 'Nadia', style: 'ramah' },
  greeting: { daily: true, time: '07.00' },
  notifications: { pesan: true, pengingat: true, ringkasanHarian: true, rumah: true, usaha: true },
  security: { pinEnabled: false, hasPin: false },
  phones: [
    { id: 'p1', name: 'Pixel 8', platform: 'android', lastSeen: soon(0), current: true },
    { id: 'p2', name: 'Galaxy A54', platform: 'android', lastSeen: soon(-3 * 1440), current: false },
  ],
  privacy: { services: [{ id: 'gmail', name: 'Gmail', memoryCount: 12 }] },
  rev: 3,
  ...over,
});

class Socket implements SocketLike {
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data?: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: { code?: number }) => void) | null = null;
  close() {}
}

type Handler = (path: string, init: RequestInit) => { status?: number; body?: unknown } | undefined;
function serverApi(handler: Handler) {
  const sockets: Socket[] = [];
  const fetch = jest.fn(async (url: string, init: RequestInit) => {
    const path = url.replace(`${BASE}/app/v1`, '');
    const r =
      handler(path, init) ??
      (path === '/me'
        ? { body: me }
        : path === '/home'
          ? { body: homeBody }
          : path === '/account'
            ? { body: account() }
            : path.startsWith('/history')
              ? { body: { items: [], before: null, rev: 1 } }
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
  const calls = (method: string, path: string) =>
    fetch.mock.calls.filter(([u, i]) => String(u) === `${BASE}/app/v1${path}` && (i as RequestInit).method === method);
  return { api: { mode: 'server' as const, session: createMemorySession('tok'), transport }, fetch, sockets, calls };
}

const config = Constants.expoConfig as { extra?: Record<string, unknown> };
beforeEach(() => {
  jest.clearAllMocks();
  mockParams();
  config.extra = { waNumber: '6281110003333' };
});
afterEach(() => {
  delete config.extra;
  jest.restoreAllMocks();
});
afterAll(restoreParams);

async function settle() {
  for (let i = 0; i < 3; i++) await advance(0);
}

describe('Riwayat lewat HttpTransport', () => {
  const page1 = {
    items: [
      entry('a', 5, { kind: 'kirim', detail: 'lewat WhatsApp', status: 'terkirim', channel: 'whatsapp' }),
      entry('b', 10, { kind: 'jenis_baru', title: 'Hal dari masa depan' }),
      { id: 'rusak' },
      entry('c', 20, { channel: 'sms', status: 'aneh', link: 7 }),
    ],
    before: 'c',
    rev: 4,
    now: new Date().toISOString(),
  };

  test('daftar dari GET /history: entri rusak dibuang, jenis baru jadi lainnya, keterangan rusak diabaikan', async () => {
    const { api, calls } = serverApi((path) => (path === '/history' ? { body: page1 } : undefined));
    await showRoute('/riwayat', { api });
    await settle();
    expect(calls('GET', '/history').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Entri a')).toBeOnTheScreen();
    expect(screen.getByText(/^\d\d\.\d\d · lewat WhatsApp$/)).toBeOnTheScreen();
    expect(screen.getByText('Terkirim')).toBeOnTheScreen();
    expect(screen.getByText('Hal dari masa depan')).toBeOnTheScreen();
    expect(screen.getByText('Entri c')).toBeOnTheScreen();
    expect(screen.getByText('Hari ini')).toBeOnTheScreen();
  });

  test('halaman berikutnya memakai penanda; saringan memakai ?kind=', async () => {
    const { api, calls } = serverApi((path) => {
      if (path === '/history') return { body: page1 };
      if (path === '/history?before=c') return { body: { items: [entry('d', 30)], before: null, rev: 4 } };
      if (path === '/history?kind=usaha')
        return { body: { items: [entry('u', 1, { kind: 'usaha' })], before: null, rev: 4 } };
      return undefined;
    });
    await showRoute('/riwayat', { api });
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Tampilkan yang lebih lama' }));
    await settle();
    expect(calls('GET', '/history?before=c')).toHaveLength(1);
    expect(screen.getByText('Entri d')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Tampilkan yang lebih lama' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Usaha' }));
    await settle();
    expect(calls('GET', '/history?kind=usaha')).toHaveLength(1);
    expect(screen.getByText('Entri u')).toBeOnTheScreen();
    expect(screen.queryByText('Entri a')).toBeNull();
  });

  test('Batalkan: POST /drafts/:id cancel dengan hitung mundur dari jam server; event history menimpa entrinya', async () => {
    // Jam server 2 menit di depan jam HP: sisa waktu dihitung dari jam server.
    const serverNow = Date.now() + 120_000;
    const held = entry('k', 1, {
      kind: 'kirim',
      status: 'menunggu',
      undoable: { draftId: 'o-1', until: new Date(serverNow + 270_000).toISOString() },
      link: { route: '/chat' },
    });
    const newer = { ...held, status: 'dibatalkan', undoable: undefined, title: 'Kiriman lain' };
    // Server sungguhan tidak menurunkan `rev`: setelah event 6, muat ulang pun membawa keadaan yang sama atau lebih baru.
    let eventSent = false;
    const { api, calls, sockets } = serverApi((path, init) => {
      if (path === '/history') {
        const body = eventSent
          ? { items: [newer], before: null, rev: 6, now: new Date(serverNow).toISOString() }
          : { items: [held], before: null, rev: 4, now: new Date(serverNow).toISOString() };
        return { body };
      }
      if (path === '/drafts/o-1' && init.method === 'POST') {
        return {
          body: {
            draft: { id: 'o-1', to: 'Pak Budi', channel: 'whatsapp', what: 'balasan', text: 'x', status: 'cancelled' },
            rev: 5,
          },
        };
      }
      return undefined;
    });
    await showRoute('/riwayat', { api });
    await settle();
    expect(screen.getByText('sisa 4:30')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
    await settle();
    expect(JSON.parse(String(calls('POST', '/drafts/o-1')[0]![1]!.body))).toEqual({ action: 'cancel' });
    expect(screen.getByText('Dibatalkan')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Batalkan' })).toBeNull();
    // Event dari server (rev lebih baru) tetap menimpa; yang lebih lama dibuang.
    await act(async () => {
      eventSent = true;
      sockets[0]!.onopen?.({});
      sockets[0]!.onmessage?.({
        data: JSON.stringify({ type: 'history', rev: 6, entry: newer }),
      });
      sockets[0]!.onmessage?.({
        data: JSON.stringify({ type: 'history', rev: 2, entry: entry('lama', 1, { title: 'Terlalu lama' }) }),
      });
    });
    expect(screen.getByText('Kiriman lain')).toBeOnTheScreen();
    expect(screen.queryByText('Terlalu lama')).toBeNull();
  });

  test('Batalkan setelah terlanjur terkirim (409): kalimat ramah dan daftar dimuat ulang', async () => {
    let sent = false;
    const held = entry('k', 1, {
      kind: 'kirim',
      status: 'menunggu',
      undoable: { draftId: 'o-1', until: soon(4) },
    });
    const { api } = serverApi((path) => {
      if (path === '/history') {
        return {
          body: { items: [sent ? { ...held, status: 'terkirim', undoable: undefined } : held], before: null, rev: 4 },
        };
      }
      if (path === '/drafts/o-1') {
        sent = true;
        return { status: 409, body: { error: 'status_draf' } };
      }
      return undefined;
    });
    await showRoute('/riwayat', { api });
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
    await settle();
    expect(toastNow()?.text).toBe(DRAFT_SENT_TEXT);
    expect(screen.getByText('Terkirim')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Batalkan' })).toBeNull();
  });

  test('GET /history gagal: kalimat ramah, lalu Coba lagi', async () => {
    let fail = true;
    const { api } = serverApi((path) =>
      path === '/history' && fail
        ? { status: 500, body: { error: 'server' } }
        : path === '/history'
          ? { body: page1 }
          : undefined,
    );
    await showRoute('/riwayat', { api });
    await settle();
    expect(screen.getByText(ERROR_TEXT)).toBeOnTheScreen();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
    await settle();
    expect(screen.getByText('Entri a')).toBeOnTheScreen();
  });
});

describe('Akun lewat HttpTransport', () => {
  test('GET /account: paket masa coba, perangkat, dan baris pengaturan dari server', async () => {
    const { api, calls } = serverApi(() => undefined);
    await showRoute('/akun', { api });
    await settle();
    expect(calls('GET', '/account').length).toBeGreaterThan(0);
    expect(screen.getByText('Budi Santoso')).toBeOnTheScreen();
    expect(screen.getByText('Paket Coba')).toBeOnTheScreen();
    expect(screen.getByText('Coba gratis, tersisa 5 hari')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'HP yang terhubung. Pixel 8 (HP ini) dan 1 lainnya' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sapaan harian. Tiap hari jam 07.00' })).toBeOnTheScreen();
    expect(screen.queryByText(/Fase|dibangun|Rina/)).toBeNull();
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Perpanjang' }));
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/6281110003333\?text=/));
  });

  test('ganti nama: PUT /account/assistant, lalu nama baru di baris Akun, Beranda, dan /me', async () => {
    let name = 'Nadia';
    const { api, calls } = serverApi((path, init) => {
      if (path === '/account/assistant' && init.method === 'PUT') {
        name = (JSON.parse(String(init.body)) as { name: string }).name;
        return { body: account({ assistant: { name, style: 'ramah' }, me: { ...me, assistantName: name }, rev: 4 }) };
      }
      if (path === '/account') {
        return { body: account({ assistant: { name, style: 'ramah' }, me: { ...me, assistantName: name } }) };
      }
      return undefined;
    });
    await showRoute('/', { api });
    await settle();
    expect(screen.getByRole('button', { name: 'Nadia' })).toBeOnTheScreen();
    await act(async () => {
      router.push('/akun/asisten');
    });
    await settle();
    await fireEvent.changeText(screen.getByLabelText('Nama asisten'), 'Sari');
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
    await settle();
    expect(JSON.parse(String(calls('PUT', '/account/assistant')[0]![1]!.body))).toEqual({ name: 'Sari' });
    expect(screen.getByRole('button', { name: 'Sari' })).toBeOnTheScreen();
  });

  test('server menolak nama (400 nama_tidak_valid): teks ramah di bawah kolom', async () => {
    const { api } = serverApi((path, init) =>
      path === '/account/assistant' && init.method === 'PUT'
        ? { status: 400, body: { error: 'nama_tidak_valid' } }
        : undefined,
    );
    await showRoute('/akun/asisten', { api });
    await settle();
    await fireEvent.changeText(screen.getByLabelText('Nama asisten'), 'Sari');
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
    await settle();
    expect(screen.getByText(INVALID_NAME_TEXT)).toBeOnTheScreen();
  });

  test('saklar notifikasi: PUT /account/notifications; gagal 500 mengembalikan dan memberi toast', async () => {
    let fail = true;
    const { api, calls } = serverApi((path, init) => {
      if (path === '/account/notifications' && init.method === 'PUT') {
        if (fail) return { status: 500, body: { error: 'server' } };
        const patch = JSON.parse(String(init.body)) as object;
        return {
          body: account({
            notifications: { pesan: true, pengingat: true, ringkasanHarian: true, rumah: true, usaha: true, ...patch },
            rev: 5,
          }),
        };
      }
      return undefined;
    });
    await showRoute('/akun/notifikasi', { api });
    await settle();
    await fireEvent.press(screen.getByRole('switch', { name: 'Usaha' }));
    await settle();
    expect(screen.getByRole('switch', { name: 'Usaha' })).toBeChecked();
    expect(toastNow()?.text).toBe(ERROR_TEXT);
    fail = false;
    await fireEvent.press(screen.getByRole('switch', { name: 'Usaha' }));
    await settle();
    expect(JSON.parse(String(calls('PUT', '/account/notifications')[1]![1]!.body))).toEqual({ usaha: false });
    expect(screen.getByRole('switch', { name: 'Usaha' })).not.toBeChecked();
  });

  test('keluarkan HP: DELETE /account/phones/:id', async () => {
    const { api, calls } = serverApi((path, init) =>
      path === '/account/phones/p2' && init.method === 'DELETE'
        ? { body: account({ phones: [account().phones[0]], rev: 5 }) }
        : undefined,
    );
    await showRoute('/akun/hp', { api });
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Keluarkan Galaxy A54' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Ya, keluarkan' }));
    await advance(300);
    await settle();
    expect(calls('DELETE', '/account/phones/p2')).toHaveLength(1);
    expect(screen.queryByText('Galaxy A54')).toBeNull();
    expect(screen.getByText('Pixel 8 (HP ini)')).toBeOnTheScreen();
  });

  test('event account dari server menggantikan Akun; GET /account gagal: Coba lagi', async () => {
    let fail = true;
    const { api, sockets } = serverApi((path) =>
      path === '/account' && fail ? { status: 500, body: { error: 'server' } } : undefined,
    );
    await showRoute('/akun/privasi', { api });
    await settle();
    expect(screen.getByText(ERROR_TEXT)).toBeOnTheScreen();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
    await settle();
    expect(screen.getByText('12 hal diingat')).toBeOnTheScreen();
    await act(async () => {
      sockets[0]!.onopen?.({});
      sockets[0]!.onmessage?.({
        data: JSON.stringify({
          type: 'account',
          account: account({ privacy: { services: [{ id: 'gmail', name: 'Gmail', memoryCount: 0 }] }, rev: 9 }),
        }),
      });
    });
    expect(screen.getByText('Tidak ada yang diingat')).toBeOnTheScreen();
  });

  test('mode gelap', async () => {
    const { api } = serverApi(() => undefined);
    await showRoute('/akun/hp', { api, scheme: 'dark' });
    await settle();
    expect(screen.getByText('Galaxy A54')).toHaveStyle({ color: dark.text });
  });
});
