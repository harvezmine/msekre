import { WS_CLOSE_IDLE, WS_CLOSE_UNAUTHORIZED, WS_CLOSE_VOICE_UNAVAILABLE } from '@/api/contract';
import { parseMessageLenient, parseVoiceEventLenient } from '@/api/lenient';
import { HttpTransport, type SocketLike } from '@/api/http';
import { createMemorySession } from '@/api/session';
import type { VoiceCloseReason } from '@/api/transport';
import type { Speaker, SpeechSource } from '@/voice/audio';
import {
  errorNote,
  IN_CHAT_TEXT,
  LATE_TEXT,
  NOT_HEARD_TEXT,
  OFFLINE_TEXT,
  RELEASE_TAIL_MS,
  SHORT_HOLD_TEXT,
  SIGNED_OUT_TEXT,
  SLOW_TURN_MS,
  SPEECH_GATHER_MS,
  SPEECH_WAIT_MS,
  STT_FAILED_TEXT,
  TURN_TIMEOUT_MS,
  VoiceController,
  type VoiceDeps,
  type VoiceTurnLog,
} from '@/voice/controller';
import { MAX_GAIN } from '@/voice/prep';
import { fromBase64, level, silentWav, toBase64, toVoiceFormat } from '@/voice/pcm';
import { ERROR_TEXT } from '@/api/errors';
import { VOICE_SOON_TEXT } from '@/voice/texts';
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

  test('end dengan alasan cancelled hanya pengakuan: soket tetap terbuka dan event sampai', async () => {
    const { sockets, transport } = setup();
    const voice = transport.openVoice();
    const reasons: VoiceCloseReason[] = [];
    const seen: unknown[] = [];
    voice.onClose((r) => reasons.push(r));
    voice.onEvent((e) => seen.push(e));
    await flush();
    sockets[0]!.onopen?.({});
    sockets[0]!.serve({ type: 'end', reason: 'cancelled', turn: 's-1' });
    expect(sockets[0]!.closedWith).toBeNull();
    expect(reasons).toEqual([]);
    expect(seen).toEqual([{ type: 'end', reason: 'cancelled', turn: 's-1' }]);
  });

  test('4501 belum tersedia dibaca sebagai unavailable', async () => {
    const { sockets, transport } = setup();
    const voice = transport.openVoice();
    const reasons: VoiceCloseReason[] = [];
    voice.onClose((r) => reasons.push(r));
    await flush();
    sockets[0]!.onopen?.({});
    sockets[0]!.drop(WS_CLOSE_VOICE_UNAVAILABLE);
    expect(reasons).toEqual(['unavailable']);
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
  function build(transportOverride?: VoiceDeps['transport'], extra: Partial<VoiceDeps> = {}) {
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
    const logs: VoiceTurnLog[] = [];
    const controller = new VoiceController({
      transport: transportOverride ?? transport,
      mic,
      speaker,
      haptic: jest.fn(),
      onLevel: (v) => levels.push(v),
      checkMic: async () => 'granted',
      requestMic: async () => 'granted',
      // Langsung dikirim saat dilepas; sisa rekaman 300 ms diuji tersendiri.
      tailMs: 0,
      log: (e) => logs.push(e),
      ...extra,
    });
    return { session, sockets, transport, controller, played, speaker, mic, levels, logs };
  }

  async function open(ctx: ReturnType<typeof build>) {
    ctx.controller.start();
    await flush();
    ctx.sockets[0]!.onopen?.({});
    return ctx.sockets[0]!;
  }

  const pcm = (n: number, rate = 16000, value = 12000) => ({
    data: new Int16Array(n).fill(value).buffer,
    sampleRate: rate,
    channels: 1,
  });

  /** Tahan, bicara `ms` (16 kHz), lepas. */
  async function say(ctx: ReturnType<typeof build>, ms = 500) {
    await ctx.controller.holdStart();
    ctx.controller.pushBuffer(pcm((ms / 1000) * 16000));
    await ctx.controller.holdEnd();
  }

  const types = (ws: FakeSocket) => ws.sent.map((m) => m.type);
  const clip = () => toBase64(silentWav(100));
  const startId = (ws: FakeSocket) => ws.sent.filter((m) => m.type === 'start').at(-1)!.clientId as string;
  const audioOf = (ws: FakeSocket) =>
    ws.sent.filter((m) => m.type === 'audio').map((m) => new Int16Array(fromBase64(m.data as string).buffer));

  test('ucapan dikirim sekaligus setelah dilepas: start (format 16 kHz mono PCM16), audio, stop; lalu balasan', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await ctx.controller.holdStart();
    // Selama menahan tidak ada yang dikirim: ketukan atau batal tidak pernah sampai ke server.
    expect(ws.sent).toEqual([]);
    // 48 kHz dicuplik ke 16 kHz: 5 × 100 ms menjadi 8000 contoh, 200 ms per potongan.
    for (let i = 0; i < 5; i++) ctx.controller.pushBuffer(pcm(4800, 48000));
    expect(ctx.levels.some((v) => v > 0)).toBe(true);
    await ctx.controller.holdEnd();
    expect(ws.sent[0]).toMatchObject({
      type: 'start',
      lang: 'id',
      format: { codec: 'pcm16', sampleRate: 16000, channels: 1 },
    });
    expect(typeof ws.sent[0]!.clientId).toBe('string');
    const chunks = ws.sent.filter((m) => m.type === 'audio');
    expect(chunks.map((c) => c.seq)).toEqual([0, 1, 2]);
    expect(audioOf(ws).map((a) => a.length)).toEqual([3200, 3200, 1600]);
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
    expect(ctx.logs.at(-1)).toMatchObject({ outcome: 'reply', heardMs: 500, speechMs: 500, rate: 48000, gain: 1 });
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

  test('suara balasan bukan alamat (contoh): hitungan ambilan turun, tidak menggantung di "berbicara"', async () => {
    const ctx = build();
    ctx.transport.mediaUrl = async () => ({ kind: 'sampleFile' });
    const ws = await open(ctx);
    ws.serve({ type: 'reply', text: 'Halo', messageId: 'm1' });
    ws.serve({ type: 'speech', mediaId: 'ucapan-1', mime: 'audio/mpeg' });
    await flush();
    expect(ctx.played).toHaveLength(0);
    expect(ctx.controller.getState().phase).toBe('idle');
  });

  test('menyela mengirim cancel ke server dan menghentikan suara', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.serve({ type: 'reply', text: 'Halo', messageId: 'm1' });
    await ctx.controller.holdStart();
    expect(ctx.speaker.stop).toHaveBeenCalled();
    expect(types(ws)).toEqual(['cancel']);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'listening', reply: null });
  });

  test('tahanan singkat (< 400 ms): tidak ada yang dikirim, petunjuk "Tahan sedikit lebih lama"', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await ctx.controller.holdStart();
    ctx.controller.pushBuffer(pcm(6000));
    await ctx.controller.holdEnd();
    expect(ws.sent).toEqual([]);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'idle', note: SHORT_HOLD_TEXT });
    expect(SHORT_HOLD_TEXT).toBe('Tahan sedikit lebih lama');
    expect(ctx.mic.stop).toHaveBeenCalledTimes(1);
    expect(ctx.logs.at(-1)).toMatchObject({ outcome: 'short', heardMs: 375 });
  });

  test('hening saja: tidak dikirim, "Belum terdengar jelas"', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await ctx.controller.holdStart();
    ctx.controller.pushBuffer(pcm(16000, 16000, 0));
    await ctx.controller.holdEnd();
    expect(ws.sent).toEqual([]);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'idle', note: NOT_HEARD_TEXT });
    expect(ctx.logs.at(-1)?.outcome).toBe('silent');
  });

  test('ucapan pelan dinaikkan kerasnya dan hening di ujungnya dipangkas sebelum dikirim', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await ctx.controller.holdStart();
    // 1 detik hening, 0,6 detik suara pelan (sekitar -36 dBFS), 1 detik hening.
    ctx.controller.pushBuffer(pcm(16000, 16000, 0));
    const quiet = new Int16Array(9600).map((_, i) => (i % 2 ? 520 : -520));
    ctx.controller.pushBuffer({ data: quiet.buffer, sampleRate: 16000, channels: 1 });
    ctx.controller.pushBuffer(pcm(16000, 16000, 0));
    await ctx.controller.holdEnd();
    const sent = audioOf(ws);
    const total = sent.reduce((n, a) => n + a.length, 0);
    // 0,6 detik suara + 240 ms sebelum + 360 ms sesudah, bukan 2,6 detik.
    expect(total).toBe(9600 + 3840 + 5760);
    const loudest = Math.max(...sent.map((a) => Math.max(...a.map(Math.abs))));
    expect(loudest).toBe(520 * MAX_GAIN);
    expect(ctx.logs).toHaveLength(0);
    ws.serve({ type: 'error', code: 'tidak_terdengar', turn: startId(ws) });
    expect(ctx.logs.at(-1)).toMatchObject({ outcome: 'tidak_terdengar', leadMs: 760, trailMs: 640, gain: MAX_GAIN });
  });

  test('sisa rekaman 300 ms setelah dilepas: suku kata terakhir ikut, lalu baru dikirim', async () => {
    const ctx = build(undefined, { tailMs: RELEASE_TAIL_MS });
    const ws = await open(ctx);
    await ctx.controller.holdStart();
    ctx.controller.pushBuffer(pcm(8000));
    await ctx.controller.holdEnd();
    // Sudah tampil "mengirim" (gelombang tenang), mikrofon masih menyala, belum ada yang dikirim.
    expect(ctx.controller.getState().phase).toBe('sending');
    expect(ctx.mic.stop).not.toHaveBeenCalled();
    expect(ws.sent).toEqual([]);
    ctx.controller.pushBuffer(pcm(3200));
    jest.advanceTimersByTime(RELEASE_TAIL_MS);
    expect(ctx.mic.stop).toHaveBeenCalledTimes(1);
    expect(audioOf(ws).reduce((n, a) => n + a.length, 0)).toBe(11200);
    expect(ws.sent.at(-1)).toEqual({ type: 'stop' });
  });

  test('menahan lagi saat sisa rekaman berjalan: tidak ada yang dikirim dari giliran itu', async () => {
    const ctx = build(undefined, { tailMs: RELEASE_TAIL_MS });
    const ws = await open(ctx);
    await say(ctx);
    await ctx.controller.holdStart();
    jest.advanceTimersByTime(RELEASE_TAIL_MS * 2);
    expect(types(ws)).not.toContain('start');
    expect(ctx.controller.getState().phase).toBe('listening');
  });

  test('geser untuk batal: mikrofon mati, tidak ada yang dikirim, tenang tanpa catatan', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await ctx.controller.holdStart();
    ctx.controller.pushBuffer(pcm(16000));
    ctx.controller.cancelHold();
    expect(ctx.controller.getState()).toMatchObject({ phase: 'idle', note: null });
    expect(ctx.mic.stop).toHaveBeenCalledTimes(1);
    await ctx.controller.holdEnd();
    jest.advanceTimersByTime(40_000);
    expect(ws.sent).toEqual([]);
    expect(ctx.logs.at(-1)?.outcome).toBe('cancelled');
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
    expect(ctx.controller.getState().phase).toBe('listening');
    ctx.sockets[1]!.onopen?.({});
    ctx.controller.pushBuffer(pcm(8000));
    await ctx.controller.holdEnd();
    expect(ctx.sockets[1]!.sent[0]).toMatchObject({ type: 'start' });
  });

  test('soket putus selagi menahan: rekaman jalan terus, ucapan dikirim lewat soket baru saat dilepas', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await ctx.controller.holdStart();
    ctx.controller.pushBuffer(pcm(4000));
    ws.drop(1006);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'listening', note: null });
    expect(ctx.mic.stop).not.toHaveBeenCalled();
    ctx.controller.pushBuffer(pcm(4000));
    await ctx.controller.holdEnd();
    await flush();
    expect(ctx.sockets).toHaveLength(2);
    ctx.sockets[1]!.onopen?.({});
    expect(types(ctx.sockets[1]!)).toEqual(['start', 'audio', 'audio', 'audio', 'stop']);
  });

  test('putus sebelum server menerima ucapan: dikirim ulang sekali (id sama, audio sama); putus lagi = tidak tersambung', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await say(ctx);
    const first = ws.sent.slice();
    ws.drop(1006);
    // Tetap menunggu dengan tenang; ucapan yang sama dikirim di soket baru.
    expect(ctx.controller.getState()).toMatchObject({ phase: 'sending', note: null });
    await flush();
    expect(ctx.sockets).toHaveLength(2);
    const again = ctx.sockets[1]!;
    again.onopen?.({});
    expect(again.sent).toEqual(first);
    // Kali kedua tidak dicoba lagi.
    again.drop(1006);
    await flush();
    expect(ctx.sockets).toHaveLength(2);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'off', note: OFFLINE_TEXT });
    expect(ctx.logs.at(-1)).toMatchObject({ outcome: 'offline', retried: true });
  });

  test('kirim ulang yang berhasil: balasan dari soket baru tampil', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ctx.controller.sendText('Nyalakan AC');
    const turn = ws.sent[0]!.clientId as string;
    ws.drop(WS_CLOSE_IDLE);
    await flush();
    const again = ctx.sockets[1]!;
    again.onopen?.({});
    expect(again.sent).toEqual([{ type: 'text', text: 'Nyalakan AC', clientId: turn }]);
    again.serve({ type: 'reply', text: 'Sudah nyala.', turn });
    expect(ctx.controller.getState()).toMatchObject({ phase: 'speaking', reply: 'Sudah nyala.' });
  });

  test('putus setelah server menerima ucapan: tidak dikirim ulang, jawabannya nanti di chat', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await say(ctx);
    const turn = startId(ws);
    ws.serve({ type: 'transcript', text: 'Matikan AC', final: true, turn });
    ws.serve({ type: 'thinking', on: true, turn });
    ws.drop(1006);
    await flush();
    expect(ctx.sockets).toHaveLength(1);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'idle', note: IN_CHAT_TEXT });
  });

  test('diam terlalu lama (4408): kembali siap tanpa kendala', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.drop(WS_CLOSE_IDLE);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'idle', note: null });
  });

  test('putus setelah balasan tampil: balasan tetap, tanpa kabar kendala', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await say(ctx);
    ws.serve({ type: 'reply', text: 'Sudah.', turn: startId(ws) });
    jest.advanceTimersByTime(SPEECH_WAIT_MS);
    ws.drop(1006);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'idle', reply: 'Sudah.', note: null });
  });

  test('error dari server yang tidak dikenal: kalimat kendala umum, tanpa kode', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.serve({ type: 'error', code: 'stt_down' });
    expect(ctx.controller.getState()).toMatchObject({ phase: 'error', note: ERROR_TEXT });
  });

  test.each([
    ['tidak_terdengar', NOT_HEARD_TEXT],
    ['stt_gagal', STT_FAILED_TEXT],
    ['lama', LATE_TEXT],
    ['tanpa_jawaban', LATE_TEXT],
    ['sudah_ada', IN_CHAT_TEXT],
  ])('error %s: kalimatnya sendiri, Inti tetap tenang (bukan "kendala")', async (code, text) => {
    const ctx = build();
    const ws = await open(ctx);
    await say(ctx);
    const turn = startId(ws);
    ws.serve({ type: 'transcript', text: '', final: true, turn });
    ws.serve({ type: 'error', code, turn });
    expect(ctx.controller.getState()).toMatchObject({ phase: 'idle', note: text });
    expect(text).not.toMatch(/kendala/);
    expect(ctx.logs.at(-1)).toMatchObject({ outcome: code });
  });

  test('kalimat per kode', () => {
    expect(NOT_HEARD_TEXT).toBe('Belum terdengar jelas, coba lebih dekat ke HP ya.');
    expect(STT_FAILED_TEXT).toBe('Suaranya belum bisa saya tangkap, coba sekali lagi ya.');
    expect(LATE_TEXT).toBe('Jawabannya lama, nanti saya kabari di chat.');
    expect(errorNote('apa_saja')).toEqual({ phase: 'error', note: ERROR_TEXT });
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

  test('ke latar: rekaman dan suara berhenti', async () => {
    const ctx = build();
    await open(ctx);
    await ctx.controller.holdStart();
    ctx.controller.suspend();
    expect(ctx.mic.stop).toHaveBeenCalled();
    expect(ctx.controller.getState().phase).toBe('idle');
  });

  test('sisa event dari giliran lama saat Inti ditahan lagi: diabaikan, mikrofon tetap merekam', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await ctx.controller.holdStart();
    ctx.controller.pushBuffer(pcm(1600));
    // Bertanda giliran lama, dan yang tanpa tanda sama sekali (bacaan longgar): tidak mengubah apa pun.
    ws.serve({ type: 'reply', text: 'Lama', messageId: 'x', turn: 'suara-lama' });
    ws.serve({ type: 'audio', seq: 0, data: clip(), mime: 'audio/wav', final: true, turn: 'suara-lama' });
    ws.serve({ type: 'reply', text: 'Tanpa giliran' });
    ws.serve({ type: 'audio', seq: 0, data: clip(), mime: 'audio/wav', final: true });
    ws.serve({ type: 'speech', mediaId: 'ucapan-1', mime: 'audio/mpeg' });
    ws.serve({ type: 'confirm', card: { kind: 'payment', title: 'T', amountRp: 1, lines: [], ask: 'Ya?' } });
    ws.serve({ type: 'transcript', text: 'ucapan lama', final: true });
    ws.serve({ type: 'thinking', on: true });
    ws.serve({ type: 'error', code: 'tidak_valid' });
    await flush();
    expect(ctx.controller.getState()).toMatchObject({ phase: 'listening', reply: null, confirm: null, transcript: '' });
    expect(ctx.played).toHaveLength(0);
    expect(ctx.mic.stop).not.toHaveBeenCalled();
    // Teks sementara (server yang mengenali ucapan sambil jalan) tetap tampil.
    ws.serve({ type: 'transcript', text: 'halo', final: false });
    expect(ctx.controller.getState().transcript).toBe('halo');
    ctx.controller.pushBuffer(pcm(8000));
    await ctx.controller.holdEnd();
    expect(ws.sent.at(-1)).toEqual({ type: 'stop' });
    expect(ctx.mic.stop).toHaveBeenCalledTimes(1);
  });

  test('event bertanda giliran lain dibuang setelah menyela; giliran yang berjalan diterima', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await say(ctx);
    const first = startId(ws);
    expect(ctx.controller.getState().phase).toBe('sending');
    await ctx.controller.holdStart();
    expect(types(ws).at(-1)).toBe('cancel');
    // Pengakuan batal giliran pertama tidak menyentuh keadaan, soket tetap terbuka.
    ws.serve({ type: 'end', reason: 'cancelled', turn: first });
    ws.serve({ type: 'error', code: 'stt_down', turn: first });
    expect(ws.closedWith).toBeNull();
    expect(ctx.controller.getState().phase).toBe('listening');
    ctx.controller.pushBuffer(pcm(8000));
    await ctx.controller.holdEnd();
    const second = startId(ws);
    expect(second).not.toBe(first);
    ws.serve({ type: 'reply', text: 'Dari yang pertama', turn: first });
    expect(ctx.controller.getState().reply).toBeNull();
    ws.serve({ type: 'reply', text: 'Baru', turn: second });
    expect(ctx.controller.getState().reply).toBe('Baru');
  });

  test('keluar dari mendengar mematikan mikrofon, cincin, dan batas 30 detik', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await ctx.controller.holdStart();
    ctx.controller.pushBuffer(pcm(1600));
    ctx.controller.suspend();
    expect(ctx.controller.getState().phase).toBe('idle');
    expect(ctx.mic.stop).toHaveBeenCalledTimes(1);
    expect(ctx.levels.at(-1)).toBe(0);
    const sent = ws.sent.length;
    jest.advanceTimersByTime(40_000);
    await flush();
    expect(ws.sent).toHaveLength(sent);
    expect(ctx.mic.stop).toHaveBeenCalledTimes(1);
  });

  test('ke latar saat balasan berjalan: suara berhenti, balasan terlambat dari giliran yang dibatalkan dibuang', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await say(ctx);
    const first = startId(ws);
    ctx.controller.suspend();
    expect(ws.sent.at(-1)).toEqual({ type: 'cancel' });
    expect(ctx.controller.getState().phase).toBe('idle');
    ws.serve({ type: 'reply', text: 'Terlambat', messageId: 'x', turn: first });
    expect(ctx.controller.getState()).toMatchObject({ phase: 'idle', reply: null });

    await say(ctx);
    ws.serve({ type: 'reply', text: 'Halo', messageId: 'm1', turn: startId(ws) });
    expect(ctx.controller.getState().phase).toBe('speaking');
    ctx.controller.suspend();
    expect(ctx.speaker.stop).toHaveBeenCalled();
    expect(ctx.controller.getState().phase).toBe('idle');
  });

  test('keadaan berubah sebelum stop dikirim', async () => {
    const ctx = build();
    const ws = await open(ctx);
    const phases: string[] = [];
    const send = ws.send.bind(ws);
    ws.send = (data: string) => {
      phases.push(`${(JSON.parse(data) as { type: string }).type}:${ctx.controller.getState().phase}`);
      send(data);
    };
    await say(ctx);
    expect(phases.at(-1)).toBe('stop:sending');
  });

  test('dua balasan: dua klip diantre berurutan, pengatur waktu balasan pertama dibersihkan', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.serve({ type: 'reply', text: 'Sebentar ya', messageId: 'm1' });
    ws.serve({ type: 'audio', seq: 0, data: clip(), mime: 'audio/wav', final: true });
    ws.serve({ type: 'reply', text: 'Ini jawabannya', messageId: 'm2' });
    ws.serve({ type: 'audio', seq: 0, data: clip(), mime: 'audio/wav', final: true });
    expect(ctx.played.map((p) => p.source.uri)).toEqual([
      expect.stringMatching(/balasan-1\.wav$/),
      expect.stringMatching(/balasan-2\.wav$/),
    ]);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'speaking', reply: 'Ini jawabannya' });
    // Menunggu lama: klip masih berjalan, jangan dianggap selesai.
    jest.advanceTimersByTime(SPEECH_WAIT_MS * 2);
    expect(ctx.controller.getState().phase).toBe('speaking');
    ctx.played[0]!.done();
    expect(ctx.controller.getState().phase).toBe('speaking');
    ctx.played[1]!.done();
    expect(ctx.controller.getState().phase).toBe('idle');
  });

  test('balasan kedua datang saat suara balasan pertama belum diputar: yang terkumpul diputar dulu', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.serve({ type: 'reply', text: 'Satu', messageId: 'm1' });
    ws.serve({ type: 'audio', seq: 0, data: clip(), mime: 'audio/wav' });
    expect(ctx.played).toHaveLength(0);
    ws.serve({ type: 'reply', text: 'Dua', messageId: 'm2' });
    expect(ctx.played).toHaveLength(1);
    ws.serve({ type: 'audio', seq: 0, data: clip(), mime: 'audio/wav', final: true });
    expect(ctx.played).toHaveLength(2);
  });

  test('end dan penutupan biasa: hanya mikrofon dihentikan, suara yang berjalan diselesaikan', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.serve({ type: 'reply', text: 'Halo', messageId: 'm1' });
    ws.serve({ type: 'audio', seq: 0, data: clip(), mime: 'audio/wav', final: true });
    ws.serve({ type: 'audio', seq: 1, data: clip(), mime: 'audio/wav' });
    jest.mocked(ctx.speaker.stop).mockClear();
    ws.serve({ type: 'end', reason: 'selesai' });
    // Potongan terakhir yang belum diputar ikut diputar; tidak ada yang dipotong.
    expect(ctx.speaker.stop).not.toHaveBeenCalled();
    expect(ctx.played).toHaveLength(2);
    expect(ctx.controller.getState().phase).toBe('speaking');
    ctx.played[0]!.done();
    expect(ctx.controller.getState().phase).toBe('speaking');
    ctx.played[1]!.done();
    expect(ctx.controller.getState().phase).toBe('idle');
  });

  test('end tanpa suara yang berjalan: langsung siap', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.serve({ type: 'reply', text: 'Halo', messageId: 'm1' });
    ws.serve({ type: 'end' });
    expect(ctx.controller.getState().phase).toBe('idle');
  });

  test('menunggu lama: "Masih saya kerjakan…" setelah 8 detik; thinking on yang diulang memperpanjang tunggu', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await say(ctx);
    const turn = startId(ws);
    jest.advanceTimersByTime(SLOW_TURN_MS - 1);
    expect(ctx.controller.getState().slow).toBe(false);
    jest.advanceTimersByTime(1);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'sending', slow: true });
    ws.serve({ type: 'thinking', on: true, turn });
    // Kabar tetap hidup dari server (`thinking on` diulang) tiap 30 detik: tetap menunggu jauh melewati 95 detik.
    for (let i = 0; i < 6; i++) {
      jest.advanceTimersByTime(30_000);
      ws.serve({ type: 'thinking', on: true, turn });
    }
    expect(ctx.controller.getState()).toMatchObject({ phase: 'thinking', slow: true, note: null });
    ws.serve({ type: 'reply', text: 'Selesai juga.', turn });
    expect(ctx.controller.getState()).toMatchObject({ phase: 'speaking', slow: false, reply: 'Selesai juga.' });
  });

  test('95 detik tanpa kabar: berhenti menunggu dengan tenang tanpa membatalkan; balasan terlambat tetap tampil', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await say(ctx);
    const turn = startId(ws);
    jest.advanceTimersByTime(TURN_TIMEOUT_MS - 1);
    expect(ctx.controller.getState().phase).toBe('sending');
    jest.advanceTimersByTime(1);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'idle', note: LATE_TEXT, slow: false });
    expect(types(ws)).not.toContain('cancel');
    expect(ctx.logs.at(-1)?.outcome).toBe('late');
    ws.serve({ type: 'reply', text: 'Maaf lama, sudah saya catat.', turn });
    expect(ctx.controller.getState()).toMatchObject({
      phase: 'speaking',
      reply: 'Maaf lama, sudah saya catat.',
      note: null,
    });
    // Giliran baru: sisa giliran lama dibuang.
    await ctx.controller.holdStart();
    ws.serve({ type: 'reply', text: 'Sisa', turn });
    expect(ctx.controller.getState()).toMatchObject({ phase: 'listening', reply: null });
  });

  test('batas tunggu juga berlaku saat berpikir (ketik), dan hilang begitu balasan datang', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ctx.controller.sendText('Halo');
    const turn = ws.sent.find((m) => m.type === 'text')!.clientId as string;
    expect(typeof turn).toBe('string');
    jest.advanceTimersByTime(TURN_TIMEOUT_MS - 1000);
    ws.serve({ type: 'reply', text: 'Halo juga', messageId: 'm1', turn });
    jest.advanceTimersByTime(TURN_TIMEOUT_MS);
    expect(ctx.controller.getState().note).toBeNull();
    expect(ctx.controller.getState().reply).toBe('Halo juga');

    ctx.controller.sendText('Lagi');
    jest.advanceTimersByTime(TURN_TIMEOUT_MS);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'idle', note: LATE_TEXT });
  });

  test('4501 belum tersedia: Inti mati dengan catatan segera hadir', async () => {
    const ctx = build();
    const ws = await open(ctx);
    ws.drop(WS_CLOSE_VOICE_UNAVAILABLE);
    expect(ctx.controller.getState()).toMatchObject({ phase: 'off', note: VOICE_SOON_TEXT });
    expect(VOICE_SOON_TEXT).toBe('Mode Suara segera hadir.');
  });

  test('pengakuan batal dari server tidak menutup soket', async () => {
    const ctx = build();
    const ws = await open(ctx);
    await say(ctx);
    const turn = startId(ws);
    ctx.controller.suspend();
    ws.serve({ type: 'end', reason: 'cancelled', turn });
    expect(ws.closedWith).toBeNull();
    await ctx.controller.holdStart();
    expect(ctx.sockets).toHaveLength(1);
    expect(ctx.controller.getState().phase).toBe('listening');
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

  test('parseVoiceEventLenient: reply tanpa messageId diterima, turn dibawa atau dibuang bila rusak', () => {
    expect(parseVoiceEventLenient({ type: 'reply', text: 'Halo' })).toEqual({ type: 'reply', text: 'Halo' });
    expect(parseVoiceEventLenient({ type: 'reply', text: 'Halo', turn: 's-1' })).toEqual({
      type: 'reply',
      text: 'Halo',
      turn: 's-1',
    });
    expect(parseVoiceEventLenient({ type: 'reply', text: 'Halo', turn: 5 })).toEqual({ type: 'reply', text: 'Halo' });
    expect(parseVoiceEventLenient({ type: 'transcript', text: 'a', turn: 's-1' })).toEqual({
      type: 'transcript',
      text: 'a',
      final: false,
      turn: 's-1',
    });
    expect(parseVoiceEventLenient({ type: 'end', reason: 'cancelled', turn: 's-1' })).toEqual({
      type: 'end',
      reason: 'cancelled',
      turn: 's-1',
    });
    expect(parseVoiceEventLenient({ type: 'confirm', card: { kind: 'baru' }, turn: 's-1' })).toEqual({
      type: 'error',
      code: 'kartu_tidak_dikenal',
      turn: 's-1',
    });
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
