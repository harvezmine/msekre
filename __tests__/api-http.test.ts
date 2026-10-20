import type { Message, StreamEvent } from '@/api/contract';
import {
  BLOCKED_TEXT,
  ERROR_TEXT,
  friendlyError,
  NOT_REGISTERED_TEXT,
  WRONG_PIN_TEXT,
  UNAVAILABLE_TEXT,
  UPGRADE_TEXT,
  WRONG_CODE_TEXT,
} from '@/api/errors';
import { CONNECT_TIMEOUT_MS, HttpTransport, REQUEST_TIMEOUT_MS, STREAM_SILENCE_MS, type SocketLike } from '@/api/http';
import { createMemorySession, type Session } from '@/api/session';
import { ApiFailure, type ConnectionStatus } from '@/api/transport';

const BASE = 'https://app.sekertaris.com';
const me = {
  id: 'u1',
  name: 'Rina',
  assistantName: 'Nadia',
  plan: { name: 'Bisnis', activeUntil: null },
  phone: '6281220457781',
};
const message: Message = {
  id: 'm1',
  seq: 1,
  rev: 1,
  clientId: 'c1',
  at: '2026-10-20T03:42:00.000Z',
  from: 'user',
  via: 'app',
  parts: [{ type: 'text', text: 'Halo' }],
};
const acCard = { kind: 'device', deviceId: 'ac/1', name: 'AC kamar', on: true, temp: 22 };
const draft = { id: 'd1', to: 'Pak Budi', channel: 'whatsapp', what: 'balasan', text: 'Halo', status: 'draft' };

interface Reply {
  status?: number;
  body?: unknown;
  raw?: string;
}

/** fetch tiruan: mencatat setiap panggilan dan menjawab dari `reply` (bawaan 200 dengan isi `body`). */
function fakeFetch(reply: (url: string, init: RequestInit) => Reply | Promise<Reply> = () => ({ body: {} })) {
  const fn = jest.fn(async (url: string, init: RequestInit) => {
    const r = await reply(url, init);
    const status = r.status ?? 200;
    const text = r.raw ?? (r.body === undefined ? '' : JSON.stringify(r.body));
    return { status, ok: status >= 200 && status < 300, text: async () => text };
  });
  return fn;
}

class FakeSocket implements SocketLike {
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data?: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: { code?: number }) => void) | null = null;
  closedWith: number | null = null;
  constructor(
    readonly url: string,
    readonly headers: Record<string, string> = {},
  ) {}
  close(code = 1000) {
    this.closedWith = code;
  }
  open() {
    this.onopen?.({});
  }
  send(event: unknown) {
    this.onmessage?.({ data: typeof event === 'string' ? event : JSON.stringify(event) });
  }
  drop(code = 1006) {
    this.onerror?.({});
    this.onclose?.({ code });
  }
}

/** Transport yang dibuat tes; dilepas setelah tiap tes supaya timer koneksinya tidak bocor ke tes berikutnya. */
const created: HttpTransport[] = [];
afterEach(() => {
  for (const t of created.splice(0)) t.dispose();
});

function setup({
  token = 'tok' as string | null,
  reply,
}: { token?: string | null; reply?: Parameters<typeof fakeFetch>[0] } = {}) {
  const session = createMemorySession(token);
  const fetch = fakeFetch(reply);
  const sockets: FakeSocket[] = [];
  const transport = new HttpTransport(`${BASE}/`, session, {
    fetch: fetch as unknown as typeof globalThis.fetch,
    socket: (url, headers) => {
      const s = new FakeSocket(url, headers);
      sockets.push(s);
      return s;
    },
    random: () => 0.5,
    appVersion: '1.2.3',
  });
  created.push(transport);
  return { session, fetch, sockets, transport };
}

const call = (fetch: ReturnType<typeof fakeFetch>, i = 0) => {
  const [url, init] = fetch.mock.calls[i]!;
  return { url, method: init.method, headers: init.headers as Record<string, string>, body: init.body };
};

/** Pendengar stream yang mencatat event, status, dan permintaan resync. */
function listen(transport: HttpTransport, onResync?: (lastRev: number | undefined) => void) {
  const events: StreamEvent[] = [];
  const statuses: ConnectionStatus[] = [];
  const lastRevs: (number | undefined)[] = [];
  let resyncs = 0;
  const stop = transport.subscribe(
    (e) => events.push(e),
    (s) => statuses.push(s),
    (lastRev) => {
      resyncs += 1;
      lastRevs.push(lastRev);
      onResync?.(lastRev);
    },
  );
  return { events, statuses, lastRevs, stop, resyncs: () => resyncs, last: () => statuses[statuses.length - 1] };
}

const flush = () => jest.advanceTimersByTimeAsync(0);

describe('HTTP', () => {
  test('URL, metode, header, dan isi sesuai kontrak', async () => {
    const { fetch, transport } = setup({
      reply: (url) => {
        if (url.endsWith('/auth/start')) return { body: { resendInSec: 60 } };
        if (url.endsWith('/me')) return { body: me };
        if (url.includes('/messages?') && url.includes('changedAfter='))
          return { body: { items: [message], more: false } };
        if (url.includes('/messages?')) return { body: { items: [message], before: null } };
        if (url.includes('/home/devices/')) return { body: { card: acCard } };
        if (url.endsWith('/messages')) return { body: { message } };
        if (url.includes('/drafts/')) return { body: { draft, rev: 9 } };
        return { body: { ok: true } };
      },
    });

    expect(await transport.authStart({ phone: '6281220457781' })).toEqual({ resendInSec: 60 });
    expect(call(fetch, 0)).toEqual({
      url: `${BASE}/app/v1/auth/start`,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-App-Version': '1.2.3',
        'X-Contract-Version': '1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: '6281220457781' }),
    });

    expect(await transport.me()).toEqual(me);
    expect(call(fetch, 1)).toEqual({
      url: `${BASE}/app/v1/me`,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-App-Version': '1.2.3',
        'X-Contract-Version': '1',
        Authorization: 'Bearer tok',
      },
      body: undefined,
    });

    await transport.messages();
    await transport.messages(12);
    expect(call(fetch, 2).url).toBe(`${BASE}/app/v1/messages?limit=30`);
    expect(call(fetch, 3).url).toBe(`${BASE}/app/v1/messages?limit=30&before=12`);

    expect(await transport.send({ kind: 'text', clientId: 'c1', text: 'Halo' })).toEqual(message);
    expect(call(fetch, 4)).toMatchObject({
      url: `${BASE}/app/v1/messages`,
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'text', clientId: 'c1', text: 'Halo' }),
    });

    expect(await transport.draftAction('d/1', { action: 'send' })).toEqual({ draft, rev: 9 });
    expect(call(fetch, 5)).toMatchObject({ url: `${BASE}/app/v1/drafts/d%2F1`, body: '{"action":"send"}' });

    await transport.registerPushToken({ pushToken: 'p1', platform: 'android' });
    expect(call(fetch, 6)).toMatchObject({ url: `${BASE}/app/v1/push-tokens`, method: 'POST' });

    expect(await transport.mediaUrl('q 1')).toEqual({
      kind: 'uri',
      uri: `${BASE}/app/v1/media/q%201`,
      headers: { Authorization: 'Bearer tok' },
    });
    expect(await transport.messagesChanged(7)).toEqual({ items: [message], more: false });
    expect(call(fetch, 7).url).toBe(`${BASE}/app/v1/messages?limit=100&changedAfter=7`);

    expect(await transport.controlDevice('ac/1', { on: true, temp: 22 })).toEqual(acCard);
    expect(call(fetch, 8)).toMatchObject({
      url: `${BASE}/app/v1/home/devices/ac%2F1`,
      method: 'POST',
      body: '{"on":true,"temp":22}',
    });
    expect(fetch).toHaveBeenCalledTimes(9);
  });

  test('masuk menyimpan token ke sesi', async () => {
    const { session, transport } = setup({ token: null, reply: () => ({ body: { token: 'baru', user: me } }) });
    expect(await transport.authVerify({ phone: '6281220457781', code: '123456' })).toEqual({ token: 'baru', user: me });
    expect(await session.get()).toBe('baru');
  });

  test('kode salah', async () => {
    const { session, transport } = setup({
      token: null,
      reply: () => ({ status: 400, body: { error: 'kode_salah' } }),
    });
    const e = await transport.authVerify({ phone: '6281220457781', code: '000000' }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiFailure);
    expect(e).toMatchObject({ code: 'kode_salah', status: 400, error: 'kode_salah' });
    expect(friendlyError(e)).toBe(WRONG_CODE_TEXT);
    expect(await session.get()).toBeNull();
  });

  test('401 menghapus sesi', async () => {
    const { session, fetch, transport } = setup({ reply: () => ({ status: 401, body: { error: 'tidak_masuk' } }) });
    const changes: (string | null)[] = [];
    session.onChange((t) => changes.push(t));

    await expect(transport.me()).rejects.toMatchObject({ code: 'unauthorized', status: 401, error: 'tidak_masuk' });
    expect(await session.get()).toBeNull();
    expect(changes).toEqual([null]);

    // Tanpa sesi tidak ada request yang keluar.
    await expect(transport.messages()).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(transport.mediaUrl('q1')).rejects.toMatchObject({ code: 'unauthorized' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test.each<[string, Reply, object]>([
    ['aksi draf yang telat', { status: 409, body: { error: 'status_draf' } }, { status: 409, error: 'status_draf' }],
    ['kode error baru', { status: 400, body: { error: 'kode_baru' } }, { status: 400, error: 'kode_baru' }],
    ['halaman error bukan JSON', { status: 502, raw: '<html>Bad gateway</html>' }, { status: 502, error: undefined }],
    ['jawaban yang bentuknya salah', { body: { id: 1 } }, { status: 200 }],
    ['jawaban kosong', { raw: '' }, { status: 200 }],
  ])('%s menjadi kendala server', async (_, reply, details) => {
    const { transport } = setup({ reply: () => reply });
    const e = await transport.me().catch((x: unknown) => x);
    expect(e).toMatchObject({ code: 'server', ...details });
    expect(friendlyError(e)).toBe(ERROR_TEXT);
  });

  test('tanpa sinyal menjadi kendala jaringan dengan teks ramah', async () => {
    const { transport } = setup({
      reply: () => {
        throw new TypeError('Network request failed');
      },
    });
    const e = await transport.me().catch((x: unknown) => x);
    expect(e).toMatchObject({ code: 'network' });
    expect(friendlyError(e)).toBe(ERROR_TEXT);
  });

  test('batas waktu 15 detik menghasilkan error ramah dan membatalkan request', async () => {
    let signal: AbortSignal | undefined;
    const { transport } = setup({
      reply: (_, init) => {
        signal = init.signal ?? undefined;
        return new Promise<Reply>((_, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted'))));
      },
    });
    let failure: unknown;
    void transport.me().catch((x: unknown) => (failure = x));
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(failure).toBeUndefined();
    await jest.advanceTimersByTimeAsync(1);
    expect(failure).toMatchObject({ code: 'timeout' });
    expect(friendlyError(failure)).toBe(ERROR_TEXT);
    expect(signal?.aborted).toBe(true);
  });

  test('keluar menghapus sesi, juga saat server tidak terjangkau', async () => {
    const ok = setup({ reply: () => ({ body: { ok: true } }) });
    // Sesi hilang lebih dulu; pemberitahuan ke server menyusul dengan token tadi.
    await ok.transport.logout();
    expect(await ok.session.get()).toBeNull();
    await flush();
    expect(call(ok.fetch)).toMatchObject({ url: `${BASE}/app/v1/auth/logout`, method: 'POST' });
    expect(call(ok.fetch).headers.Authorization).toBe('Bearer tok');
    expect(await ok.session.get()).toBeNull();

    const offline = setup({
      reply: () => {
        throw new TypeError('Network request failed');
      },
    });
    await expect(offline.transport.logout()).resolves.toBeUndefined();
    expect(await offline.session.get()).toBeNull();
    await flush();
    expect(offline.fetch).toHaveBeenCalledTimes(1);

    // Server lambat: HP sudah keluar sebelum server menjawab.
    let answer: () => void = () => {};
    const slow = setup({
      reply: () => new Promise((resolve) => (answer = () => resolve({ body: { ok: true } }))),
    });
    await slow.transport.logout();
    expect(await slow.session.get()).toBeNull();
    answer();
    await flush();

    // Tanpa sesi: tidak ada yang dikirim.
    const none = setup({ token: null });
    await none.transport.logout();
    await flush();
    expect(none.fetch).not.toHaveBeenCalled();
  });
});

describe('mencabut token notifikasi', () => {
  test('DELETE /push-tokens tanpa token masuk, dengan token di isi', async () => {
    const { fetch, transport } = setup({ token: null, reply: () => ({ body: { ok: true } }) });
    await transport.unregisterPushToken({ pushToken: 'p1' });
    const sent = call(fetch);
    expect(sent).toMatchObject({ url: `${BASE}/app/v1/push-tokens`, method: 'DELETE', body: '{"pushToken":"p1"}' });
    expect(sent.headers.Authorization).toBeUndefined();
  });

  test('gagal jaringan dilempar sebagai ApiFailure', async () => {
    const { transport } = setup({
      token: null,
      reply: () => {
        throw new Error('putus');
      },
    });
    await expect(transport.unregisterPushToken({ pushToken: 'p1' })).rejects.toMatchObject({ code: 'network' });
  });
});

describe('WebSocket', () => {
  test('tersambung dengan token, event diteruskan, ping dan event rusak dilewati', async () => {
    const { sockets, transport } = setup();
    const l = listen(transport);
    await flush();
    expect(sockets).toHaveLength(1);
    // Token lewat header, tidak pernah di URL.
    expect(sockets[0]!.url).toBe('wss://app.sekertaris.com/app/v1/stream');
    expect(sockets[0]!.headers).toEqual({
      Authorization: 'Bearer tok',
      'X-App-Version': '1.2.3',
      'X-Contract-Version': '1',
    });
    expect(l.statuses).toEqual(['closed', 'connecting']);

    sockets[0]!.open();
    expect(l.last()).toBe('open');
    sockets[0]!.send({ type: 'ping' });
    sockets[0]!.send({ type: 'thinking', runId: 'r1', on: true });
    sockets[0]!.send({ type: 'thinking', on: true });
    sockets[0]!.send('bukan json');
    sockets[0]!.send({ type: 'mengetik' });
    sockets[0]!.send({ type: 'message', message: { ...message, id: undefined } });
    sockets[0]!.send({ type: 'message', message });
    expect(l.events).toEqual([
      { type: 'thinking', runId: 'r1', on: true },
      { type: 'message', message },
    ]);
    // Pembukaan pertama pun meminta resync; belum ada seq yang dikenal.
    expect(l.resyncs()).toBe(1);
    expect(l.lastRevs).toEqual([undefined]);
  });

  test('http menjadi ws', async () => {
    const session = createMemorySession('tok');
    const urls: string[] = [];
    const transport = new HttpTransport('http://192.168.1.5:3000', session, {
      socket: (url) => {
        urls.push(url);
        return new FakeSocket(url);
      },
    });
    created.push(transport);
    transport.subscribe(
      () => {},
      () => {},
    );
    await flush();
    expect(urls).toEqual(['ws://192.168.1.5:3000/app/v1/stream']);
  });

  test('satu koneksi untuk semua pendengar, ditutup saat pendengar terakhir pergi', async () => {
    const { sockets, transport } = setup();
    const a = listen(transport);
    const b = listen(transport);
    await flush();
    sockets[0]!.open();
    expect(sockets).toHaveLength(1);
    expect(b.statuses).toEqual(['connecting', 'open']);
    sockets[0]!.send({ type: 'thinking', runId: 'r1', on: false });
    expect(a.events).toHaveLength(1);
    expect(b.events).toHaveLength(1);

    a.stop();
    expect(sockets[0]!.closedWith).toBeNull();
    b.stop();
    expect(sockets[0]!.closedWith).toBe(1000);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(1);
  });

  test('sambung ulang dengan jeda bertingkat, lalu mengambil pesan yang terlewat sejak rev terakhir', async () => {
    const { fetch, sockets, transport } = setup({
      reply: (url) => ({ body: url.endsWith('/me') ? me : { items: [message], more: false } }),
    });
    const pages: unknown[] = [];
    const l = listen(transport, (lastRev) => {
      if (lastRev !== undefined) void transport.messagesChanged(lastRev).then((p) => pages.push(p));
    });
    await flush();
    sockets[0]!.open();
    sockets[0]!.send({ type: 'message', message: { ...message, id: 'm7', seq: 7, rev: 11 } });
    expect(l.resyncs()).toBe(1);

    sockets[0]!.drop();
    expect(l.last()).toBe('connecting');
    // Jeda 1, 2, 4, 8, 16, 30, 30 detik; setiap percobaan gagal sebelum terbuka.
    for (const [i, delay] of [1000, 2000, 4000, 8000, 16000, 30000, 30000].entries()) {
      await jest.advanceTimersByTimeAsync(delay - 1);
      expect(sockets).toHaveLength(i + 1);
      await jest.advanceTimersByTimeAsync(1);
      expect(sockets).toHaveLength(i + 2);
      if (i < 6) sockets[i + 1]!.drop();
    }
    expect(l.statuses.filter((s) => s === 'open')).toHaveLength(1);
    // Gagal terbuka tiga kali: satu pemeriksaan GET /me (server menjawab sehat, jadi tidak diulang).
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(call(fetch, 0).url).toBe(`${BASE}/app/v1/me`);

    sockets[7]!.open();
    expect(l.last()).toBe('open');
    expect(l.resyncs()).toBe(2);
    expect(l.lastRevs).toEqual([undefined, 11]);
    await flush();
    expect(call(fetch, 1).url).toBe(`${BASE}/app/v1/messages?limit=100&changedAfter=11`);
    expect(pages).toEqual([{ items: [message], more: false }]);

    // Setelah tersambung, jedanya kembali ke 1 detik.
    sockets[7]!.drop();
    await jest.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(9);
  });

  test('upsert saat koneksi putus (QRIS lunas) sampai lewat resync berdasarkan rev', async () => {
    const qris = (status: string, rev: number) => ({
      ...message,
      id: 'q1',
      seq: 3,
      rev,
      parts: [
        {
          type: 'card',
          card: { kind: 'qris', amountRp: 1000, until: '2026-10-20T10:15:00Z', status, mediaId: 'q' },
        },
      ],
    });
    const { fetch, sockets, transport } = setup({
      reply: (url) =>
        url.includes('changedAfter=5')
          ? { body: { items: [qris('lunas', 9)], more: false } }
          : { body: { items: [], more: false } },
    });
    const merged = new Map<string, Message>();
    const l = listen(transport, (lastRev) => {
      if (lastRev === undefined) return;
      void transport.messagesChanged(lastRev).then((p) => p.items.forEach((m) => merged.set(m.id, m)));
    });
    await flush();
    sockets[0]!.open();
    sockets[0]!.send({ type: 'message', message: qris('menunggu', 5) });
    sockets[0]!.drop();
    // Saat putus QRIS dibayar: seq tetap 3, rev naik ke 9; tidak ada event yang sampai.
    await jest.advanceTimersByTimeAsync(1000);
    sockets[1]!.open();
    await flush();
    expect(l.lastRevs).toEqual([undefined, 5]);
    expect(call(fetch).url).toBe(`${BASE}/app/v1/messages?limit=100&changedAfter=5`);
    expect(merged.get('q1')).toMatchObject({ seq: 3, rev: 9 });
    expect(JSON.stringify(merged.get('q1'))).toContain('lunas');
  });

  test('rev yang dikenal berasal dari halaman terbaru, bukan dari halaman lama atau kiriman sendiri', async () => {
    const page = (ids: number[]) => ({
      items: ids.map((n) => ({ ...message, id: `m${n}`, seq: n, rev: n })),
      before: null,
    });
    const replies = [page([9, 8]), page([3, 2]), { message: { ...message, id: 'm20', seq: 20, rev: 20 } }];
    const { sockets, transport } = setup({ reply: () => ({ body: replies.shift() }) });
    await transport.messages();
    await transport.messages(8);
    await transport.send({ kind: 'text', clientId: 'c1', text: 'Halo' });
    const l = listen(transport);
    await flush();
    sockets[0]!.open();
    expect(l.lastRevs).toEqual([9]);
  });

  test('koneksi yang macet saat menyambung dibuang dan dicoba lagi dengan jeda bertingkat', async () => {
    const { sockets, transport } = setup();
    const l = listen(transport);
    await flush();
    expect(sockets).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS - 1);
    expect(sockets[0]!.closedWith).toBeNull();
    await jest.advanceTimersByTimeAsync(1);
    expect(sockets[0]!.closedWith).not.toBeNull();
    expect(l.last()).toBe('connecting');
    await jest.advanceTimersByTimeAsync(999);
    expect(sockets).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(2);
    // Yang kedua macet juga: jedanya naik.
    await jest.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS + 1999);
    expect(sockets).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(3);
    sockets[2]!.open();
    expect(l.last()).toBe('open');
    // Terbuka: batas waktu menyambung tidak berlaku lagi (hanya diam 60 detik yang memutus).
    await jest.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS * 2);
    expect(sockets[2]!.closedWith).toBeNull();
  });

  test('satu pendengar yang error tidak menghentikan yang lain', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { sockets, transport } = setup();
    const seen: string[] = [];
    transport.subscribe(
      () => {
        throw new Error('rusak');
      },
      () => {
        throw new Error('rusak juga');
      },
      () => {
        throw new Error('resync rusak');
      },
    );
    const good = listen(transport);
    await flush();
    sockets[0]!.open();
    sockets[0]!.send({ type: 'message', message });
    seen.push(...good.statuses, String(good.events.length), String(good.resyncs()));
    expect(seen).toEqual(['connecting', 'open', '1', '1']);
    expect(error).toHaveBeenCalled();
    transport.dispose();
    error.mockRestore();
  });

  test('server diam terlalu lama: koneksi dianggap mati dan disambung ulang', async () => {
    const { sockets, transport } = setup();
    const l = listen(transport);
    await flush();
    sockets[0]!.open();
    await jest.advanceTimersByTimeAsync(STREAM_SILENCE_MS - 1000);
    sockets[0]!.send({ type: 'ping' });
    await jest.advanceTimersByTimeAsync(STREAM_SILENCE_MS - 1);
    expect(sockets[0]!.closedWith).toBeNull();
    await jest.advanceTimersByTimeAsync(1);
    expect(sockets[0]!.closedWith).not.toBeNull();
    expect(l.last()).toBe('connecting');
    await jest.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);
    sockets[1]!.open();
    expect(l.resyncs()).toBe(2);
  });

  test('token ditolak (4401): sesi dihapus dan tidak menyambung ulang', async () => {
    const { session, sockets, transport } = setup();
    const l = listen(transport);
    await flush();
    sockets[0]!.drop(4401);
    await flush();
    expect(await session.get()).toBeNull();
    expect(l.last()).toBe('closed');
    await jest.advanceTimersByTimeAsync(120_000);
    expect(sockets).toHaveLength(1);
  });

  test('tanpa sesi tidak menyambung; setelah masuk langsung menyambung', async () => {
    const { sockets, transport } = setup({ token: null, reply: () => ({ body: { token: 'baru', user: me } }) });
    const l = listen(transport);
    await flush();
    expect(sockets).toHaveLength(0);
    expect(l.last()).toBe('closed');

    await transport.authVerify({ phone: '6281220457781', code: '123456' });
    await flush();
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.url).not.toContain('baru');
    expect(sockets[0]!.headers.Authorization).toBe('Bearer baru');
  });

  test('401 dari HTTP dan keluar menutup koneksi', async () => {
    const run = async (end: (t: HttpTransport, s: Session) => Promise<unknown>) => {
      const { session, sockets, transport } = setup({ reply: () => ({ status: 401, body: { error: 'tidak_masuk' } }) });
      const l = listen(transport);
      await flush();
      sockets[0]!.open();
      await end(transport, session).catch(() => {});
      expect(sockets[0]!.closedWith).toBe(1000);
      expect(l.last()).toBe('closed');
      await jest.advanceTimersByTimeAsync(120_000);
      expect(sockets).toHaveLength(1);
    };
    await run((t) => t.me());
    await run((t) => t.logout());
  });

  test('dispose menutup koneksi tanpa menyambung ulang', async () => {
    const { sockets, transport } = setup();
    const l = listen(transport);
    await flush();
    sockets[0]!.open();
    transport.dispose();
    expect(sockets[0]!.closedWith).toBe(1000);
    expect(l.last()).toBe('closed');
    await jest.advanceTimersByTimeAsync(120_000);
    expect(sockets).toHaveLength(1);
  });
});

describe('penolakan jabat tangan', () => {
  /** Soket ke-`count` gagal terbuka berturut-turut (RN melaporkan 403/426/429 sebagai tutup 1006). */
  async function failOpens(sockets: FakeSocket[], count: number) {
    for (let i = 0; i < count; i++) {
      for (let step = 0; sockets.length <= i && step < 40; step++) await jest.advanceTimersByTimeAsync(1000);
      expect(sockets.length).toBeGreaterThan(i);
      sockets[i]!.drop();
      await flush();
    }
  }
  const quiet = async (sockets: FakeSocket[]) => {
    const n = sockets.length;
    await jest.advanceTimersByTimeAsync(300_000);
    expect(sockets).toHaveLength(n);
  };

  test.each<[string, number, string, ConnectionStatus]>([
    ['diblokir', 403, 'diblokir', 'blocked'],
    ['perlu pembaruan', 426, 'perlu_pembaruan', 'upgrade_required'],
  ])(
    'tiga kali gagal terbuka lalu GET /me %s: berhenti menyambung dan status tampil',
    async (_, status, error, expected) => {
      const { fetch, session, sockets, transport } = setup({ reply: () => ({ status, body: { error } }) });
      const l = listen(transport);
      await flush();
      await failOpens(sockets, 2);
      expect(fetch).not.toHaveBeenCalled();
      await failOpens(sockets, 3);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(call(fetch).url).toBe(`${BASE}/app/v1/me`);
      expect(l.last()).toBe(expected);
      expect(await session.get()).toBe('tok');
      await quiet(sockets);
      expect(sockets).toHaveLength(3);
    },
  );

  test('GET /me 401: sesi dihapus dan tidak menyambung ulang', async () => {
    const { session, sockets, transport } = setup({ reply: () => ({ status: 401, body: { error: 'tidak_masuk' } }) });
    const l = listen(transport);
    await flush();
    await failOpens(sockets, 3);
    expect(await session.get()).toBeNull();
    expect(l.last()).toBe('closed');
    await quiet(sockets);
    expect(sockets).toHaveLength(3);
  });

  test('GET /me sehat: jeda bertingkat dilanjutkan dan tidak ditanya lagi', async () => {
    const { fetch, sockets, transport } = setup({ reply: () => ({ body: me }) });
    const l = listen(transport);
    await flush();
    await failOpens(sockets, 3);
    expect(l.last()).toBe('connecting');
    await failOpens(sockets, 5);
    expect(sockets.length).toBeGreaterThanOrEqual(5);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('GET /me tanpa sinyal: jeda dilanjutkan dan ditanya lagi pada kegagalan berikutnya', async () => {
    const { fetch, sockets, transport } = setup({ reply: () => Promise.reject(new Error('putus')) });
    const l = listen(transport);
    await flush();
    await failOpens(sockets, 4);
    expect(l.last()).toBe('connecting');
    expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test('koneksi yang sempat terbuka tidak dihitung gagal terbuka', async () => {
    const { fetch, sockets, transport } = setup();
    listen(transport);
    await flush();
    for (let i = 0; i < 5; i++) {
      for (let step = 0; sockets.length <= i && step < 40; step++) await jest.advanceTimersByTimeAsync(1000);
      sockets[i]!.open();
      sockets[i]!.drop();
      await flush();
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('kegagalan khusus', () => {
  test('429 membawa retryInSec dan teks ramah', async () => {
    const { transport } = setup({
      token: null,
      reply: () => ({ status: 429, body: { error: 'terlalu_sering', retryInSec: 42 } }),
    });
    const e = await transport.authStart({ phone: '6281220457781' }).catch((x: unknown) => x);
    expect(e).toMatchObject({ code: 'rate_limited', status: 429, error: 'terlalu_sering', retryInSec: 42 });
    expect(friendlyError(e)).toBe('Tunggu sebentar ya, coba lagi dalam 42 detik.');
  });

  test('429 tanpa retryInSec yang sah tetap rate_limited', async () => {
    const { transport } = setup({ reply: () => ({ status: 429, body: { error: 'terlalu_sering', retryInSec: 'x' } }) });
    const e = await transport.me().catch((x: unknown) => x);
    expect(e).toMatchObject({ code: 'rate_limited', retryInSec: undefined });
    expect(friendlyError(e)).toBe('Tunggu sebentar ya, lalu coba lagi.');
  });

  test('403 diblokir tidak menghapus sesi', async () => {
    const { session, transport } = setup({ reply: () => ({ status: 403, body: { error: 'diblokir' } }) });
    const e = await transport.me().catch((x: unknown) => x);
    expect(e).toMatchObject({ code: 'blocked', status: 403, error: 'diblokir' });
    expect(friendlyError(e)).toBe(BLOCKED_TEXT);
    expect(BLOCKED_TEXT).toBe('Akun ini sedang tidak aktif. Hubungi tim Sekretaris AI lewat WhatsApp.');
    expect(await session.get()).toBe('tok');
  });

  test('404 belum terdaftar dari auth/start: nomor WhatsApp dari isi jawaban, tanpa menyimpan sesi', async () => {
    const { session, transport } = setup({
      token: null,
      reply: () => ({ status: 404, body: { error: 'belum_terdaftar', waNumber: '6281100002222' } }),
    });
    const e = await transport.authStart({ phone: '6281200000000' }).catch((x: unknown) => x);
    expect(e).toMatchObject({
      code: 'not_registered',
      status: 404,
      error: 'belum_terdaftar',
      waNumber: '6281100002222',
    });
    expect(friendlyError(e)).toBe(NOT_REGISTERED_TEXT);
    expect(await session.get()).toBeNull();
  });

  test('404 belum terdaftar tanpa nomor, atau dengan nomor rusak: waNumber kosong; 404 lain tetap kendala server', async () => {
    for (const body of [{ error: 'belum_terdaftar' }, { error: 'belum_terdaftar', waNumber: 'abc' }]) {
      const { transport } = setup({ token: null, reply: () => ({ status: 404, body }) });
      const e = await transport.authStart({ phone: '6281200000000' }).catch((x: unknown) => x);
      expect(e).toMatchObject({ code: 'not_registered', waNumber: undefined });
    }
    const other = setup({ reply: () => ({ status: 404, body: { error: 'tidak_ditemukan' } }) });
    await expect(other.transport.me()).rejects.toMatchObject({ code: 'server', status: 404 });
  });

  test('keamanan: GET/PUT /account/security dan POST /account/pin dengan token', async () => {
    const res = { pinEnabled: true, hasPin: true };
    const { fetch, transport } = setup({ reply: () => ({ body: res }) });
    expect(await transport.security()).toEqual(res);
    expect(call(fetch, 0)).toMatchObject({ url: `${BASE}/app/v1/account/security`, method: 'GET' });
    expect(await transport.setSecurity({ pinEnabled: true })).toEqual(res);
    expect(call(fetch, 1)).toMatchObject({
      url: `${BASE}/app/v1/account/security`,
      method: 'PUT',
      body: JSON.stringify({ pinEnabled: true }),
    });
    expect(call(fetch, 1).headers.Authorization).toBe('Bearer tok');
    await transport.setPin({ pin: '654321', currentPin: '123456' });
    expect(call(fetch, 2)).toMatchObject({
      url: `${BASE}/app/v1/account/pin`,
      method: 'POST',
      body: JSON.stringify({ pin: '654321', currentPin: '123456' }),
    });
    await expect(setup({ reply: () => ({ body: { pinEnabled: 'ya' } }) }).transport.security()).rejects.toMatchObject({
      code: 'server',
    });
  });

  test('verifikasi PIN: ok = benar, 403 pin_salah = salah (sesi tetap, bukan diblokir), kendala lain dilempar', async () => {
    const good = setup({ reply: () => ({ body: { ok: true } }) });
    expect(await good.transport.verifyPin('123456')).toBe(true);
    expect(call(good.fetch)).toMatchObject({
      url: `${BASE}/app/v1/account/pin/verify`,
      method: 'POST',
      body: JSON.stringify({ pin: '123456' }),
    });
    const wrong = setup({ reply: () => ({ status: 403, body: { error: 'pin_salah' } }) });
    expect(await wrong.transport.verifyPin('111111')).toBe(false);
    expect(await wrong.session.get()).toBe('tok');
    const change = await wrong.transport.setPin({ pin: '654321', currentPin: '111111' }).catch((x: unknown) => x);
    expect(change).toMatchObject({ code: 'pin_wrong', status: 403, error: 'pin_salah' });
    expect(friendlyError(change)).toBe(WRONG_PIN_TEXT);
    const blocked = setup({ reply: () => ({ status: 403, body: { error: 'diblokir' } }) });
    await expect(blocked.transport.verifyPin('123456')).rejects.toMatchObject({ code: 'blocked' });
    const down = setup({ reply: () => ({ status: 500, body: { error: 'server' } }) });
    await expect(down.transport.verifyPin('123456')).rejects.toMatchObject({ code: 'server' });
  });

  test('426 perlu pembaruan', async () => {
    const { transport } = setup({ reply: () => ({ status: 426, body: { error: 'perlu_pembaruan' } }) });
    const e = await transport.me().catch((x: unknown) => x);
    expect(e).toMatchObject({ code: 'upgrade_required', status: 426 });
    expect(friendlyError(e)).toBe(UPGRADE_TEXT);
    expect(UPGRADE_TEXT).toBe('Ada versi aplikasi yang lebih baru. Perbarui dulu ya.');
  });

  test('501 belum tersedia (kendali perangkat Fase 3)', async () => {
    const { transport } = setup({ reply: () => ({ status: 501, body: { error: 'belum_tersedia' } }) });
    const e = await transport.controlDevice('ac1', { on: true }).catch((x: unknown) => x);
    expect(e).toMatchObject({ code: 'unavailable', status: 501, error: 'belum_tersedia' });
    expect(friendlyError(e)).toBe(UNAVAILABLE_TEXT);
    expect(UNAVAILABLE_TEXT).toBe('Kendali perangkat dari chat segera hadir.');
  });
});

describe('401 yang usang', () => {
  test('401 untuk token lama tidak menghapus sesi yang baru', async () => {
    let release: (r: Reply) => void = () => {};
    const { session, transport } = setup({ reply: () => new Promise<Reply>((resolve) => (release = resolve)) });
    let failure: unknown;
    void transport.me().catch((x: unknown) => (failure = x));
    await flush();
    // Selagi request berjalan, pengguna keluar lalu masuk lagi dengan token baru.
    await session.set('baru');
    release({ status: 401, body: { error: 'tidak_masuk' } });
    await flush();
    expect(failure).toMatchObject({ code: 'unauthorized' });
    expect(await session.get()).toBe('baru');
  });

  test('4401 untuk token lama: sesi baru tetap dan koneksi disambung ulang dengan token baru', async () => {
    const { session, sockets, transport } = setup();
    const l = listen(transport);
    await flush();
    await session.set('baru');
    sockets[0]!.drop(4401);
    await flush();
    expect(await session.get()).toBe('baru');
    expect(l.last()).toBe('connecting');
    await jest.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);
    expect(sockets[1]!.headers.Authorization).toBe('Bearer baru');
  });
});

describe('pembacaan longgar', () => {
  const future = { type: 'hologram', mediaId: 'x' };
  const goodPart = { type: 'text', text: 'Halo' };

  test('halaman riwayat: bagian, kartu, dan enum yang tidak dikenal menjadi unknown; amplop rusak dibuang', async () => {
    const items = [
      { ...message, id: 'a', seq: 5, parts: [goodPart, future] },
      { ...message, id: 'b', seq: 4, parts: [{ type: 'card', card: { kind: 'cuaca' } }] },
      {
        ...message,
        id: 'c',
        seq: 3,
        parts: [{ type: 'card', card: { kind: 'qris', amountRp: 1000, until: '10.15', status: 'baru', mediaId: 'q' } }],
      },
      { ...message, id: 'd', seq: 2, from: 'robot', parts: [goodPart] },
      { ...message, id: 'e', seq: 1, parts: [] },
      { ...message, id: undefined, seq: 9 },
      { ...message, id: 'g', seq: undefined },
      'bukan pesan',
      { ...message, id: 'h', seq: 6 },
    ];
    const { transport } = setup({ reply: () => ({ body: { items, before: 3 } }) });
    const page = await transport.messages();
    const unknown = { type: 'unknown', note: 'Pesan ini butuh aplikasi versi terbaru.' };
    expect(page.before).toBe(3);
    expect(page.items.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'h']);
    expect(page.items[0]!.parts).toEqual([goodPart, unknown]);
    expect(page.items[1]!.parts).toEqual([unknown]);
    expect(page.items[2]!.parts).toEqual([unknown]);
    expect(page.items[3]).toMatchObject({ from: 'assistant', parts: [unknown] });
    expect(page.items[4]!.parts).toEqual([unknown]);
    expect(page.items[5]).toEqual({ ...message, id: 'h', seq: 6 });
  });

  test('rev yang hilang diganti seq (server lama), bukan menghilangkan pesan', async () => {
    const { rev: _rev, ...old } = message;
    const { transport } = setup({ reply: () => ({ body: { items: [{ ...old, seq: 4 }], before: null } }) });
    const page = await transport.messages();
    expect(page.items[0]).toMatchObject({ id: 'm1', seq: 4, rev: 4 });
  });

  test('bentuk halaman yang salah tetap kendala server', async () => {
    const { transport } = setup({ reply: () => ({ body: { items: 'x', before: null } }) });
    await expect(transport.messages()).rejects.toMatchObject({ code: 'server' });
    const noCursor = setup({ reply: () => ({ body: { items: [message] } }) });
    await expect(noCursor.transport.messages()).rejects.toMatchObject({ code: 'server' });
  });

  test('halaman resync dan jawaban kirim juga longgar', async () => {
    const odd = { ...message, id: 'z', seq: 2, parts: [future] };
    const since = setup({ reply: () => ({ body: { items: [message, odd], more: true } }) });
    const page = await since.transport.messagesChanged(0);
    expect(page.more).toBe(true);
    expect(page.items[1]!.parts[0]).toMatchObject({ type: 'unknown' });

    const sent = setup({ reply: () => ({ body: { message: odd } }) });
    expect((await sent.transport.send({ kind: 'text', clientId: 'c1', text: 'Halo' })).parts[0]).toMatchObject({
      type: 'unknown',
    });
  });

  test('event draft tanpa rev (server lama) tetap berlaku dengan rev 0; draf rusak dilewati', async () => {
    const { sockets, transport } = setup();
    const l = listen(transport);
    await flush();
    sockets[0]!.open();
    sockets[0]!.send({ type: 'draft', draft: { ...draft, status: 'sent' } });
    sockets[0]!.send({ type: 'draft', draft: { ...draft, status: 'sent' }, rev: 'x' });
    sockets[0]!.send({ type: 'draft', draft: { ...draft, status: 'sent' }, rev: 12 });
    expect(l.events.map((e) => (e.type === 'draft' ? e.rev : null))).toEqual([0, 0, 12]);
  });

  test('jawaban aksi draf tanpa rev dibaca rev 0; draf rusak tetap kendala server', async () => {
    const old = setup({ reply: () => ({ body: { draft } }) });
    expect(await old.transport.draftAction('d1', { action: 'send' })).toEqual({ draft, rev: 0 });
    const broken = setup({ reply: () => ({ body: { draft: { ...draft, status: 'aneh' }, rev: 3 } }) });
    await expect(broken.transport.draftAction('d1', { action: 'send' })).rejects.toMatchObject({ code: 'server' });
  });

  test('pesan di stream yang gagal skema ketat diubah dengan cara yang sama; yang rusak amplopnya dilewati', async () => {
    const { sockets, transport } = setup();
    const l = listen(transport);
    await flush();
    sockets[0]!.open();
    sockets[0]!.send({ type: 'message', message: { ...message, id: 'f1', seq: 3, parts: [future] } });
    sockets[0]!.send({ type: 'message', message: { ...message, id: 'f2', seq: undefined } });
    sockets[0]!.send({ type: 'message', message: { ...message, seq: 4, id: '' } });
    sockets[0]!.send({ type: 'draft', draft: { ...draft, status: 'aneh' } });
    expect(l.events).toHaveLength(1);
    expect(l.events[0]).toMatchObject({
      type: 'message',
      message: { id: 'f1', seq: 3, parts: [{ type: 'unknown' }] },
    });
  });
});

describe('Beranda', () => {
  const homeBody = {
    place: 'Semua',
    greetingName: 'Rina',
    summary: 'Ada 3 hal yang perlu Anda hari ini.',
    approvals: [],
    agendaToday: [{ id: 'a1', time: '09.00', title: 'Rapat', kind: 'meeting' }],
    house: { lines: [{ deviceId: 'ac/1', icon: 'snow', text: 'AC kamar nyala · 24°', on: true, switchable: true }] },
    business: { source: 'dari Moka', sales: 'Rp4.250.000', change: 'naik 12%', down: false, alert: null },
    ring: { nodes: [{ key: 'wa', icon: 'chat', label: 'WhatsApp', reachable: true }] },
    rev: 4,
  };

  test('GET /home dan PUT /places/current memakai token dan isi yang tepat', async () => {
    const { fetch, transport } = setup({ reply: () => ({ body: homeBody }) });
    expect(await transport.home()).toEqual(homeBody);
    expect(call(fetch, 0)).toMatchObject({ url: `${BASE}/app/v1/home`, method: 'GET' });
    expect(call(fetch, 0).headers.Authorization).toBe('Bearer tok');
    expect(await transport.setPlace('Kedai Dago')).toEqual(homeBody);
    expect(call(fetch, 1)).toMatchObject({
      url: `${BASE}/app/v1/places/current`,
      method: 'PUT',
      body: '{"place":"Kedai Dago"}',
    });
  });

  test('isi yang lebih baru dari aplikasi tetap terbaca: ikon baru, bidang tambahan, baris rusak', async () => {
    const odd = {
      ...homeBody,
      extra: true,
      house: { lines: [{ deviceId: 'x', icon: 'ikon-baru', text: 'Sesuatu', switchable: false }, { text: 'rusak' }] },
    };
    const { transport } = setup({ reply: () => ({ body: odd }) });
    const home = await transport.home();
    expect(home.house.lines).toEqual([{ deviceId: 'x', icon: 'ikon-baru', text: 'Sesuatu', switchable: false }]);
  });

  test('jawaban tanpa tempat atau rev menjadi kendala server; 401 menghapus sesi', async () => {
    const { transport } = setup({ reply: () => ({ body: { ...homeBody, rev: undefined } }) });
    await expect(transport.home()).rejects.toMatchObject({ code: 'server' });
    const out = setup({ reply: () => ({ status: 401, body: { error: 'tidak_masuk' } }) });
    await expect(out.transport.home()).rejects.toMatchObject({ code: 'unauthorized' });
    expect(await out.session.get()).toBeNull();
  });

  test('event home lewat stream diteruskan', async () => {
    const { sockets, transport } = setup();
    const l = listen(transport);
    await flush();
    sockets[0]!.open();
    sockets[0]!.send({ type: 'home', home: homeBody });
    sockets[0]!.send({ type: 'home', home: 5 });
    expect(l.events).toEqual([{ type: 'home', home: homeBody }]);
  });
});

describe('Agenda', () => {
  const item = {
    id: 'a1',
    date: '2026-10-21',
    time: '07.00',
    at: '2026-10-21T00:00:00.000Z',
    title: 'Berangkat ke bandara',
    kind: 'reminder',
    way: 'alarm',
  };
  const res = {
    items: [item],
    leftover: null,
    from: '2026-10-19',
    to: '2026-11-01',
    today: '2026-10-21',
    now: '06.30',
    rev: 7,
  };

  test('GET /agenda dengan dan tanpa rentang', async () => {
    const { fetch, transport } = setup({ reply: () => ({ body: res }) });
    expect(await transport.agenda()).toEqual(res);
    expect(call(fetch, 0)).toMatchObject({ url: `${BASE}/app/v1/agenda`, method: 'GET' });
    await transport.agenda({ from: '2026-10-01', to: '2026-10-31' });
    expect(call(fetch, 1).url).toBe(`${BASE}/app/v1/agenda?from=2026-10-01&to=2026-10-31`);
  });

  test('item yang rusak dibuang satu per satu, bukan menggagalkan agenda', async () => {
    const { transport } = setup({
      reply: () => ({ body: { ...res, items: [item, { id: 'x' }, { ...item, id: 'a2', kind: 'baru' }] } }),
    });
    expect((await transport.agenda()).items.map((i) => i.id)).toEqual(['a1']);
    const bad = setup({ reply: () => ({ body: { ...res, items: 5 } }) });
    await expect(bad.transport.agenda()).rejects.toMatchObject({ code: 'server' });
  });

  test('jalur parse, tambah, ubah, sisa kemarin, tanda terima, dan satu item', async () => {
    const preview = { preview: { item: { ...item, id: undefined }, guessedTime: true } };
    const { fetch, transport } = setup({
      reply: (url, init) => {
        if (url.endsWith('/agenda/parse')) return { body: preview };
        if (url.endsWith('/agenda/leftover')) return { body: { item: null } };
        if (url.endsWith('/alarm-ack')) return { body: { ok: true } };
        return { body: { item } };
      },
    });
    const { id: _id, ...fresh } = item;
    expect((await transport.agendaParse('ingatkan saya')).preview.guessedTime).toBe(true);
    expect(call(fetch, 0)).toMatchObject({
      url: `${BASE}/app/v1/agenda/parse`,
      method: 'POST',
      body: '{"text":"ingatkan saya"}',
    });
    expect(await transport.agendaAdd(fresh as never)).toEqual(item);
    expect(call(fetch, 1)).toMatchObject({ url: `${BASE}/app/v1/agenda`, method: 'POST' });
    expect(JSON.parse(call(fetch, 1).body as string)).toEqual({ item: fresh });
    expect(await transport.agendaPatch('a/1', { done: true })).toEqual(item);
    expect(call(fetch, 2)).toMatchObject({
      url: `${BASE}/app/v1/agenda/a%2F1`,
      method: 'PATCH',
      body: '{"done":true}',
    });
    expect(await transport.agendaLeftover('drop')).toBeNull();
    expect(call(fetch, 3)).toMatchObject({ url: `${BASE}/app/v1/agenda/leftover`, body: '{"choice":"drop"}' });
    await transport.agendaAlarmAck('a1', '2026-10-21T00:00:00.000Z');
    expect(call(fetch, 4)).toMatchObject({
      url: `${BASE}/app/v1/agenda/a1/alarm-ack`,
      method: 'POST',
      body: '{"scheduledFor":"2026-10-21T00:00:00.000Z"}',
    });
    expect(await transport.agendaItem('a1')).toEqual(item);
    expect(call(fetch, 5)).toMatchObject({ url: `${BASE}/app/v1/agenda/a1`, method: 'GET' });
  });

  test('event agenda lewat stream diteruskan; item rusak dibuang, event tanpa rev dilewati', async () => {
    const { sockets, transport } = setup();
    const l = listen(transport);
    await flush();
    sockets[0]!.open();
    sockets[0]!.send({ type: 'agenda', items: [item, { id: 'rusak' }], removed: ['a9', 5], leftover: null, rev: 8 });
    sockets[0]!.send({ type: 'agenda', items: [item] });
    expect(l.events).toEqual([{ type: 'agenda', items: [item], removed: ['a9'], leftover: null, rev: 8 }]);
  });
});
