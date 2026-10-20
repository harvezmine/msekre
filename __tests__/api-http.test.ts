import type { Message, StreamEvent } from '@/api/contract';
import { ERROR_TEXT, friendlyError, WRONG_CODE_TEXT } from '@/api/errors';
import { HttpTransport, REQUEST_TIMEOUT_MS, STREAM_SILENCE_MS, type SocketLike } from '@/api/http';
import { createMemorySession, type Session } from '@/api/session';
import { ApiFailure, type ConnectionStatus } from '@/api/transport';

const BASE = 'https://app.sekertaris.com';
const me = { id: 'u1', name: 'Rina', assistantName: 'Nadia', plan: { name: 'Bisnis', activeUntil: null } };
const message: Message = {
  id: 'm1',
  clientId: 'c1',
  at: '2026-10-20T03:42:00.000Z',
  from: 'user',
  via: 'app',
  parts: [{ type: 'text', text: 'Halo' }],
};
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
  constructor(readonly url: string) {}
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

function setup({
  token = 'tok' as string | null,
  reply,
}: { token?: string | null; reply?: Parameters<typeof fakeFetch>[0] } = {}) {
  const session = createMemorySession(token);
  const fetch = fakeFetch(reply);
  const sockets: FakeSocket[] = [];
  const transport = new HttpTransport(`${BASE}/`, session, {
    fetch: fetch as unknown as typeof globalThis.fetch,
    socket: (url) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
    random: () => 0.5,
  });
  return { session, fetch, sockets, transport };
}

const call = (fetch: ReturnType<typeof fakeFetch>, i = 0) => {
  const [url, init] = fetch.mock.calls[i]!;
  return { url, method: init.method, headers: init.headers as Record<string, string>, body: init.body };
};

/** Pendengar stream yang mencatat event, status, dan permintaan resync. */
function listen(transport: HttpTransport, onResync?: () => void) {
  const events: StreamEvent[] = [];
  const statuses: ConnectionStatus[] = [];
  let resyncs = 0;
  const stop = transport.subscribe(
    (e) => events.push(e),
    (s) => statuses.push(s),
    () => {
      resyncs += 1;
      onResync?.();
    },
  );
  return { events, statuses, stop, resyncs: () => resyncs, last: () => statuses[statuses.length - 1] };
}

const flush = () => jest.advanceTimersByTimeAsync(0);

describe('HTTP', () => {
  test('URL, metode, header, dan isi sesuai kontrak', async () => {
    const { fetch, transport } = setup({
      reply: (url) => {
        if (url.endsWith('/auth/start')) return { body: { resendInSec: 60 } };
        if (url.endsWith('/me')) return { body: me };
        if (url.includes('/messages?')) return { body: { items: [message], before: null } };
        if (url.endsWith('/messages')) return { body: { message } };
        if (url.includes('/drafts/')) return { body: { draft } };
        return { body: { ok: true } };
      },
    });

    expect(await transport.authStart({ phone: '6281220457781' })).toEqual({ resendInSec: 60 });
    expect(call(fetch, 0)).toEqual({
      url: `${BASE}/app/v1/auth/start`,
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '6281220457781' }),
    });

    expect(await transport.me()).toEqual(me);
    expect(call(fetch, 1)).toEqual({
      url: `${BASE}/app/v1/me`,
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer tok' },
      body: undefined,
    });

    await transport.messages();
    await transport.messages('m 1/2');
    expect(call(fetch, 2).url).toBe(`${BASE}/app/v1/messages?limit=30`);
    expect(call(fetch, 3).url).toBe(`${BASE}/app/v1/messages?limit=30&before=m%201%2F2`);

    expect(await transport.send({ clientId: 'c1', text: 'Halo' })).toEqual(message);
    expect(call(fetch, 4)).toMatchObject({
      url: `${BASE}/app/v1/messages`,
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'c1', text: 'Halo' }),
    });

    expect(await transport.draftAction('d/1', { action: 'send' })).toEqual(draft);
    expect(call(fetch, 5)).toMatchObject({ url: `${BASE}/app/v1/drafts/d%2F1`, body: '{"action":"send"}' });

    await transport.registerDevice({ pushToken: 'p1', platform: 'android' });
    expect(call(fetch, 6)).toMatchObject({ url: `${BASE}/app/v1/devices`, method: 'POST' });

    expect(await transport.mediaUrl('q 1')).toEqual({
      kind: 'uri',
      uri: `${BASE}/app/v1/media/q%201`,
      headers: { Authorization: 'Bearer tok' },
    });
    expect(fetch).toHaveBeenCalledTimes(7);
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
    await ok.transport.logout();
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
  });
});

describe('WebSocket', () => {
  test('tersambung dengan token, event diteruskan, ping dan event rusak dilewati', async () => {
    const { sockets, transport } = setup();
    const l = listen(transport);
    await flush();
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.url).toBe('wss://app.sekertaris.com/app/v1/stream?token=tok');
    expect(l.statuses).toEqual(['closed', 'connecting']);

    sockets[0]!.open();
    expect(l.last()).toBe('open');
    sockets[0]!.send({ type: 'ping' });
    sockets[0]!.send({ type: 'thinking', on: true });
    sockets[0]!.send('bukan json');
    sockets[0]!.send({ type: 'mengetik' });
    sockets[0]!.send({ type: 'message', message: { ...message, parts: [] } });
    sockets[0]!.send({ type: 'message', message });
    expect(l.events).toEqual([
      { type: 'thinking', on: true },
      { type: 'message', message },
    ]);
    expect(l.resyncs()).toBe(0);
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
    transport.subscribe(
      () => {},
      () => {},
    );
    await flush();
    expect(urls).toEqual(['ws://192.168.1.5:3000/app/v1/stream?token=tok']);
  });

  test('satu koneksi untuk semua pendengar, ditutup saat pendengar terakhir pergi', async () => {
    const { sockets, transport } = setup();
    const a = listen(transport);
    const b = listen(transport);
    await flush();
    sockets[0]!.open();
    expect(sockets).toHaveLength(1);
    expect(b.statuses).toEqual(['connecting', 'open']);
    sockets[0]!.send({ type: 'thinking', on: false });
    expect(a.events).toHaveLength(1);
    expect(b.events).toHaveLength(1);

    a.stop();
    expect(sockets[0]!.closedWith).toBeNull();
    b.stop();
    expect(sockets[0]!.closedWith).toBe(1000);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(1);
  });

  test('sambung ulang dengan jeda bertingkat, lalu mengambil pesan yang terlewat', async () => {
    const { fetch, sockets, transport } = setup({ reply: () => ({ body: { items: [message], before: null } }) });
    const pages: unknown[] = [];
    const l = listen(transport, () => void transport.messages().then((p) => pages.push(p)));
    await flush();
    sockets[0]!.open();

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
    expect(fetch).not.toHaveBeenCalled();

    sockets[7]!.open();
    expect(l.last()).toBe('open');
    expect(l.resyncs()).toBe(1);
    await flush();
    expect(call(fetch).url).toBe(`${BASE}/app/v1/messages?limit=30`);
    expect(pages).toEqual([{ items: [message], before: null }]);

    // Setelah tersambung, jedanya kembali ke 1 detik.
    sockets[7]!.drop();
    await jest.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(9);
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
    expect(l.resyncs()).toBe(1);
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
    expect(sockets[0]!.url).toContain('token=baru');
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
