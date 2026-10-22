import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';
import type { z } from 'zod';
import { planFromMe } from '@/api/account';
import { streamEventSchema, type Me, type Message, type StreamEvent } from '@/api/contract';
import { FakeTransport } from '@/api/fake/FakeTransport';
import { SAMPLE_QR_MEDIA_ID } from '@/api/fake/history';
import { HYBRID_EVENTS, HYBRID_ROUTES, HybridTransport, type TransportMethod } from '@/api/hybrid';
import { createMemorySession } from '@/api/session';
import type { ConnectionStatus, Transport } from '@/api/transport';

// Mode akun: setiap method Transport dikirim ke sisi yang tertulis di HYBRID_ROUTES (server asli atau data contoh), dan
// stream gabungannya tidak pernah mengirim satu event dua kali.

/** Anggota `interface Transport` langsung dari src/api/transport.ts, supaya method baru tanpa jalur ketahuan di sini. */
function transportMembers(): string[] {
  const path = join(__dirname, '..', 'src', 'api', 'transport.ts');
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  let members: string[] | null = null;
  source.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === 'Transport') {
      members = node.members.flatMap((m) => (m.name && ts.isIdentifier(m.name) ? [m.name.text] : []));
    }
  });
  if (!members) throw new Error('interface Transport tidak ditemukan');
  return members;
}

const ME: Me = {
  id: 'u-7',
  name: 'Budi Santoso',
  assistantName: 'Sari',
  phone: '6281234567890',
  plan: { name: 'Coba gratis 7 hari', activeUntil: '2026-10-29T17:00:00.000Z' },
  features: { voice: true },
};

/** Transport perekam: setiap method mencatat namanya dan menjawab seadanya (atau dengan `answers` yang diganti tes). */
function recorder(me: Me = ME) {
  const calls: string[] = [];
  const answers = new Map<string, (...args: unknown[]) => unknown>();
  const answer = (name: string): unknown => {
    switch (name) {
      case 'me':
        return Promise.resolve(me);
      case 'authVerify':
        return Promise.resolve({ token: 'tok', user: me });
      case 'messages':
        return Promise.resolve({ items: [], before: null });
      case 'messagesChanged':
        return Promise.resolve({ items: [], more: false });
      case 'send':
        return Promise.resolve({ id: 'm', seq: 1, rev: 1, at: '', from: 'user', via: 'app', parts: [] });
      case 'subscribe':
        return () => {};
      case 'openVoice':
        return { kind: 'sesi-suara' };
      case 'dispose':
        return undefined;
      default:
        return Promise.resolve({});
    }
  };
  const transport = new Proxy({} as Transport, {
    get(_, prop) {
      if (prop === 'mode') return 'contoh';
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      return (...args: unknown[]) => {
        calls.push(prop);
        const given = answers.get(prop);
        return given ? given(...args) : answer(prop);
      };
    },
  });
  return { transport, calls, answers };
}

function hybridOf(realMe?: Me) {
  const real = recorder(realMe);
  const fake = recorder();
  const session = createMemorySession('tok');
  const hybrid = new HybridTransport(real.transport, fake.transport as unknown as FakeTransport, session);
  return { hybrid, real, fake, session };
}

/** Argumen yang wajar untuk tiap method (isinya tidak dibaca perekam). */
const ARGS: Partial<Record<TransportMethod, unknown[]>> = {
  draftAction: ['d-1', { action: 'send' }],
  mediaUrl: ['m-1'],
  subscribe: [() => {}, () => {}],
};

describe('tabel jalur', () => {
  test('setiap method Transport punya jalur, dan tidak ada jalur untuk method yang tidak ada', () => {
    const members = transportMembers().filter((m) => m !== 'mode');
    expect(members.length).toBeGreaterThan(40);
    expect(Object.keys(HYBRID_ROUTES).sort()).toEqual([...members].sort());
    for (const m of members)
      expect(typeof (HybridTransport.prototype as unknown as Record<string, unknown>)[m]).toBe('function');
  });

  test.each(Object.entries(HYBRID_ROUTES).filter(([, route]) => route !== 'pilah'))(
    '%s dikirim ke %s',
    async (name, route) => {
      const { hybrid, real, fake } = hybridOf();
      const fn = (hybrid as unknown as Record<string, (...a: unknown[]) => unknown>)[name]!;
      const result = fn.apply(hybrid, ARGS[name as TransportMethod] ?? []);
      if (result instanceof Promise) await result;
      const toReal = real.calls.includes(name);
      const toFake = fake.calls.includes(name);
      if (route === 'akun') expect([toReal, toFake]).toEqual([true, false]);
      if (route === 'contoh') expect([toReal, toFake]).toEqual([false, true]);
      if (route === 'gabung') expect([toReal, toFake]).toEqual([true, true]);
      // Data contoh hanya menanyakan pemiliknya ke server asli (`GET /me`), tidak pernah yang lain.
      if (route === 'contoh') expect(real.calls.filter((c) => c !== 'me')).toEqual([]);
    },
  );

  test('draftAction: draf dari utas asli ke server asli, draf contoh ke server tiruan', async () => {
    const { hybrid, real, fake } = hybridOf();
    await hybrid.draftAction('draf-contoh', { action: 'cancel' });
    expect(fake.calls).toEqual(['draftAction']);
    expect(real.calls).toEqual([]);

    // Kartu draf yang datang di utas asli (riwayat, kirim, atau stream) dikenali dari id-nya.
    const withDraft: Message = {
      id: 'm-9',
      seq: 9,
      rev: 9,
      at: '2026-10-22T02:00:00.000Z',
      from: 'assistant',
      via: 'app',
      parts: [
        {
          type: 'card',
          card: {
            kind: 'draft',
            draft: { id: 'draf-asli', to: 'Pak Budi', channel: 'WhatsApp', text: 'Halo', status: 'draft' },
          },
        },
      ],
    } as unknown as Message;
    real.answers.set('messages', async () => ({ items: [withDraft], before: null }));
    await hybrid.messages();
    await hybrid.draftAction('draf-asli', { action: 'send' });
    expect(real.calls).toContain('draftAction');
    expect(fake.calls.filter((c) => c === 'draftAction')).toHaveLength(1);
  });

  test('mediaUrl: QRIS, laporan, dan gambar kamera contoh ke server tiruan; selain itu ke server asli', async () => {
    const { hybrid, real, fake } = hybridOf();
    await hybrid.mediaUrl(SAMPLE_QR_MEDIA_ID);
    await hybrid.mediaUrl('snap-kamera-tamu');
    expect(fake.calls).toEqual(['mediaUrl', 'mediaUrl']);
    await hybrid.mediaUrl('41');
    await hybrid.mediaUrl('suara-balasan-7');
    expect(real.calls).toEqual(['mediaUrl', 'mediaUrl']);
  });
});

describe('event stream', () => {
  test('setiap jenis event punya satu asal', () => {
    const types = streamEventSchema.options.map((o) => (o.shape.type as z.ZodLiteral<string>).value);
    expect(Object.keys(HYBRID_EVENTS).sort()).toEqual([...types].sort());
    expect(HYBRID_EVENTS.ping).toBeNull();
  });

  test('utas dari server asli, data layar dari server tiruan; tidak ada yang sampai dua kali', async () => {
    // Dua server tiruan di memori: satu berperan server asli, satu data contoh di aplikasi.
    const realSession = createMemorySession('tok');
    const real = new FakeTransport(realSession, { thinkMs: 100 });
    const fake = new FakeTransport(createMemorySession(null), { thinkMs: 100 });
    const hybrid = new HybridTransport(real, fake, realSession);
    const events: StreamEvent[] = [];
    const statuses: ConnectionStatus[] = [];
    const resyncs: (number | undefined)[] = [];
    const off = hybrid.subscribe(
      (e) => events.push(e),
      (s) => statuses.push(s),
      (rev) => resyncs.push(rev),
    );
    await jest.advanceTimersByTimeAsync(0);
    // Status dan resync hanya dari server asli (yang dilihat chat), sekali per sambungan.
    expect(statuses).toEqual(['closed', 'open']);
    expect(resyncs).toHaveLength(1);

    // Pesan dari WhatsApp di server asli: sampai, sekali.
    real.receive({ from: 'user', via: 'whatsapp', parts: [{ type: 'text', text: 'dari WhatsApp' }] });
    // Pesan di utas server tiruan (misalnya draf pesanan Usaha contoh): tidak pernah sampai ke chat asli.
    fake.receive({ from: 'assistant', via: 'app', parts: [{ type: 'text', text: 'utas contoh' }] });
    const texts = () =>
      events.flatMap((e) =>
        e.type === 'message' ? e.message.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])) : [],
      );
    expect(texts()).toEqual(['dari WhatsApp']);

    // Kirim lewat server asli: pesan, berpikir, jawaban, berhenti berpikir.
    await hybrid.send({ kind: 'text', clientId: 'c-1', text: 'Halo' });
    await jest.advanceTimersByTimeAsync(150);
    const thinking = events.filter((e) => e.type === 'thinking');
    expect(thinking.map((e) => e.type === 'thinking' && e.on)).toEqual([true, false]);
    expect(texts().filter((t) => t === 'Halo')).toHaveLength(1);

    // Perangkat diatur di server tiruan: satu event perangkat. Yang sama di server asli: tidak diteruskan.
    events.length = 0;
    await fake.controlDevice('lampu-utama', { on: false });
    await real.controlDevice('lampu-utama', { on: false });
    await jest.advanceTimersByTimeAsync(50);
    expect(events.filter((e) => e.type === 'device')).toHaveLength(1);
    expect(events.every((e) => HYBRID_EVENTS[e.type] !== null)).toBe(true);

    off();
    hybrid.dispose();
  });
});

describe('pemilik akun asli di data contoh', () => {
  test('Beranda menyapa dengan nama dari GET /me; tanpa jawaban /me: sapaan tanpa nama', async () => {
    const real = new FakeTransport(createMemorySession('tok'), { me: { name: 'Budi Santoso' } });
    const fake = new FakeTransport(createMemorySession(null));
    const hybrid = new HybridTransport(real, fake, createMemorySession('tok'));
    expect((await fake.home()).greetingName).toBe('Rina');
    expect((await hybrid.home()).greetingName).toBe('Budi Santoso');
    expect((await hybrid.setPlace('Rumah')).greetingName).toBe('Budi Santoso');

    const offline = recorder();
    offline.answers.set('me', () => Promise.reject(new Error('tanpa sinyal')));
    const hybrid2 = new HybridTransport(offline.transport, fake, createMemorySession('tok'));
    expect((await hybrid2.home()).greetingName).toBeNull();
    hybrid.dispose();
  });

  test('Akun: nama, nomor, paket, dan nama asisten asli; tanpa /me gagal (bukan paket contoh)', async () => {
    const realSession = createMemorySession('tok');
    const real = new FakeTransport(realSession, {
      me: { name: 'Budi Santoso', assistantName: 'Sari', plan: ME.plan, phone: ME.phone },
    });
    const fake = new FakeTransport(createMemorySession(null));
    const hybrid = new HybridTransport(real, fake, realSession);
    const sample = await fake.account();
    const account = await hybrid.account();
    expect(account.me.name).toBe('Budi Santoso');
    expect(account.me.phone).toBe(ME.phone);
    expect(account.assistant.name).toBe('Sari');
    expect(account.plan).toEqual(planFromMe(ME.plan));
    expect(account.plan.status).toBe('trial');
    // Selebihnya contoh (notifikasi, HP), tidak berubah.
    expect(account.notifications).toEqual(sample.notifications);

    const offline = recorder();
    offline.answers.set('me', () => Promise.reject(new Error('tanpa sinyal')));
    const hybrid2 = new HybridTransport(offline.transport, fake, createMemorySession('tok'));
    await expect(hybrid2.account()).rejects.toThrow('tanpa sinyal');
    hybrid.dispose();
  });

  test('pemilik berubah (GET /me baru): Beranda dan Akun yang tampil ikut diperbarui lewat stream', async () => {
    const { hybrid, real } = hybridOf();
    const events: StreamEvent[] = [];
    hybrid.subscribe(
      (e) => events.push(e),
      () => {},
    );
    real.answers.set('me', async () => ({ ...ME, name: 'Budi' }));
    await hybrid.me();
    await jest.advanceTimersByTimeAsync(0);
    const home = events.find((e) => e.type === 'home');
    const account = events.find((e) => e.type === 'account');
    expect(home?.type === 'home' && home.home.greetingName).toBe('Budi');
    expect(account?.type === 'account' && account.account.me.name).toBe('Budi');
  });

  test('keluar atau sesi dicabut: pemilik dilupakan', async () => {
    const realSession = createMemorySession('tok');
    const real = recorder();
    const hybrid = new HybridTransport(real.transport, recorder().transport as unknown as FakeTransport, realSession);
    await hybrid.home();
    expect(real.calls.filter((c) => c === 'me')).toHaveLength(1);
    await hybrid.home();
    expect(real.calls.filter((c) => c === 'me')).toHaveLength(1);
    await realSession.clear();
    await hybrid.home();
    expect(real.calls.filter((c) => c === 'me')).toHaveLength(2);
  });

  test('paket dari nama server', () => {
    expect(planFromMe({ name: 'Coba gratis 7 hari', activeUntil: null })).toEqual({
      name: 'Coba gratis 7 hari',
      status: 'trial',
    });
    expect(planFromMe({ name: 'Bisnis', activeUntil: '2027-01-12T17:00:00.000Z' })).toEqual({
      name: 'Bisnis',
      status: 'aktif',
      until: '2027-01-12T17:00:00.000Z',
    });
    expect(planFromMe({ name: 'Bisnis (berakhir)', activeUntil: '2026-01-12T17:00:00.000Z' }).status).toBe('berakhir');
    expect(planFromMe({ name: 'Belum ada paket', activeUntil: null }).status).toBe('berakhir');
  });
});
