import {
  historyEntrySchema,
  historyPageSchema,
  streamEventSchema,
  type HistoryEntry,
  type HistoryPage,
  type StreamEvent,
} from '@/api/contract';
import { FakeTransport } from '@/api/fake/FakeTransport';
import { DRAFT_SENT_TEXT, ERROR_TEXT } from '@/api/errors';
import { countdownText, dayLabel, groupByDay, linkHref, remainingSec } from '@/api/history';
import { HistoryController } from '@/api/historyController';
import { parseEventLenient, parseHistoryEntryLenient, parseHistoryLenient } from '@/api/lenient';
import { createMemorySession } from '@/api/session';
import { ApiFailure, type Transport } from '@/api/transport';

const NOW = Date.UTC(2026, 9, 21, 3, 0);
const at = (min: number) => new Date(NOW - min * 60_000).toISOString();
const entry = (id: string, minAgo: number, over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id,
  at: at(minAgo),
  kind: 'rumah',
  icon: 'bulb',
  title: `Entri ${id}`,
  ...over,
});

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

/** Transport tiruan kecil: halaman Riwayat dari skrip, aksi draf dicatat, event didorong dengan `push`. */
function scripted(pages: (query: { kind?: string; before?: string }) => HistoryPage | Promise<HistoryPage>) {
  const listeners = new Set<(e: StreamEvent) => void>();
  const resyncs = new Set<(rev: number | undefined) => void>();
  const calls: { kind?: string; before?: string }[] = [];
  const cancels: string[] = [];
  const state = { cancel: (_id: string): Promise<unknown> => Promise.resolve({}) };
  const transport = {
    mode: 'server',
    history: jest.fn(async (q: { kind?: string; before?: string } = {}) => {
      calls.push(q);
      return pages(q);
    }),
    draftAction: jest.fn(async (id: string) => {
      cancels.push(id);
      return state.cancel(id);
    }),
    subscribe: (onEvent: (e: StreamEvent) => void, _s: unknown, onResync?: (rev: number | undefined) => void) => {
      listeners.add(onEvent);
      if (onResync) resyncs.add(onResync);
      return () => {
        listeners.delete(onEvent);
        if (onResync) resyncs.delete(onResync);
      };
    },
  } as unknown as Transport;
  const controller = new HistoryController(transport);
  controller.start();
  return {
    controller,
    calls,
    cancels,
    state,
    transport,
    push: (e: StreamEvent) => listeners.forEach((l) => l(e)),
    resync: () => resyncs.forEach((r) => r(undefined)),
  };
}

const page = (items: HistoryEntry[], before: string | null, rev = 5, now?: string): HistoryPage => ({
  items,
  before,
  rev,
  ...(now ? { now } : {}),
});

describe('Riwayat: halaman dan saringan', () => {
  test('halaman pertama, lalu "muat lagi" menempel di ujung tanpa menggandakan', async () => {
    const s = scripted((q) =>
      q.before === undefined ? page([entry('a', 1), entry('b', 2)], 'b') : page([entry('b', 2), entry('c', 3)], null),
    );
    await s.controller.load();
    const list = () => s.controller.getState().lists.semua!;
    expect(list().items.map((e) => e.id)).toEqual(['a', 'b']);
    expect(list().before).toBe('b');
    await s.controller.loadMore();
    expect(s.calls[1]).toEqual({ kind: undefined, before: 'b' });
    expect(list().items.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(list().before).toBeNull();
    // Sudah habis: tidak meminta lagi.
    await s.controller.loadMore();
    expect(s.calls).toHaveLength(2);
  });

  test('"muat lagi" bersamaan hanya satu permintaan; gagal memberi teks ramah dan boleh diulang', async () => {
    let fail = true;
    const s = scripted((q) => {
      if (q.before === undefined) return page([entry('a', 1)], 'a');
      if (fail) throw new ApiFailure('network');
      return page([entry('z', 9)], null);
    });
    await s.controller.load();
    const first = s.controller.loadMore();
    void s.controller.loadMore();
    await first;
    expect(s.calls.filter((c) => c.before !== undefined)).toHaveLength(1);
    expect(s.controller.getState().lists.semua!.moreError).toBe(ERROR_TEXT);
    expect(s.controller.getState().lists.semua!.items).toHaveLength(1);
    fail = false;
    await s.controller.loadMore();
    expect(s.controller.getState().lists.semua!.items.map((e) => e.id)).toEqual(['a', 'z']);
    expect(s.controller.getState().lists.semua!.moreError).toBeNull();
  });

  test('tiap saringan punya daftar sendiri; gagal memuat pertama kali memberi error, daftar yang ada tidak hilang', async () => {
    let fail = false;
    const s = scripted((q) => {
      if (fail) throw new ApiFailure('timeout');
      return q.kind === 'kirim' ? page([entry('k1', 1, { kind: 'kirim' })], null) : page([entry('a', 1)], null);
    });
    await s.controller.load();
    await s.controller.load('kirim');
    const { lists } = s.controller.getState();
    expect(lists.semua!.items.map((e) => e.id)).toEqual(['a']);
    expect(lists.kirim!.items.map((e) => e.id)).toEqual(['k1']);
    fail = true;
    await s.controller.load();
    expect(s.controller.getState().lists.semua!.status).toBe('ready');
    await s.controller.load('usaha');
    expect(s.controller.getState().lists.usaha).toMatchObject({ status: 'error', error: ERROR_TEXT });
  });

  test('jawaban dengan rev lebih lama dari yang sudah dilihat dibuang dan dimuat sekali lagi', async () => {
    let n = 0;
    const s = scripted(() => {
      n += 1;
      if (n === 1) return page([entry('a', 1)], null, 9);
      if (n === 2) return page([entry('lama', 1)], null, 3);
      return page([entry('baru', 1)], null, 10);
    });
    await s.controller.load();
    await s.controller.load();
    expect(s.controller.getState().lists.semua!.items.map((e) => e.id)).toEqual(['baru']);
  });

  test('reloadAll memuat ulang semua saringan yang pernah dibuka, juga saat stream tersambung lagi', async () => {
    const s = scripted(() => page([entry('a', 1)], null));
    await s.controller.load();
    await s.controller.load('rumah');
    s.calls.length = 0;
    s.resync();
    await flush();
    expect(s.calls.map((c) => c.kind).sort()).toEqual(['rumah', undefined]);
  });

  test('jam server dari jawaban menggeser jam hitung mundur', async () => {
    const real = Date.now();
    const s = scripted(() => page([entry('a', 1)], null, 5, new Date(real + 120_000).toISOString()));
    await s.controller.load();
    expect(s.controller.getState().skewMs).toBeGreaterThan(119_000);
    expect(Math.abs(s.controller.now() - (Date.now() + 120_000))).toBeLessThan(1500);
  });
});

describe('Riwayat: event history (upsert)', () => {
  const loaded = async () => {
    const s = scripted((q) =>
      q.kind === 'rumah'
        ? page([entry('r1', 5)], null)
        : page([entry('a', 10, { kind: 'agenda' }), entry('b', 20, { kind: 'agenda' })], null),
    );
    await s.controller.load();
    await s.controller.load('rumah');
    return s;
  };
  const items = (s: Awaited<ReturnType<typeof loaded>>, key = 'semua') =>
    s.controller.getState().lists[key]!.items.map((e) => e.id);

  test('entri baru disisipkan menurut waktu di semua daftar yang cocok', async () => {
    const s = await loaded();
    s.push({ type: 'history', entry: entry('baru', 0), rev: 6 });
    s.push({ type: 'history', entry: entry('tengah', 15, { kind: 'usaha' }), rev: 7 });
    expect(items(s)).toEqual(['baru', 'a', 'tengah', 'b']);
    expect(items(s, 'rumah')).toEqual(['baru', 'r1']);
  });

  test('entri dengan id yang sama menggantikan; jenis yang berubah keluar dari saringan lama', async () => {
    const s = await loaded();
    s.push({ type: 'history', entry: entry('a', 10, { kind: 'agenda', status: 'terkirim' }), rev: 6 });
    expect(s.controller.getState().lists.semua!.items[0]).toMatchObject({ id: 'a', status: 'terkirim' });
    s.push({ type: 'history', entry: entry('r1', 5, { kind: 'agenda' }), rev: 7 });
    expect(items(s, 'rumah')).toEqual([]);
    expect(items(s)).toContain('r1');
  });

  test('event dengan rev lebih lama dibuang', async () => {
    const s = await loaded();
    s.push({ type: 'history', entry: entry('lama', 0), rev: 4 });
    expect(items(s)).toEqual(['a', 'b']);
  });

  test('entri yang lebih tua dari semua yang dimuat, selagi masih ada halaman lama, tidak disisipkan', async () => {
    const s = scripted(() => page([entry('a', 10)], 'a'));
    await s.controller.load();
    s.push({ type: 'history', entry: entry('tua', 500), rev: 6 });
    expect(items(s)).toEqual(['a']);
  });

  test('event bukan history atau sebelum daftar dimuat tidak berbuat apa-apa', async () => {
    const s = scripted(() => page([entry('a', 1)], null));
    s.push({ type: 'history', entry: entry('x', 0), rev: 9 });
    s.push({ type: 'ping' });
    expect(s.controller.getState().lists).toEqual({});
  });
});

describe('Riwayat: Batalkan', () => {
  const held = (over: Partial<HistoryEntry> = {}) =>
    entry('k1', 1, {
      kind: 'kirim',
      status: 'menunggu',
      undoable: { draftId: 'o-1', until: new Date(NOW + 240_000).toISOString() },
      ...over,
    });

  test('satu permintaan sekaligus; berhasil: dibatalkan, tombolnya hilang', async () => {
    const s = scripted(() => page([held()], null));
    await s.controller.load();
    let release!: () => void;
    s.state.cancel = () => new Promise((r) => (release = () => r({})));
    const first = s.controller.cancel(held());
    expect(s.controller.getState().cancelling.has('o-1')).toBe(true);
    // Ketukan kedua selagi berjalan diabaikan.
    expect(await s.controller.cancel(held())).toEqual({ ok: false, message: '' });
    release();
    expect(await first).toEqual({ ok: true });
    expect(s.cancels).toEqual(['o-1']);
    expect(s.transport.draftAction).toHaveBeenCalledWith('o-1', { action: 'cancel' });
    const row = s.controller.getState().lists.semua!.items[0]!;
    expect(row.status).toBe('dibatalkan');
    expect(row.undoable).toBeUndefined();
    expect(s.controller.getState().cancelling.size).toBe(0);
  });

  test('sudah terkirim (409 status_draf): teks ramah dan daftar dimuat ulang', async () => {
    let sent = false;
    const s = scripted(() => page([sent ? held({ status: 'terkirim', undoable: undefined }) : held()], null));
    await s.controller.load();
    s.state.cancel = async () => {
      sent = true;
      throw new ApiFailure('server', { status: 409, error: 'status_draf' });
    };
    expect(await s.controller.cancel(held())).toEqual({ ok: false, message: DRAFT_SENT_TEXT });
    await flush();
    expect(s.controller.getState().lists.semua!.items[0]!.status).toBe('terkirim');
  });

  test('gagal lain: teks ramah, kiriman tetap bisa dibatalkan lagi', async () => {
    const s = scripted(() => page([held()], null));
    await s.controller.load();
    s.state.cancel = async () => {
      throw new ApiFailure('network');
    };
    expect(await s.controller.cancel(held())).toEqual({ ok: false, message: ERROR_TEXT });
    expect(s.controller.getState().lists.semua!.items[0]!.undoable).toBeDefined();
    expect(s.controller.getState().cancelling.size).toBe(0);
  });

  test('entri tanpa batas Batalkan tidak berbuat apa-apa', async () => {
    const s = scripted(() => page([entry('a', 1)], null));
    expect(await s.controller.cancel(entry('a', 1))).toEqual({ ok: false, message: '' });
    expect(s.cancels).toEqual([]);
  });
});

describe('Riwayat: teks bantu dan kontrak', () => {
  test('hari, kelompok, dan hitung mundur', () => {
    expect(dayLabel(at(10), NOW)).toBe('Hari ini');
    expect(dayLabel(at(60 * 24 + 5), NOW)).toBe('Kemarin');
    expect(dayLabel('2026-01-05T05:00:00Z', NOW)).toBe('5 Jan 2026');
    expect(dayLabel('bukan waktu', NOW)).toBe('');
    const groups = groupByDay([entry('a', 10), entry('b', 20), entry('c', 60 * 24 + 5)], NOW);
    expect(groups.map((g) => [g.day, g.items.length])).toEqual([
      ['Hari ini', 2],
      ['Kemarin', 1],
    ]);
    expect(remainingSec(new Date(NOW + 272_000).toISOString(), NOW)).toBe(272);
    expect(remainingSec(at(1), NOW)).toBe(0);
    expect(countdownText(272)).toBe('4:32');
    expect(countdownText(5)).toBe('0:05');
  });

  test('tautan: hanya layar yang dikenal, parameter diperiksa', () => {
    expect(linkHref({ route: '/chat' })).toBe('/chat');
    expect(linkHref({ route: '/perangkat/[id]', params: { id: 'ac-kamar' } })).toEqual({
      pathname: '/perangkat/[id]',
      params: { id: 'ac-kamar' },
    });
    expect(linkHref({ route: '/perangkat/[id]' })).toBeNull();
    expect(linkHref({ route: '/perangkat/[id]', params: { id: '../keluar' } })).toBeNull();
    expect(linkHref({ route: '/admin' })).toBeNull();
    expect(linkHref({ route: 'https://jahat.id' })).toBeNull();
    expect(linkHref(undefined)).toBeNull();
  });

  test('skema dan pembacaan longgar', () => {
    const ok = entry('a', 1, { detail: 'lewat suara', channel: 'chat', status: 'terkirim', link: { route: '/chat' } });
    expect(historyEntrySchema.safeParse(ok).success).toBe(true);
    expect(historyPageSchema.safeParse({ items: [ok], before: null, rev: 3 }).success).toBe(true);
    // Jenis baru dibaca lainnya; keterangan opsional yang rusak dibuang; entri rusak dibuang dari halaman.
    expect(parseHistoryEntryLenient({ ...ok, kind: 'masa_depan' })?.kind).toBe('lainnya');
    expect(parseHistoryEntryLenient({ ...ok, channel: 'sms', status: 'aneh', link: 5 })).toEqual({
      id: 'a',
      at: ok.at,
      kind: 'rumah',
      icon: 'bulb',
      title: 'Entri a',
      detail: 'lewat suara',
    });
    expect(parseHistoryEntryLenient({ ...ok, title: '' })).toBeNull();
    const parsed = parseHistoryLenient({ items: [ok, { id: 'x' }, 7], before: 'a', rev: 4, now: 'bukan waktu' });
    expect(parsed).toEqual({ items: [ok], before: 'a', rev: 4 });
    expect(parseHistoryLenient({ items: [], before: null })).toBeNull();
    expect(parseHistoryLenient({ items: 'x', before: null, rev: 1 })).toBeNull();
    const event = { type: 'history', entry: ok, rev: 3 };
    expect(streamEventSchema.safeParse(event).success).toBe(true);
    expect(parseEventLenient({ ...event, entry: { ...ok, status: 'aneh' } })).toMatchObject({ type: 'history' });
    expect(parseEventLenient({ ...event, rev: 0 })).toBeNull();
  });
});

describe('server tiruan', () => {
  const make = () => {
    const transport = new FakeTransport(createMemorySession(null), { mode: 'server' });
    const controller = new HistoryController(transport);
    controller.start();
    return { transport, controller };
  };

  test('GET /history dari penyimpanan contoh: terbaru dulu, saringan, halaman, dan jam server', async () => {
    const { transport } = make();
    const all = await transport.history();
    expect(all.items.length).toBeGreaterThanOrEqual(6);
    expect(all.before).toBeNull();
    expect(all.items.every((e) => historyEntrySchema.safeParse(e).success)).toBe(true);
    const times = all.items.map((e) => Date.parse(e.at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(Date.parse(all.now!)).toBeGreaterThan(0);
    const rumah = await transport.history({ kind: 'rumah' });
    expect(rumah.items.length).toBeGreaterThan(0);
    expect(rumah.items.every((e) => e.kind === 'rumah')).toBe(true);
    const first = await transport.history({ limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.before).toBe(first.items[1]!.id);
    const next = await transport.history({ limit: 2, before: first.before! });
    expect(next.items[0]!.id).toBe(all.items[2]!.id);
    await expect(transport.history({ limit: 0 })).rejects.toMatchObject({ error: 'tidak_valid' });
  });

  test('kiriman yang ditahan: Batalkan memakai draf, riwayat dan stream ikut', async () => {
    const { transport, controller } = make();
    await controller.load();
    const kinds = () => controller.getState().lists.semua!.items;
    // Setujui draf Pak Budi lewat chat: entri kiriman muncul lewat event history dengan batas Batalkan.
    await transport.draftAction('o-budi', { action: 'send' });
    await flush();
    const mine = kinds().find((e) => e.kind === 'kirim')!;
    expect(mine).toMatchObject({ status: 'menunggu', channel: 'whatsapp', link: { route: '/chat' } });
    expect(mine.undoable?.draftId).toBe('o-budi');
    expect(await controller.cancel(mine)).toEqual({ ok: true });
    await flush();
    expect(kinds().find((e) => e.kind === 'kirim')).toMatchObject({ status: 'dibatalkan' });
    expect(kinds().find((e) => e.kind === 'kirim')?.undoable).toBeUndefined();
    // Sudah dibatalkan: server menolak, teks ramah.
    expect((await controller.cancel(mine)).ok).toBe(false);
  });

  test('masa tahan habis: entri menjadi terkirim lewat event; pengiriman gagal menjadi gagal', async () => {
    const { transport, controller } = make();
    await controller.load();
    await transport.draftAction('o-budi', { action: 'send' });
    await flush();
    jest.advanceTimersByTime(5 * 60_000 + 10);
    await flush();
    expect(controller.getState().lists.semua!.items.find((e) => e.kind === 'kirim')).toMatchObject({
      status: 'terkirim',
    });
    expect(controller.getState().lists.semua!.items.find((e) => e.kind === 'kirim')?.undoable).toBeUndefined();

    const gagal = make();
    gagal.transport.failHeldSends();
    await gagal.controller.load();
    await gagal.transport.draftAction('o-budi', { action: 'send' });
    jest.advanceTimersByTime(5 * 60_000 + 10);
    await flush();
    expect(gagal.controller.getState().lists.semua!.items.find((e) => e.kind === 'kirim')?.status).toBe('gagal');
  });
});
