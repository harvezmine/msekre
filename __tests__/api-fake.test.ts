import {
  HELD_MINUTES,
  isoDateTimeSchema,
  messageSchema,
  meSchema,
  streamEventSchema,
  type Card,
  type Message,
  type Part,
  type StreamEvent,
} from '@/api/contract';
import { FAKE_WRONG_CODE, FakeTransport, type FakeOptions } from '@/api/fake/FakeTransport';
import { hhmmWib, SAMPLE_NOW } from '@/api/fake/clock';
import { SAMPLE_QR_MEDIA_ID, sampleHistory } from '@/api/fake/history';
import { ASK_REPLY_TO, PAYMENT_CANCELLED, parseReplyRequest, parseRupiah, SAMPLE_REPLY } from '@/api/fake/scenario';
import { createMemorySession } from '@/api/session';
import type { ConnectionStatus } from '@/api/transport';
import { BUDI_DRAFT_ID } from '@/sample/outgoing';
import { draftIntro, THINK_MS } from '@/sample/chat';

function setup(options: FakeOptions & { token?: string | null } = {}) {
  const { token = null, ...rest } = options;
  const session = createMemorySession(token);
  const transport = new FakeTransport(session, rest);
  const events: StreamEvent[] = [];
  /** Event `home` dipisah: ia menyertai setiap perubahan data contoh (lihat api-home.test.ts). */
  const homeEvents: StreamEvent[] = [];
  const statuses: ConnectionStatus[] = [];
  let resyncs = 0;
  const listen = () =>
    transport.subscribe(
      (e) => (e.type === 'home' ? homeEvents : events).push(e),
      (s) => statuses.push(s),
      () => (resyncs += 1),
    );
  return {
    session,
    transport,
    events,
    homeEvents,
    statuses,
    listen,
    resyncs: () => resyncs,
    last: () => statuses.at(-1),
  };
}

const after = (ms: number) => jest.advanceTimersByTimeAsync(ms);
const textOf = (m: Message) => m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join(' ');
const cardOf = (m: Message): Card | undefined => m.parts.find((p) => p.type === 'card')?.card;
const messagesOf = (events: StreamEvent[]) => events.flatMap((e) => (e.type === 'message' ? [e.message] : []));
const assistantMessages = (events: StreamEvent[]) =>
  events.flatMap((e) => (e.type === 'message' && e.message.from === 'assistant' ? [e.message] : []));

let clientSeq = 0;

/** Kirim teks, tunggu jawabannya, dan kembalikan pesan asisten yang datang. */
async function ask(t: ReturnType<typeof setup>, text: string, choice?: { messageId: string; choiceId: string }) {
  const from = t.events.length;
  const known = new Set(messagesOf(t.events).map((m) => m.id));
  await (choice
    ? t.transport.send({ kind: 'choice', clientId: `c-${++clientSeq}`, ...choice })
    : t.transport.send({ kind: 'text', clientId: `c-${++clientSeq}`, text }));
  await after(THINK_MS);
  // Upsert pesan lama (misalnya pilihan yang diambil) bukan balasan baru.
  return assistantMessages(t.events.slice(from)).filter((m) => !known.has(m.id));
}

describe('riwayat contoh', () => {
  test('utas 0b sebagai pesan yang sah, dari yang terbaru, termasuk pesan lewat WhatsApp', async () => {
    const { transport } = setup();
    const page = await transport.messages();
    expect(page.before).toBeNull();
    for (const m of page.items) expect(messageSchema.safeParse(m).success).toBe(true);
    const ats = page.items.map((m) => m.at);
    expect([...ats].sort().reverse()).toEqual(ats);

    const oldest = page.items.at(-1)!;
    expect(oldest).toMatchObject({ from: 'user', via: 'whatsapp' });
    expect(page.items.filter((m) => m.via === 'whatsapp')).toHaveLength(2);
    expect(textOf(page.items[0]!)).toBe('Cek stok kedai');

    const kinds = page.items.flatMap((m) => m.parts.map((p: Part) => (p.type === 'card' ? p.card.kind : p.type)));
    expect(new Set(kinds)).toEqual(
      new Set(['text', 'device', 'draft', 'notes', 'document', 'payment', 'choices', 'qris']),
    );
    const budi = page.items.map(cardOf).find((c) => c?.kind === 'draft');
    expect(budi).toMatchObject({ draft: { id: BUDI_DRAFT_ID, status: 'draft', to: 'Pak Budi' } });
  });

  test('halaman lama lewat before', async () => {
    const history: Message[] = Array.from({ length: 70 }, (_, i) => ({
      id: `p${i}`,
      seq: i + 1,
      rev: i + 1,
      at: new Date(SAMPLE_NOW + i * 60_000).toISOString(),
      from: i % 2 ? 'assistant' : 'user',
      via: 'app',
      parts: [{ type: 'text', text: `Pesan ${i}` }],
    }));
    const { transport } = setup({ history });
    const first = await transport.messages();
    expect(first.items.map((m) => m.id)).toEqual(Array.from({ length: 30 }, (_, i) => `p${69 - i}`));
    expect(first.before).toBe(41);
    const second = await transport.messages(first.before!);
    expect(second.items[0]!.id).toBe('p39');
    expect(second.before).toBe(11);
    const third = await transport.messages(second.before!);
    expect(third.items.map((m) => m.id)).toEqual(Array.from({ length: 10 }, (_, i) => `p${9 - i}`));
    expect(third.before).toBeNull();
    // `before` yang tidak ada (misalnya setelah memory_forget): halaman terbaru, bukan error.
    expect(await transport.messages(9999)).toEqual(first);
  });
});

describe('masuk', () => {
  test('nomor minimal 9 digit diterima, kode 6 angka apa pun kecuali 000000', async () => {
    const { session, transport } = setup();
    expect(await transport.authStart({ phone: '628122045' })).toEqual({ resendInSec: 60 });
    await expect(transport.authStart({ phone: '62812204' })).rejects.toMatchObject({ error: 'tidak_valid' });

    await expect(transport.authVerify({ phone: '628122045', code: FAKE_WRONG_CODE })).rejects.toMatchObject({
      code: 'kode_salah',
      status: 400,
    });
    await expect(transport.authVerify({ phone: '628122045', code: '12345' })).rejects.toMatchObject({
      error: 'tidak_valid',
    });
    expect(await session.get()).toBeNull();

    const res = await transport.authVerify({ phone: '628122045', code: '481516' });
    expect(meSchema.safeParse(res.user).success).toBe(true);
    expect(res.user).toMatchObject({ name: 'Rina', assistantName: 'Nadia' });
    expect(await session.get()).toBe(res.token);
    expect(await transport.me()).toEqual(res.user);

    await transport.logout();
    expect(await session.get()).toBeNull();
  });

  test('seperti server asli bila diminta: tanpa sesi 401 dan stream tertutup', async () => {
    const t = setup({ requireSession: true });
    t.listen();
    await after(0);
    expect(t.last()).toBe('closed');
    await expect(t.transport.me()).rejects.toMatchObject({ code: 'unauthorized', status: 401, error: 'tidak_masuk' });
    await expect(t.transport.mediaUrl(SAMPLE_QR_MEDIA_ID)).rejects.toMatchObject({ code: 'unauthorized' });

    await t.transport.authStart({ phone: '628122045' });
    await t.transport.authVerify({ phone: '628122045', code: '123456' });
    await after(0);
    expect(t.last()).toBe('open');
    expect(await t.transport.me()).toMatchObject({ assistantName: 'Nadia' });

    // Token dicabut server: sesi dihapus dan stream ditutup.
    t.transport.revokeSession();
    await after(0);
    expect(await t.session.get()).toBeNull();
    expect(t.last()).toBe('closed');
    await expect(t.transport.me()).rejects.toMatchObject({ code: 'unauthorized' });
  });

  test('mode contoh tidak memaksa masuk; token yang dicabut ditolak sekali', async () => {
    const { session, transport } = setup({ token: 'lama' });
    expect(await transport.me()).toMatchObject({ name: 'Rina' });
    transport.revokeSession();
    await expect(transport.me()).rejects.toMatchObject({ code: 'unauthorized' });
    expect(await session.get()).toBeNull();
    expect(await transport.me()).toMatchObject({ name: 'Rina' });
  });
});

describe('kirim pesan', () => {
  test('tersimpan, lalu pesan itu, thinking on, jawaban 1,2 detik kemudian, thinking off', async () => {
    const t = setup();
    t.listen();
    expect(t.statuses).toEqual(['closed', 'open']);

    const saved = await t.transport.send({ kind: 'text', clientId: 'c1', text: '  Halo Nadia  ' });
    expect(saved).toMatchObject({
      clientId: 'c1',
      from: 'user',
      via: 'app',
      parts: [{ type: 'text', text: 'Halo Nadia' }],
    });
    expect(messageSchema.safeParse(saved).success).toBe(true);
    expect(t.events).toEqual([]);

    await after(0);
    expect(t.events).toEqual([
      { type: 'message', message: saved },
      { type: 'thinking', runId: expect.any(String), on: true },
    ]);
    await after(THINK_MS - 1);
    expect(t.events).toHaveLength(2);
    await after(1);
    expect(t.events).toHaveLength(4);
    expect(t.events[2]).toMatchObject({ type: 'message', message: { from: 'assistant', via: 'app' } });
    expect(textOf((t.events[2] as { message: Message }).message)).toBe(SAMPLE_REPLY);
    expect(t.events[3]).toEqual({ type: 'thinking', runId: (t.events[1] as { runId: string }).runId, on: false });
    for (const e of t.events) expect(streamEventSchema.safeParse(e).success).toBe(true);

    const page = await t.transport.messages();
    expect(page.items.slice(0, 2).map((m) => m.id)).toEqual([
      (t.events[2] as { message: Message }).message.id,
      saved.id,
    ]);
  });

  test('clientId yang sama tidak membuat pesan baru', async () => {
    const t = setup();
    t.listen();
    const a = await t.transport.send({ kind: 'text', clientId: 'c1', text: 'Halo' });
    await after(THINK_MS);
    const count = t.events.length;
    const b = await t.transport.send({ kind: 'text', clientId: 'c1', text: 'Halo' });
    await after(THINK_MS * 2);
    expect(b).toEqual(a);
    expect(t.events).toHaveLength(count);
  });

  test('isi yang tidak sesuai kontrak ditolak', async () => {
    const { transport } = setup();
    await expect(transport.send({ kind: 'text', clientId: 'c1', text: '   ' })).rejects.toMatchObject({
      error: 'tidak_valid',
    });
  });

  test('jeda request tiruan', async () => {
    const { transport } = setup({ latencyMs: 300 });
    let saved: Message | undefined;
    void transport.send({ kind: 'text', clientId: 'c1', text: 'Halo' }).then((m) => (saved = m));
    await after(299);
    expect(saved).toBeUndefined();
    await after(1);
    expect(saved).toMatchObject({ clientId: 'c1' });
  });

  test('dispose menghentikan jawaban yang dijadwalkan', async () => {
    const t = setup();
    t.listen();
    await t.transport.send({ kind: 'text', clientId: 'c1', text: 'Halo' });
    t.transport.dispose();
    await after(THINK_MS * 2);
    expect(t.events).toEqual([]);
    expect(t.last()).toBe('closed');
  });
});

describe('kata kunci', () => {
  test('"balas …" memberi draf yang menunggu persetujuan', async () => {
    const t = setup();
    t.listen();
    const [reply] = await ask(t, 'Balas bu sari, besok saya datang jam 10');
    expect(textOf(reply!)).toBe(draftIntro('balasan'));
    const card = cardOf(reply!);
    expect(card).toMatchObject({ kind: 'draft', draft: { to: 'Bu Sari', channel: 'whatsapp', status: 'draft' } });
    expect(card?.kind === 'draft' && card.draft.text).toBe(
      'Selamat pagi, Bu Sari. Besok saya datang jam 10. Terima kasih.',
    );

    const [askBack] = await ask(t, 'balas');
    expect(textOf(askBack!)).toBe(ASK_REPLY_TO);
  });

  test('"AC" memberi kartu perangkat', async () => {
    const t = setup();
    t.listen();
    const [set] = await ask(t, 'Nyalakan AC 22 derajat');
    expect(textOf(set!)).toBe('Sudah. AC kamar nyala di 22°.');
    expect(cardOf(set!)).toMatchObject({ kind: 'device', deviceId: 'ac-kamar', name: 'AC kamar', on: true, temp: 22 });

    const [off] = await ask(t, 'Matikan AC kamar');
    expect(cardOf(off!)).toMatchObject({ kind: 'device', on: false, temp: 22 });
    const [status] = await ask(t, 'AC gimana?');
    expect(textOf(status!)).toBe('AC kamar sedang mati.');
  });

  test('"token" memberi kartu pembayaran; "Ya, benar" memberi QRIS, "Batal" membatalkan', async () => {
    const t = setup();
    t.listen();
    const [pay] = await ask(t, 'Beli token listrik 50 ribu');
    expect(cardOf(pay!)).toMatchObject({
      kind: 'payment',
      title: 'Token listrik PLN',
      amountRp: 50000,
      ask: 'Sudah benar?',
    });
    expect(pay!.parts.find((p) => p.type === 'choices')).toMatchObject({
      choices: [
        { id: 'ya', title: 'Ya, benar' },
        { id: 'batal', title: 'Batal' },
      ],
    });

    const [qris] = await ask(t, 'Ya, benar', { messageId: pay!.id, choiceId: 'ya' });
    const card = cardOf(qris!);
    expect(card).toMatchObject({ kind: 'qris', amountRp: 50000, mediaId: SAMPLE_QR_MEDIA_ID });
    expect(card?.kind === 'qris' && isoDateTimeSchema.safeParse(card.until).success).toBe(true);
    expect(card).toMatchObject({ status: 'menunggu' });
    expect(await t.transport.mediaUrl(SAMPLE_QR_MEDIA_ID)).toEqual({ kind: 'sampleQr' });
    await expect(t.transport.mediaUrl('lain')).rejects.toMatchObject({ error: 'tidak_ditemukan' });

    const [pay2] = await ask(t, 'token 20rb');
    const [cancelled] = await ask(t, 'Batal', { messageId: pay2!.id, choiceId: 'batal' });
    expect(textOf(cancelled!)).toBe(PAYMENT_CANCELLED);
  });

  test('membaca rupiah dan permintaan membalas', () => {
    expect(parseRupiah('token 100 ribu')).toBe(100000);
    expect(parseRupiah('token 50rb')).toBe(50000);
    expect(parseRupiah('token 20k')).toBe(20000);
    expect(parseRupiah('token Rp200.000')).toBe(200000);
    expect(parseRupiah('token 1 juta')).toBe(1000000);
    expect(parseRupiah('token listrik')).toBeNull();
    expect(parseReplyRequest('Balas Pak Budi, harga sewa bisa Rp15 juta')).toEqual({
      to: 'Pak Budi',
      content: 'harga sewa bisa Rp15 juta',
    });
    expect(parseReplyRequest('balaskan ke mas andi: oke')).toEqual({ to: 'Mas Andi', content: 'oke' });
    expect(parseReplyRequest('balas pak budi')).toEqual({ to: 'Pak Budi', content: '' });
    expect(parseReplyRequest('Balasan dari Pak Budi sudah ada?')).toBeNull();
  });
});

describe('draf', () => {
  test('send → held → sent setelah 5 menit, dikabarkan lewat event draft', async () => {
    const t = setup();
    t.listen();
    const sendRes = await t.transport.draftAction(BUDI_DRAFT_ID, { action: 'send' });
    const held = sendRes.draft;
    expect(held).toMatchObject({
      id: BUDI_DRAFT_ID,
      status: 'held',
      heldUntil: new Date(SAMPLE_NOW + HELD_MINUTES * 60_000).toISOString(),
    });
    expect(hhmmWib(Date.parse(held.heldUntil!))).toBe('10.47');
    await expect(t.transport.draftAction(BUDI_DRAFT_ID, { action: 'send' })).rejects.toMatchObject({
      status: 409,
      error: 'status_draf',
    });
    await expect(t.transport.draftAction(BUDI_DRAFT_ID, { action: 'edit', text: 'Baru' })).rejects.toMatchObject({
      error: 'status_draf',
    });

    await after(HELD_MINUTES * 60_000 - 1);
    // Aksi dari aplikasi ini juga disiarkan (ke koneksi lain), lalu perubahan karena waktu.
    // Event dan response membawa `rev` pesan pembawa kartu; perubahan berikutnya membawa `rev` yang lebih besar.
    expect(t.events).toEqual([{ type: 'draft', draft: held, rev: sendRes.rev }]);
    await after(1);
    expect(t.events).toEqual([
      { type: 'draft', draft: held, rev: sendRes.rev },
      { type: 'draft', draft: { ...held, status: 'sent' }, rev: sendRes.rev + 1 },
    ]);

    // Riwayat membawa keadaan draf yang terbaru.
    const card = (await t.transport.messages()).items.map(cardOf).find((c) => c?.kind === 'draft');
    expect(card).toMatchObject({ draft: { status: 'sent' } });
    await expect(t.transport.draftAction(BUDI_DRAFT_ID, { action: 'cancel' })).rejects.toMatchObject({
      error: 'status_draf',
    });
  });

  test('cancel hanya dari held; yang dibatalkan tidak pernah terkirim', async () => {
    const t = setup();
    t.listen();
    await expect(t.transport.draftAction(BUDI_DRAFT_ID, { action: 'cancel' })).rejects.toMatchObject({
      error: 'status_draf',
    });
    await t.transport.draftAction(BUDI_DRAFT_ID, { action: 'send' });
    await after(60_000);
    expect((await t.transport.draftAction(BUDI_DRAFT_ID, { action: 'cancel' })).draft).toMatchObject({
      status: 'cancelled',
    });
    await after(HELD_MINUTES * 60_000);
    // Hanya siaran `send` dan `cancel`; tidak ada `sent`.
    expect(t.events.map((e) => (e.type === 'draft' ? e.draft.status : e.type))).toEqual(['held', 'cancelled']);
  });

  test('edit dari draf, draf tidak dikenal, dan aksi tidak sah', async () => {
    const { transport } = setup();
    expect((await transport.draftAction(BUDI_DRAFT_ID, { action: 'edit', text: 'Teks baru' })).draft).toMatchObject({
      status: 'draft',
      text: 'Teks baru',
    });
    await expect(transport.draftAction('tidak-ada', { action: 'send' })).rejects.toMatchObject({
      status: 404,
      error: 'tidak_ditemukan',
    });
    await expect(transport.draftAction(BUDI_DRAFT_ID, { action: 'edit', text: '' })).rejects.toMatchObject({
      error: 'tidak_valid',
    });
  });

  test('draf baru dari "balas …" bisa dikirim', async () => {
    const t = setup();
    t.listen();
    const [reply] = await ask(t, 'Balas Pak Budi, siap');
    const card = cardOf(reply!);
    const id = card?.kind === 'draft' ? card.draft.id : '';
    expect((await t.transport.draftAction(id, { action: 'send' })).draft).toMatchObject({ status: 'held' });
  });
});

describe('putus sambung', () => {
  test('putus: request gagal, event terlewat; tersambung lagi: resync dan pesannya ada di riwayat', async () => {
    const t = setup();
    t.listen();
    t.transport.drop();
    expect(t.last()).toBe('connecting');
    await expect(t.transport.send({ kind: 'text', clientId: 'c1', text: 'Halo' })).rejects.toMatchObject({
      code: 'network',
    });
    const wa = t.transport.receive({ from: 'user', via: 'whatsapp', parts: [{ type: 'text', text: 'Dari WA' }] });
    expect(t.events).toEqual([]);

    expect(t.resyncs()).toBe(1); // pembukaan pertama
    t.transport.restore();
    expect(t.last()).toBe('open');
    expect(t.resyncs()).toBe(2);
    expect((await t.transport.messages()).items[0]).toEqual(wa);

    // Coba lagi dengan clientId yang sama setelah tersambung.
    expect(await t.transport.send({ kind: 'text', clientId: 'c1', text: 'Halo' })).toMatchObject({ clientId: 'c1' });
  });

  test('putus sebentar lalu tersambung sendiri', async () => {
    const t = setup();
    t.listen();
    t.transport.drop(5000);
    await after(4999);
    expect(t.last()).toBe('connecting');
    await after(1);
    expect(t.last()).toBe('open');
    // Seperti server asli: setiap kali terbuka (juga yang pertama), pesan yang mungkin terlewat diambil ulang.
    expect(t.resyncs()).toBe(2);
  });

  test('jawaban yang datang saat putus diambil lewat resync', async () => {
    const t = setup();
    t.listen();
    await t.transport.send({ kind: 'text', clientId: 'c1', text: 'Halo' });
    t.transport.drop();
    await after(THINK_MS);
    expect(t.events).toEqual([]);
    t.transport.restore();
    expect(t.resyncs()).toBe(2);
    expect(textOf((await t.transport.messages()).items[0]!)).toBe(SAMPLE_REPLY);
  });

  test('gagal sekali lalu berhasil', async () => {
    const { transport } = setup();
    transport.failNext('timeout');
    await expect(transport.send({ kind: 'text', clientId: 'c1', text: 'Halo' })).rejects.toMatchObject({
      code: 'timeout',
    });
    expect(await transport.send({ kind: 'text', clientId: 'c1', text: 'Halo' })).toMatchObject({ clientId: 'c1' });
  });

  test('pendengar terakhir pergi: stream tertutup; datang lagi: terbuka', () => {
    const t = setup();
    const stop = t.listen();
    stop();
    const seen: ConnectionStatus[] = [];
    t.transport.subscribe(
      () => {},
      (s) => seen.push(s),
    );
    expect(seen).toEqual(['closed', 'open']);
  });
});

test('pendaftaran token notifikasi hanya dicatat', async () => {
  const { transport } = setup();
  await transport.registerPushToken({ pushToken: 'ExponentPushToken[x]', platform: 'android' });
  expect(transport.registeredPushTokens).toEqual([{ pushToken: 'ExponentPushToken[x]', platform: 'android' }]);
  await expect(transport.registerPushToken({ pushToken: '', platform: 'android' })).rejects.toMatchObject({
    error: 'tidak_valid',
  });
});

test('pencabutan token notifikasi dicatat, tanpa perlu sesi, dan gagal saat putus', async () => {
  const { transport } = setup();
  await transport.unregisterPushToken({ pushToken: 'p1' });
  expect(transport.unregisteredPushTokens).toEqual(['p1']);
  await expect(transport.unregisterPushToken({ pushToken: '' })).rejects.toMatchObject({ error: 'tidak_valid' });
  transport.drop();
  await expect(transport.unregisterPushToken({ pushToken: 'p2' })).rejects.toMatchObject({ code: 'network' });
  expect(transport.unregisteredPushTokens).toEqual(['p1']);
});

test('riwayat contoh tidak berubah oleh transport', async () => {
  const before = sampleHistory();
  const { transport } = setup();
  await transport.draftAction(BUDI_DRAFT_ID, { action: 'edit', text: 'Teks baru' });
  expect(sampleHistory()).toEqual(before);
});

describe('rev yang dikenal', () => {
  test('berganti sesi (keluar lalu masuk) melupakan rev pengguna sebelumnya', async () => {
    const t = setup({ token: 't' });
    await t.transport.messages();
    const seen: (number | undefined)[] = [];
    const listen = () =>
      t.transport.subscribe(
        () => {},
        () => {},
        (rev) => seen.push(rev),
      );
    listen()();
    expect(seen[0]).toBeGreaterThan(0);
    await t.transport.logout();
    await t.transport.authStart({ phone: '6281220457781' });
    await t.transport.authVerify({ phone: '6281220457781', code: '123456' });
    seen.length = 0;
    listen()();
    expect(seen).toEqual([undefined]);
  });
});
