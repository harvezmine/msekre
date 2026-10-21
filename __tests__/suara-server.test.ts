import { WS_CLOSE_IDLE, WS_CLOSE_UNAUTHORIZED } from '@/api/contract';
import { parseMessageLenient, parseVoiceEventLenient } from '@/api/lenient';
import { HttpTransport, type SocketLike } from '@/api/http';
import { createMemorySession } from '@/api/session';
import type { VoiceCloseReason } from '@/api/transport';
import type { Speaker, SpeechSource } from '@/voice/audio';
import {
  HINT_HOLD,
  OFFLINE_TEXT,
  SIGNED_OUT_TEXT,
  SPEECH_GATHER_MS,
  SPEECH_WAIT_MS,
  VoiceController,
  type VoiceDeps,
} from '@/voice/controller';
import { fromBase64, level, silentWav, toBase64, toVoiceFormat } from '@/voice/pcm';
import { ERROR_TEXT } from '@/api/errors';
import { audio } from './audioMock';

const BASE = 'https://app.sekertaris.com';

class FakeSocket implements SocketLike {
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data?: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: { code?: number }) => void) | null = null;
  closedWith: number | null = null;
  sent: Record<string, unknown>[] = [];
  constructor(
    readonly url: string,
    readonly headers: Record<string, string>,
  ) {}
  close(code = 1000) {
    this.closedWith = code;
  }
  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  serve(event: unknown) {
    this.onmessage?.({ data: typeof event === 'string' ? event : JSON.stringify(event) });
  }
  drop(code: number) {
    this.onclose?.({ code });
  }
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function setup(token: string | null = 'tok') {
  const session = createMemorySession(token);
  const sockets: FakeSocket[] = [];
  const transport = new HttpTransport(BASE, session, {
    fetch: (async () => {
      throw new Error('tidak dipakai');
    }) as unknown as typeof fetch,
    socket: (url, headers) => {
      const s = new FakeSocket(url, headers);
      sockets.push(s);
      return s;
    },
    appVersion: '1.2.3',
  });
  return { session, sockets, transport };
}

beforeEach(() => audio.reset());

describe('HttpTransport.openVoice', () => {
  test('soket /voice dengan header yang sama seperti /stream; pesan diantre sampai terbuka', async () => {
    const { sockets, transport } = setup();
    const voice = transport.openVoice();
    voice.send({ type: 'text', text: 'halo' });
    await flush();
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.url).toBe('wss://app.sekertaris.com/app/v1/voice');
    expect(sockets[0]!.headers).toMatchObject({ Authorization: 'Bearer tok', 'X-App-Version': '1.2.3' });
    expect(sockets[0]!.headers['X-Contract-Version']).toBeDefined();
    expect(sockets[0]!.sent).toEqual([]);
    sockets[0]!.onopen?.({});
    expect(sockets[0]!.sent).toEqual([{ type: 'text', text: 'halo' }]);
    voice.send({ type: 'stop' });
    expect(sockets[0]!.sent.at(-1)).toEqual({ type: 'stop' });
  });

  test('event dibaca longgar: tanpa final dianggap sementara, jenis asing dan ping dilewati', async () => {
    const { sockets, transport } = setup();
    const voice = transport.openVoice();
    const seen: unknown[] = [];
    voice.onEvent((e) => seen.push(e));
    await flush();
    const s = sockets[0]!;
    s.onopen?.({});
    s.serve({ type: 'transcript', text: 'halo' });
    s.serve({ type: 'ping' });
    s.serve({ type: 'dari-masa-depan' });
    s.serve('bukan json');
    s.serve({ type: 'thinking', on: true });
    expect(seen).toEqual([
      { type: 'transcript', text: 'halo', final: false },
      { type: 'thinking', on: true },
    ]);
  });

  test('end menutup soket dengan baik', async () => {
    const { sockets, transport } = setup();
    const voice = transport.openVoice();
    const reasons: VoiceCloseReason[] = [];
    voice.onClose((r) => reasons.push(r));
    await flush();
    sockets[0]!.onopen?.({});
    sockets[0]!.serve({ type: 'end', reason: 'selesai' });
    expect(sockets[0]!.closedWith).toBe(1000);
    expect(reasons).toEqual(['ended']);
  });

  test('close dari aplikasi menutup soket tanpa memanggil onClose', async () => {
    const { sockets, transport } = setup();
    const voice = transport.openVoice();
    const reasons: VoiceCloseReason[] = [];
    voice.onClose((r) => reasons.push(r));
    await flush();
    sockets[0]!.onopen?.({});
    voice.close();
    expect(sockets[0]!.closedWith).toBe(1000);
    expect(reasons).toEqual([]);
    voice.send({ type: 'stop' });
    expect(sockets[0]!.sent).toEqual([]);
  });

  test('4401 menghapus sesi, 4408 diam terlalu lama, putus biasa = jaringan', async () => {
    const a = setup();
    const va = a.transport.openVoice();
    const ra: VoiceCloseReason[] = [];
    va.onClose((r) => ra.push(r));
    await flush();
    a.sockets[0]!.onopen?.({});
    a.sockets[0]!.drop(WS_CLOSE_UNAUTHORIZED);
    await flush();
    expect(ra).toEqual(['unauthorized']);
    expect(await a.session.get()).toBeNull();

    const b = setup();
    const vb = b.transport.openVoice();
    const rb: VoiceCloseReason[] = [];
    vb.onClose((r) => rb.push(r));
    await flush();
    b.sockets[0]!.onopen?.({});
    b.sockets[0]!.drop(WS_CLOSE_IDLE);
    expect(rb).toEqual(['idle']);
    expect(await b.session.get()).toBe('tok');

    const c = setup();
    const vc = c.transport.openVoice();
    const rc: VoiceCloseReason[] = [];
    vc.onClose((r) => rc.push(r));
    await flush();
    c.sockets[0]!.drop(1006);
    expect(rc).toEqual(['network']);
  });

  test('tanpa sesi: langsung unauthorized, tanpa membuka soket', async () => {
    const { sockets, transport } = setup(null);
    const voice = transport.openVoice();
    const reasons: VoiceCloseReason[] = [];
    voice.onClose((r) => reasons.push(r));
    await flush();
    expect(sockets).toHaveLength(0);
    expect(reasons).toEqual(['unauthorized']);
  });
});

describe('VoiceController dengan HttpTransport', () => {
  function build(transportOverride?: VoiceDeps['transport']) {
    const { session, sockets, transport } = setup();
    const played: { source: SpeechSource; done: () => void }[] = [];
    const speaker: Speaker = {
      play: jest.fn((source, done) => {
        played.push({ source, done });
      }),
      stop: jest.fn(),
    };
    const mic = { start: jest.fn(async () => {}), stop: jest.fn() };
    const levels: number[] = [];
    const controller = new VoiceController({
      transport: transportOverride ?? transport,
      mic,
      speaker,
      haptic: jest.fn(),
      onLevel: (v) => levels.push(v),
      checkMic: async () => 'granted',
      requestMic: async () => 'granted',
    });
    return { session, sockets, transport, controller, played, speaker, mic, levels };
  }

  async function open(ctx: ReturnType<typeof build>) {
    ctx.controller.start();
    await flush();
    ctx.sockets[0]!.onopen?.({});
    return ctx.sockets[0]!;
  }

  const pcm = (n: number, rate = 16000) => ({
    data: new Int16Array(n).fill(12000).buffer,
    sampleRate: rate,
    channels: 1,
  });

  test('start, potongan audio PCM 16 kHz, stop, lalu balasan sampai idle', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await ctx.controller.holdStart();
    expect(ws.sent[0]).toMatchObject({
      type: 'start',
      lang: 'id',
      format: { codec: 'pcm16', sampleRate: 16000, channels: 1 },
    });
    expect(typeof ws.sent[0]!.clientId).toBe('string');
    // 48 kHz dicuplik ke 16 kHz: 4800 contoh menjadi 1600.
    for (let i = 0; i < 5; i++) ctx.controller.pushBuffer(pcm(4800, 48000));
    const chunks = ws.sent.filter((m) => m.type === 'audio');
    expect(chunks.map((c) => c.seq)).toEqual([0, 1, 2, 3, 4]);
    expect(fromBase64(chunks[0]!.data as string)).toHaveLength(3200);
    expect(ctx.levels.some((v) => v > 0)).toBe(true);
    await ctx.controller.holdEnd();
    expect(ws.sent.at(-1)).toEqual({ type: 'stop' });
    expect(ctx.controller.getState().phase).toBe('sending');
    expect(ctx.levels.at(-1)).toBe(0);

    ws.serve({ type: 'transcript', text: 'Matikan AC kamar', final: true });
    ws.serve({ type: 'thinking', on: true });
    expect(ctx.controller.getState()).toMatchObject({
      phase: 'thinking',
      transcript: 'Matikan AC kamar',
      transcriptFinal: true,
    });
    ws.serve({ type: 'thinking', on: false });
    ws.serve({ type: 'reply', text: 'Sudah.', messageId: 'm9' });
    expect(ctx.controller.getState()).toMatchObject({ phase: 'speaking', reply: 'Sudah.' });
    // Tanpa suara apa pun, kembali siap setelah menunggu.
    jest.advanceTimersByTime(SPEECH_WAIT_MS);
    expect(ctx.controller.getState().phase).toBe('idle');
  });

  test('suara balasan: potongan tanpa tanda terakhir diputar setelah sepi; speech lewat media dengan token', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.serve({ type: 'reply', text: 'Halo', messageId: 'm1' });
    const wav = toBase64(silentWav(100));
    ws.serve({ type: 'audio', seq: 0, data: wav, mime: 'audio/wav' });
    expect(ctx.played).toHaveLength(0);
    jest.advanceTimersByTime(SPEECH_GATHER_MS);
    expect(ctx.played).toHaveLength(1);
    expect(ctx.played[0]!.source.uri).toMatch(/suara\/balasan-1\.wav$/);
    ctx.played[0]!.done();
    expect(ctx.controller.getState().phase).toBe('idle');

    ws.serve({ type: 'reply', text: 'Lagi', messageId: 'm2' });
    ws.serve({ type: 'speech', mediaId: 'ucapan-7', mime: 'audio/mpeg' });
    await flush();
    expect(ctx.played).toHaveLength(2);
    expect(ctx.played[1]!.source).toEqual({
      uri: `${BASE}/app/v1/media/ucapan-7`,
      headers: { Authorization: 'Bearer tok' },
    });
  });

  test('menyela mengirim cancel ke server dan menghentikan suara', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.serve({ type: 'reply', text: 'Halo', messageId: 'm1' });
    await ctx.controller.holdStart();
    expect(ctx.speaker.stop).toHaveBeenCalled();
    expect(ws.sent.map((m) => m.type)).toEqual(['cancel', 'start']);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'listening', reply: null });
  });

  test('ketukan singkat: cancel dan petunjuk', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await ctx.controller.holdStart();
    ctx.controller.pushBuffer(pcm(800));
    await ctx.controller.holdEnd();
    expect(ws.sent.map((m) => m.type)).toEqual(['start', 'audio', 'cancel']);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'idle', note: HINT_HOLD });
  });

  test('batas 30 detik: berhenti sendiri dan mengirim', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await ctx.controller.holdStart();
    ctx.controller.pushBuffer(pcm(8000));
    jest.advanceTimersByTime(30_000);
    await flush();
    expect(ws.sent.at(-1)).toEqual({ type: 'stop' });
    expect(ctx.mic.stop).toHaveBeenCalled();
  });

  test('4401: Inti mati dan sesi akun hilang', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.drop(WS_CLOSE_UNAUTHORIZED);
    await flush();
    expect(ctx.controller.getState()).toMatchObject({ phase: 'off', note: SIGNED_OUT_TEXT });
    expect(await ctx.session.get()).toBeNull();
  });

  test('putus: off; Inti ditahan lagi membuka sesi baru', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.drop(1006);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'off', note: OFFLINE_TEXT });
    await ctx.controller.holdStart();
    await flush();
    expect(ctx.sockets).toHaveLength(2);
    ctx.sockets[1]!.onopen?.({});
    expect(ctx.sockets[1]!.sent[0]).toMatchObject({ type: 'start' });
    expect(ctx.controller.getState().phase).toBe('listening');
  });

  test('diam terlalu lama (4408): kembali siap tanpa kendala', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.drop(WS_CLOSE_IDLE);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'idle', note: null });
  });

  test('error dari server: kalimat ramah tanpa kode', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.serve({ type: 'error', code: 'stt_down' });
    expect(ctx.controller.getState()).toMatchObject({ phase: 'error', note: ERROR_TEXT });
  });

  test('kartu konfirmasi yang tidak terbaca: arahkan ke chat, bukan diam', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.serve({ type: 'confirm', card: { kind: 'baru-sekali' } });
    expect(ctx.controller.getState().note).toMatch(/chat/);
    expect(ctx.controller.getState().confirm).toBeNull();
  });

  test('confirm yang sah disimpan sampai diketuk', async () => {
    const ctx = build();
    const ws = await open(ctx);
    const card = {
      kind: 'payment',
      title: 'Token listrik PLN',
      amountRp: 100000,
      lines: [],
      ask: 'Sudah benar?',
    };
    ws.serve({ type: 'confirm', card, messageId: 'm5' });
    expect(ctx.controller.getState().confirm).toEqual({ card, messageId: 'm5' });
    ctx.controller.dismissConfirm();
    expect(ctx.controller.getState().confirm).toBeNull();
  });

  test('ke latar: rekaman dan suara berhenti, server diminta berhenti', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await ctx.controller.holdStart();
    ctx.controller.suspend();
    expect(ctx.mic.stop).toHaveBeenCalled();
    expect(ws.sent.at(-1)).toEqual({ type: 'cancel' });
    expect(ctx.controller.getState().phase).toBe('idle');
  });

  test('dispose menutup soket', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ctx.controller.dispose();
    expect(ws.closedWith).toBe(1000);
  });
});

describe('bacaan dan perkakas', () => {
  test('parseVoiceEventLenient', () => {
    expect(parseVoiceEventLenient(null)).toBeNull();
    expect(parseVoiceEventLenient({ type: 'reply', text: '', messageId: 'x' })).toBeNull();
    expect(parseVoiceEventLenient({ type: 'audio', seq: 0, data: 'AAAA', mime: 'image/png' })).toBeNull();
    expect(parseVoiceEventLenient({ type: 'end' })).toEqual({ type: 'end' });
    expect(parseVoiceEventLenient({ type: 'error', code: 'x' })).toEqual({ type: 'error', code: 'x' });
  });

  test('pesan bertanda suara dibaca, juga lewat jalur longgar', () => {
    const base = {
      id: 'm1',
      seq: 1,
      rev: 1,
      at: '2026-10-21T03:42:00.000Z',
      from: 'assistant',
      via: 'app',
      voice: true,
      parts: [{ type: 'text', text: 'Halo' }],
    };
    expect(parseMessageLenient(base)?.voice).toBe(true);
    expect(parseMessageLenient({ ...base, parts: [{ type: 'baru' }] })?.voice).toBe(true);
    expect(parseMessageLenient({ ...base, voice: undefined })?.voice).toBeUndefined();
  });

  test('base64 bolak-balik, cuplik ulang, dan keras-pelan', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 255]);
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes]);
    expect(toVoiceFormat(new Int16Array(4410).buffer, 44100, 1)).toHaveLength(1600);
    const stereo = new Int16Array([5, 100, 6, 100, 7, 100]);
    expect([...toVoiceFormat(stereo.buffer, 16000, 2)]).toEqual([5, 6, 7]);
    expect(level(new Int16Array(100))).toBe(0);
    expect(level(new Int16Array(100).fill(30000))).toBe(1);
    expect(silentWav(100).length).toBe(44 + 800);
  });
});
