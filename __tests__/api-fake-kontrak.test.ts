import { HELD_MINUTES, messageSchema, streamEventSchema, type Message, type StreamEvent } from '@/api/contract';
import {
  FAKE_RESEND_SEC,
  FAKE_UNREGISTERED_SUFFIX,
  FAKE_WA_NUMBER,
  FakeTransport,
  type FakeOptions,
} from '@/api/fake/FakeTransport';
import { SAMPLE_FILE_MEDIA_ID } from '@/api/fake/history';
import { QRIS_MINUTES } from '@/api/fake/scenario';
import { createMemorySession } from '@/api/session';
import { applyThinking, isThinking, NO_RUNS } from '@/api/thinking';
import { THINK_MS } from '@/sample/chat';
import { BUDI_DRAFT_ID } from '@/sample/outgoing';

function setup(options: FakeOptions = {}) {
  const transport = new FakeTransport(createMemorySession(null), options);
  const events: StreamEvent[] = [];
  const lastRevs: (number | undefined)[] = [];
  const listen = () =>
    transport.subscribe(
      (e) => events.push(e),
      () => {},
      (lastRev) => lastRevs.push(lastRev),
    );
  return { transport, events, lastRevs, listen };
}

const after = (ms: number) => jest.advanceTimersByTimeAsync(ms);
const messagesOf = (events: StreamEvent[]) => events.flatMap((e) => (e.type === 'message' ? [e.message] : []));
const text = (clientId: string, t: string) => ({ kind: 'text' as const, clientId, text: t });

/** Minta token listrik dan kembalikan pesan kartu pembayaran (dengan pilihan). */
async function askToken(t: ReturnType<typeof setup>) {
  await t.transport.send(text(`c${t.events.length}`, 'beli token listrik 50 ribu'));
  await after(THINK_MS);
  return messagesOf(t.events)
    .filter((m) => m.from === 'assistant')
    .at(-1)!;
}

describe('seq dan halaman', () => {
  test('riwayat contoh punya seq naik; pesan baru melanjutkannya; upsert tidak mengubah seq', async () => {
    const t = setup();
    t.listen();
    const all = (await t.transport.messages()).items;
    const seqs = all.map((m) => m.seq).reverse();
    expect(seqs).toEqual(seqs.map((_, i) => i + 1));
    const saved = await t.transport.send(text('c1', 'Halo'));
    expect(saved.seq).toBe(seqs.length + 1);
    await after(THINK_MS);
    const reply = messagesOf(t.events).at(-1)!;
    expect(reply.rev).toBe(saved.seq + 1);
    for (const m of messagesOf(t.events)) expect(messageSchema.safeParse(m).success).toBe(true);
  });

  test('messagesChanged: terlama dulu, dibatasi, dengan more', async () => {
    const history: Message[] = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      seq: i + 1,
      rev: i + 1,
      at: '2026-10-20T03:42:00.000Z',
      from: 'user',
      via: 'app',
      parts: [{ type: 'text', text: `Pesan ${i}` }],
    }));
    const { transport } = setup({ history, afterLimit: 2 });
    const first = await transport.messagesChanged(1);
    expect(first.items.map((m) => m.id)).toEqual(['p1', 'p2']);
    expect(first.more).toBe(true);
    const last = await transport.messagesChanged(first.items.at(-1)!.rev);
    expect(last.items.map((m) => m.id)).toEqual(['p3', 'p4']);
    expect(last.more).toBe(false);
    expect(await transport.messagesChanged(5)).toEqual({ items: [], more: false });
    expect((await transport.messagesChanged(0)).items[0]!.id).toBe('p0');
  });

  test('resync pertama membawa rev terakhir yang dikenal dari halaman terbaru; setelah itu dari stream', async () => {
    const t = setup();
    const newest = (await t.transport.messages()).items[0]!;
    t.listen();
    expect(t.lastRevs).toEqual([newest.rev]);
    const reply = t.transport.receive({ from: 'assistant', via: 'app', parts: [{ type: 'text', text: 'Hai' }] });
    t.transport.drop();
    t.transport.restore();
    expect(t.lastRevs).toEqual([newest.rev, reply.rev]);
  });

  test('perubahan draf menaikkan rev pesan yang memuat kartunya', async () => {
    const t = setup();
    const before = (await t.transport.messages()).items.find((m) =>
      m.parts.some((p) => p.type === 'card' && p.card.kind === 'draft' && p.card.draft.id === BUDI_DRAFT_ID),
    )!;
    await t.transport.draftAction(BUDI_DRAFT_ID, { action: 'send' });
    const changed = await t.transport.messagesChanged(before.rev);
    expect(changed.items.map((m) => m.id)).toContain(before.id);
  });

  test('tanpa rev yang dikenal: resync membawa undefined', () => {
    const t = setup();
    t.listen();
    expect(t.lastRevs).toEqual([undefined]);
  });
});

describe('pilihan', () => {
  test('server mengambil judul dari pilihan tersimpan; pesan pilihan di-upsert dengan chosenId; seq tetap', async () => {
    const t = setup();
    t.listen();
    const pay = await askToken(t);
    const from = t.events.length;
    const saved = await t.transport.send({ kind: 'choice', clientId: 'c-ya', messageId: pay.id, choiceId: 'ya' });
    expect(saved.parts).toEqual([{ type: 'text', text: 'Ya, benar' }]);
    await after(0);
    const seen = t.events.slice(from);
    expect(seen.map((e) => e.type)).toEqual(['message', 'message', 'thinking']);
    const upsert = (seen[1] as { message: Message }).message;
    expect(upsert).toMatchObject({ id: pay.id, seq: pay.seq });
    expect(upsert.parts.find((p) => p.type === 'choices')).toMatchObject({ chosenId: 'ya' });
    expect(streamEventSchema.safeParse(seen[1]).success).toBe(true);

    const history = (await t.transport.messages()).items;
    expect(history.filter((m) => m.id === pay.id)).toHaveLength(1);
    expect(history.find((m) => m.id === pay.id)!.parts.find((p) => p.type === 'choices')).toMatchObject({
      chosenId: 'ya',
    });
  });

  test('pilihan tidak dikenal 400, pesan tidak dikenal 404, pilihan kedua 409; kirim ulang aman', async () => {
    const t = setup();
    t.listen();
    const pay = await askToken(t);
    await expect(
      t.transport.send({ kind: 'choice', clientId: 'x1', messageId: pay.id, choiceId: 'lain' }),
    ).rejects.toMatchObject({ status: 400, error: 'tidak_valid' });
    await expect(
      t.transport.send({ kind: 'choice', clientId: 'x2', messageId: 'tidak-ada', choiceId: 'ya' }),
    ).rejects.toMatchObject({ status: 404, error: 'tidak_ditemukan' });
    // Judul dari klien tidak diterima.
    await expect(
      t.transport.send({
        kind: 'choice',
        clientId: 'x3',
        messageId: pay.id,
        choiceId: 'ya',
        choiceTitle: 'Palsu',
      } as never),
    ).rejects.toMatchObject({ error: 'tidak_valid' });
    // Pesan teks tidak punya pilihan.
    const hist = (await t.transport.messages()).items.find((m) => m.from === 'user')!;
    await expect(
      t.transport.send({ kind: 'choice', clientId: 'x4', messageId: hist.id, choiceId: 'ya' }),
    ).rejects.toMatchObject({ error: 'tidak_valid' });

    const a = await t.transport.send({ kind: 'choice', clientId: 'ok', messageId: pay.id, choiceId: 'ya' });
    expect(await t.transport.send({ kind: 'choice', clientId: 'ok', messageId: pay.id, choiceId: 'ya' })).toEqual(a);
    await expect(
      t.transport.send({ kind: 'choice', clientId: 'lagi', messageId: pay.id, choiceId: 'batal' }),
    ).rejects.toMatchObject({ status: 409, error: 'sudah_dipilih' });
  });
});

describe('QRIS', () => {
  async function qris(t: ReturnType<typeof setup>) {
    const pay = await askToken(t);
    await t.transport.send({ kind: 'choice', clientId: 'ya', messageId: pay.id, choiceId: 'ya' });
    await after(THINK_MS);
    return messagesOf(t.events)
      .filter((m) => m.from === 'assistant')
      .at(-1)!;
  }
  const status = (m: Message) =>
    m.parts.flatMap((p) => (p.type === 'card' && p.card.kind === 'qris' ? [p.card.status] : []));

  test('menunggu dengan batas ISO; lunas lewat upsert dengan id dan seq yang sama', async () => {
    const t = setup();
    t.listen();
    const message = await qris(t);
    expect(status(message)).toEqual(['menunggu']);
    const card = message.parts.find((p) => p.type === 'card')!;
    if (card.type !== 'card' || card.card.kind !== 'qris') throw new Error('bukan QRIS');
    expect(Date.parse(card.card.until) - Date.parse(message.at)).toBe(QRIS_MINUTES * 60_000);

    const from = t.events.length;
    t.transport.payQris();
    const upsert = messagesOf(t.events.slice(from));
    expect(upsert).toHaveLength(1);
    expect(upsert[0]).toMatchObject({ id: message.id, seq: message.seq });
    expect(status(upsert[0]!)).toEqual(['lunas']);

    // Sudah lunas: tidak kedaluwarsa lagi, dan tidak ada yang bisa dibayar.
    await after(QRIS_MINUTES * 60_000);
    expect(messagesOf(t.events.slice(from))).toHaveLength(1);
    expect(t.transport.payQris(message.id)).toBeNull();
    const stored = (await t.transport.messages()).items.find((m) => m.id === message.id)!;
    expect(status(stored)).toEqual(['lunas']);
  });

  test('QRIS lunas saat koneksi putus: seq tetap, rev naik, dan resync mengantarnya', async () => {
    const t = setup();
    t.listen();
    const message = await qris(t);
    const known = (await t.transport.messages()).items.reduce((max, m) => Math.max(max, m.rev), 0);
    t.transport.drop();
    const from = t.events.length;
    t.transport.payQris(message.id);
    // Event selama putus hilang; hanya resync yang membawanya.
    expect(t.events.slice(from)).toHaveLength(0);
    t.transport.restore();
    const changed = await t.transport.messagesChanged(known);
    expect(changed.items.map((m) => m.id)).toEqual([message.id]);
    expect(changed.items[0]).toMatchObject({ seq: message.seq });
    expect(changed.items[0]!.rev).toBeGreaterThan(known);
    expect(changed.more).toBe(false);
    expect(status(changed.items[0]!)).toEqual(['lunas']);
  });

  test('kedaluwarsa saat batas lewat', async () => {
    const t = setup();
    t.listen();
    const message = await qris(t);
    const from = t.events.length;
    await after(QRIS_MINUTES * 60_000 - 1);
    expect(messagesOf(t.events.slice(from))).toHaveLength(0);
    await after(1);
    const upsert = messagesOf(t.events.slice(from));
    expect(upsert).toHaveLength(1);
    expect(upsert[0]).toMatchObject({ id: message.id, seq: message.seq });
    expect(status(upsert[0]!)).toEqual(['kedaluwarsa']);
    expect(t.transport.payQris(message.id)).toBeNull();
  });
});

describe('draf', () => {
  test('discard dari draft menjadi cancelled; dari held atau cancelled 409', async () => {
    const t = setup();
    t.listen();
    expect((await t.transport.draftAction(BUDI_DRAFT_ID, { action: 'discard' })).draft).toMatchObject({
      status: 'cancelled',
    });
    await expect(t.transport.draftAction(BUDI_DRAFT_ID, { action: 'discard' })).rejects.toMatchObject({ status: 409 });
    await expect(t.transport.draftAction(BUDI_DRAFT_ID, { action: 'send' })).rejects.toMatchObject({ status: 409 });
    await expect(t.transport.draftAction(BUDI_DRAFT_ID, { action: 'edit', text: 'X' })).rejects.toMatchObject({
      status: 409,
    });

    const held = setup();
    await held.transport.draftAction(BUDI_DRAFT_ID, { action: 'send' });
    await expect(held.transport.draftAction(BUDI_DRAFT_ID, { action: 'discard' })).rejects.toMatchObject({
      error: 'status_draf',
    });
  });

  test('failHeldSends: setelah masa tahan draf menjadi failed; hanya send ulang yang boleh', async () => {
    const t = setup();
    t.listen();
    t.transport.failHeldSends();
    const held = (await t.transport.draftAction(BUDI_DRAFT_ID, { action: 'send' })).draft;
    await after(HELD_MINUTES * 60_000);
    const drafts = t.events.flatMap((e) => (e.type === 'draft' ? [e.draft] : []));
    expect(drafts.map((d) => d.status)).toEqual(['held', 'failed']);
    expect(drafts[1]).toMatchObject({ id: held.id, heldUntil: held.heldUntil });
    const card = (await t.transport.messages()).items
      .flatMap((m) => m.parts)
      .find((p) => p.type === 'card' && p.card.kind === 'draft');
    expect(card).toMatchObject({ card: { draft: { status: 'failed' } } });
    await expect(t.transport.draftAction(BUDI_DRAFT_ID, { action: 'cancel' })).rejects.toMatchObject({ status: 409 });
    await expect(t.transport.draftAction(BUDI_DRAFT_ID, { action: 'discard' })).rejects.toMatchObject({ status: 409 });
    t.transport.failHeldSends(false);
    const again = (await t.transport.draftAction(BUDI_DRAFT_ID, { action: 'send' })).draft;
    expect(again).toMatchObject({ status: 'held' });
    await after(HELD_MINUTES * 60_000);
    expect(t.events.flatMap((e) => (e.type === 'draft' ? [e.draft.status] : []))).toEqual([
      'held',
      'failed',
      'held',
      'sent',
    ]);
  });
});

describe('runId', () => {
  test('tiap kiriman punya runId sendiri; berpikir = himpunan runId tidak kosong', async () => {
    const t = setup();
    t.listen();
    await t.transport.send(text('a', 'Halo'));
    await after(THINK_MS / 2);
    await t.transport.send(text('b', 'Halo lagi'));
    await after(0);
    const ons = t.events.flatMap((e) => (e.type === 'thinking' && e.on ? [e.runId] : []));
    expect(new Set(ons).size).toBe(2);

    // Dua proses berjalan bersamaan: setelah yang pertama selesai, masih berpikir.
    let runs = NO_RUNS;
    const trace: boolean[] = [];
    await after(THINK_MS * 2);
    for (const e of t.events) {
      runs = applyThinking(runs, e);
      if (e.type === 'thinking') trace.push(isThinking(runs));
    }
    expect(trace).toEqual([true, true, true, false]);
    for (const e of t.events) expect(streamEventSchema.safeParse(e).success).toBe(true);
  });
});

describe('paritas dengan server', () => {
  test('authStart nomor berakhiran 0000: 404 belum_terdaftar dengan nomor WhatsApp, tanpa kode dikirim', async () => {
    const { transport } = setup();
    expect(FAKE_UNREGISTERED_SUFFIX).toBe('0000');
    const e = await transport.authStart({ phone: '6281200000000' }).catch((x: unknown) => x);
    expect(e).toMatchObject({
      code: 'not_registered',
      status: 404,
      error: 'belum_terdaftar',
      waNumber: FAKE_WA_NUMBER,
    });
    // Tidak ada kode yang diminta, jadi masuk juga ditolak.
    await expect(transport.authVerify({ phone: '6281200000000', code: '123456' })).rejects.toMatchObject({
      code: 'kode_salah',
    });
    const quiet = setup({ waNumber: null });
    await expect(quiet.transport.authStart({ phone: '6281200000000' })).rejects.toMatchObject({
      code: 'not_registered',
      waNumber: undefined,
    });
  });

  test('keamanan: bawaan PIN mati dan belum ada PIN; hidupkan butuh PIN; ganti butuh PIN lama', async () => {
    const { transport } = setup();
    expect(await transport.security()).toEqual({ pinEnabled: false, hasPin: false });
    await expect(transport.setSecurity({ pinEnabled: true })).rejects.toMatchObject({ error: 'tidak_valid' });
    expect(await transport.verifyPin('123456')).toBe(false);
    expect(await transport.setPin({ pin: '123456' })).toEqual({ pinEnabled: false, hasPin: true });
    expect(await transport.setSecurity({ pinEnabled: true })).toEqual({ pinEnabled: true, hasPin: true });
    expect(await transport.verifyPin('123456')).toBe(true);
    expect(await transport.verifyPin('123450')).toBe(false);
    // Ganti: PIN lama wajib dan harus benar.
    await expect(transport.setPin({ pin: '654321' })).rejects.toMatchObject({ error: 'tidak_valid' });
    await expect(transport.setPin({ pin: '654321', currentPin: '000000' })).rejects.toMatchObject({
      code: 'pin_wrong',
      status: 403,
      error: 'pin_salah',
    });
    await transport.setPin({ pin: '654321', currentPin: '123456' });
    expect(await transport.verifyPin('654321')).toBe(true);
    expect(await transport.verifyPin('123456')).toBe(false);
    await expect(transport.verifyPin('12')).rejects.toMatchObject({ error: 'tidak_valid' });
  });

  test('keamanan awal dari opsi', async () => {
    const { transport } = setup({ security: { pinEnabled: true, pin: '111222' } });
    expect(await transport.security()).toEqual({ pinEnabled: true, hasPin: true });
    expect(await transport.verifyPin('111222')).toBe(true);
  });

  test('authStart diulang sebelum resendInSec: 429 terlalu_sering dengan sisa detik', async () => {
    const { transport } = setup();
    await transport.authStart({ phone: '628122045' });
    await after(20_000);
    const e = await transport.authStart({ phone: '628122045' }).catch((x: unknown) => x);
    expect(e).toMatchObject({
      code: 'rate_limited',
      status: 429,
      error: 'terlalu_sering',
      retryInSec: FAKE_RESEND_SEC - 20,
    });
    // Nomor lain tidak terpengaruh.
    await transport.authStart({ phone: '628122046' });
    await after((FAKE_RESEND_SEC - 20) * 1000);
    expect(await transport.authStart({ phone: '628122045' })).toEqual({ resendInSec: FAKE_RESEND_SEC });
  });

  test('authVerify tanpa authStart untuk nomor itu: kode_salah; kode terpakai sekali', async () => {
    const { transport } = setup();
    await expect(transport.authVerify({ phone: '628122045', code: '123456' })).rejects.toMatchObject({
      code: 'kode_salah',
      status: 400,
    });
    await transport.authStart({ phone: '628122046' });
    await expect(transport.authVerify({ phone: '628122045', code: '123456' })).rejects.toMatchObject({
      code: 'kode_salah',
    });
    await transport.authVerify({ phone: '628122046', code: '123456' });
    await expect(transport.authVerify({ phone: '628122046', code: '123456' })).rejects.toMatchObject({
      code: 'kode_salah',
    });
  });

  test('dispose menolak request yang masih menunggu', async () => {
    const { transport } = setup({ latencyMs: 300 });
    const pending = transport.me().catch((x: unknown) => x);
    const sending = transport.send(text('c1', 'Halo')).catch((x: unknown) => x);
    await after(100);
    transport.dispose();
    expect(await pending).toMatchObject({ code: 'network' });
    expect(await sending).toMatchObject({ code: 'network' });
  });

  test('dokumen contoh bisa dibuka lewat mediaUrl', async () => {
    const { transport } = setup();
    expect(await transport.mediaUrl(SAMPLE_FILE_MEDIA_ID)).toEqual({ kind: 'sampleFile' });
    expect(SAMPLE_FILE_MEDIA_ID).toBe('contoh-laporan');
  });

  test('kendali perangkat rumah: 501 belum_tersedia (Fase 3)', async () => {
    const { transport } = setup();
    await expect(transport.controlDevice('ac-kamar', { on: false })).rejects.toMatchObject({
      code: 'unavailable',
      status: 501,
      error: 'belum_tersedia',
    });
    await expect(transport.controlDevice('ac-kamar', {})).rejects.toMatchObject({ error: 'tidak_valid' });
  });
});
