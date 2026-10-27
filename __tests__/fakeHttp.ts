import { API_PREFIX, type VoiceClientMessage, type VoiceEvent } from '@/api/contract';
import { FakeTransport, type FakeOptions } from '@/api/fake/FakeTransport';
import { HttpTransport, type SocketLike } from '@/api/http';
import { HybridTransport } from '@/api/hybrid';
import { createMemorySession, type Session } from '@/api/session';
import { ApiFailure, type FailureCode } from '@/api/transport';
import type { Api } from '@/api/ApiProvider';

/**
 * Server palsu di balik HTTP: `fetch` dan soket yang dipakai `HttpTransport` asli diarahkan ke `FakeTransport` sebagai
 * isi servernya. Jadi seluruh jalur klien (permintaan, header, pembacaan longgar, soket, sambung ulang, 401, 426) ikut
 * jalan di tes, sedangkan "otak" servernya tetap server tiruan yang sama dengan mode contoh.
 */

const FAILURE_DEFAULTS: Record<FailureCode, [number, string]> = {
  network: [503, 'jaringan'],
  timeout: [504, 'waktu_habis'],
  unauthorized: [401, 'tidak_masuk'],
  kode_salah: [400, 'kode_salah'],
  blocked: [403, 'diblokir'],
  not_registered: [404, 'belum_terdaftar'],
  pin_wrong: [403, 'pin_salah'],
  pin_cooldown: [423, 'pin_baru'],
  pin_required: [428, 'pin_diperlukan'],
  not_understood: [422, 'tidak_paham'],
  invalid_name: [400, 'nama_tidak_valid'],
  rate_limited: [429, 'terlalu_sering'],
  upgrade_required: [426, 'perlu_pembaruan'],
  not_supported: [400, 'tidak_didukung'],
  unavailable: [501, 'belum_tersedia'],
  server: [500, 'kendala'],
};

export interface LoggedRequest {
  method: string;
  /** Jalur setelah `/app/v1`, tanpa query. */
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
  status: number;
}

/** Soket sisi server: meneruskan event stream server tiruan sebagai pesan JSON. */
class ServerSocket implements SocketLike {
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data?: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: { code?: number }) => void) | null = null;
  closed = false;
  off: (() => void) | null = null;
  constructor(
    readonly url: string,
    readonly headers: Record<string, string>,
  ) {}
  close() {
    this.closed = true;
    this.off?.();
    this.off = null;
  }
  send() {}
}

/** Byte awal berkas MP3 (tanda ID3), cukup untuk tes: pemutar ditiru. */
export const FAKE_MP3_BASE64 = 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA';

/** Isi satu giliran Mode Suara server palsu: apa yang "terdengar" dan jawabannya. */
export interface VoiceTurnScript {
  transcript: string;
  reply: string;
  /** Suara balasan (MP3, satu potongan) ikut dikirim. Bawaan ya. */
  audio?: boolean;
  /** Ganti seluruh giliran dengan satu kode error (misalnya `stt_gagal`, `lama`). */
  error?: string;
}

/**
 * Soket `/voice` sisi server, meniru server asli (Fase 1b-mini): ucapan ditampung sampai `stop`, lalu `transcript`
 * final, `thinking on`, `reply` + `audio` (MP3 satu potongan), `thinking off`. Ucapan dan balasannya juga masuk utas
 * (bertanda suara), jadi muncul di chat lewat stream. Tanpa potongan audio: `tidak_terdengar`.
 */
class VoiceServerSocket implements SocketLike {
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data?: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: { code?: number }) => void) | null = null;
  closed = false;
  /** Pesan dari aplikasi, dari yang pertama. */
  received: VoiceClientMessage[] = [];
  private turn: string | null = null;
  private chunks = 0;
  constructor(
    readonly url: string,
    readonly headers: Record<string, string>,
    private readonly backend: FakeTransport,
    private readonly script: () => VoiceTurnScript,
    private readonly thinkMs: number,
  ) {}
  close() {
    this.closed = true;
  }
  send(data: string) {
    if (this.closed) return;
    const message = JSON.parse(data) as VoiceClientMessage;
    this.received.push(message);
    switch (message.type) {
      case 'start':
        this.turn = message.clientId;
        this.chunks = 0;
        return;
      case 'audio':
        this.chunks += 1;
        return;
      case 'stop':
        return this.respond(this.turn, this.chunks > 0 ? this.script().transcript : '');
      case 'text':
        return this.respond(message.clientId ?? null, message.text);
      case 'cancel':
        this.emit({ type: 'end', reason: 'cancelled', ...(this.turn ? { turn: this.turn } : {}) });
        this.turn = null;
        return;
    }
  }
  private emit(event: VoiceEvent) {
    if (!this.closed) this.onmessage?.({ data: JSON.stringify(event) });
  }
  private respond(turn: string | null, heard: string) {
    const t = turn ? { turn } : {};
    const script = this.script();
    if (!heard.trim()) {
      this.emit({ type: 'transcript', text: '', final: true, ...t });
      this.emit({ type: 'error', code: 'tidak_terdengar', ...t });
      return;
    }
    if (script.error) {
      this.emit({ type: 'transcript', text: heard, final: true, ...t });
      this.emit({ type: 'error', code: script.error, ...t });
      return;
    }
    this.emit({ type: 'transcript', text: heard, final: true, ...t });
    this.emit({ type: 'thinking', on: true, ...t });
    this.backend.receive({ from: 'user', via: 'app', voice: true, parts: [{ type: 'text', text: heard }] });
    setTimeout(() => {
      if (this.closed) return;
      const answer = this.backend.receive({
        from: 'assistant',
        via: 'app',
        voice: true,
        parts: [{ type: 'text', text: script.reply }],
      });
      this.emit({ type: 'reply', text: script.reply, messageId: answer.id, ...t });
      if (script.audio !== false) {
        this.emit({ type: 'audio', seq: 0, data: FAKE_MP3_BASE64, mime: 'audio/mpeg', final: true, ...t });
      }
      this.emit({ type: 'thinking', on: false, ...t });
    }, this.thinkMs);
  }
}

export interface FakeHttpOptions {
  /**
   * Sumber data aplikasi memakai mode `akun` (`HybridTransport` di atas `HttpTransport` yang sama): chat dan suara ke
   * server palsu ini, layar lain ke server tiruan di aplikasi (dengan pilihan ini bila berupa objek).
   */
  akun?: boolean | FakeOptions;
  /** Giliran Mode Suara di soket `/voice`. Bawaan: satu kalimat pengingat dan jawabannya. */
  voice?: () => VoiceTurnScript;
  /** Jeda dari `thinking on` sampai jawaban di soket `/voice`. Bawaan 1 detik. */
  voiceThinkMs?: number;
}

export const DEFAULT_VOICE_TURN: VoiceTurnScript = {
  transcript: 'Ingatkan saya rapat besok jam 9',
  reply: 'Siap, besok jam 9 saya ingatkan.',
};

export interface FakeHttpServer {
  /** Otak server: server tiruan yang sama dengan mode contoh. */
  backend: FakeTransport;
  /** Setiap permintaan HTTP yang sampai, dari yang pertama. */
  requests: LoggedRequest[];
  /** Soket stream yang pernah dibuka klien. */
  sockets: ServerSocket[];
  /** Soket Mode Suara yang pernah dibuka klien. */
  voiceSockets: VoiceServerSocket[];
  /** Transport asli ke server palsu ini (juga di dalam `api` mode akun). */
  http: HttpTransport;
  /** Mode akun: server tiruan di aplikasi untuk layar contoh. `null` di mode server. */
  sample: FakeTransport | null;
  /**
   * Sumber data mode akun yang baru (transport baru, sesi yang sama), seperti `createApi('akun')` setiap mode diganti:
   * untuk pembuat sumber data (`factory`) di tes ganti mode. Dilepas bersama server.
   */
  newAkunApi(): Api;
  /** Token yang sekarang sah, atau `null`. */
  token(): string | null;
  /** Sesi klien (memori) dan transport asli yang dipasang ke aplikasi. */
  api: Api;
  /** Cabut token: permintaan berikutnya dibalas 401 dan, kecuali `sockets: false`, soket ditutup 4401. */
  revoke(options?: { sockets?: boolean }): void;
  /** Semua permintaan dan jabat tangan soket dibalas 426. */
  requireUpgrade(on?: boolean): void;
  /** Masuk lebih dulu (tanpa layar), supaya tes bisa mulai dari sesi yang sudah ada. */
  signIn(phone?: string): Promise<string>;
  /** Permintaan yang sampai ke `method path`. */
  hits(method: string, path: string): LoggedRequest[];
  dispose(): void;
}

export function createFakeHttpServer(options: FakeOptions = {}, extra: FakeHttpOptions = {}): FakeHttpServer {
  const fake = options;
  const voiceSockets: VoiceServerSocket[] = [];
  const backendSession = createMemorySession(null);
  const backend = new FakeTransport(backendSession, { ...fake, requireSession: true, mode: 'server' });
  let valid: string | null = null;
  let upgrade = false;
  const requests: LoggedRequest[] = [];
  const sockets: ServerSocket[] = [];

  async function route(
    method: string,
    path: string,
    q: URLSearchParams,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const key = `${method} ${path}`;
    const seg = path.split('/').filter(Boolean);
    const id = seg[1] ? decodeURIComponent(seg[1]) : '';
    switch (true) {
      case key === 'POST /auth/start':
        return backend.authStart(body as never);
      case key === 'POST /auth/verify': {
        const res = await backend.authVerify(body as never);
        valid = res.token;
        return res;
      }
      case key === 'POST /auth/logout':
        valid = null;
        await backend.logout();
        return { ok: true };
      case key === 'GET /me':
        return backend.me();
      case key === 'GET /messages':
        return q.has('changedAfter')
          ? backend.messagesChanged(Number(q.get('changedAfter')))
          : backend.messages(q.has('before') ? Number(q.get('before')) : undefined);
      case key === 'POST /messages':
        return { message: await backend.send(body as never) };
      case method === 'POST' && seg[0] === 'drafts':
        return backend.draftAction(id, body as never);
      case key === 'POST /push-tokens':
        await backend.registerPushToken(body as never);
        return { ok: true };
      case key === 'DELETE /push-tokens':
        await backend.unregisterPushToken(body as never);
        return { ok: true };
      case key === 'GET /account/security':
        return backend.security();
      case key === 'PUT /account/security':
        return backend.setSecurity(body as never);
      case key === 'POST /account/pin':
        return backend.setPin(body as never);
      case key === 'POST /account/pin/verify':
        if (!(await backend.verifyPin(String(body.pin)))) {
          throw new ApiFailure('pin_wrong', { status: 403, error: 'pin_salah' });
        }
        return { ok: true };
      case key === 'GET /home':
        return backend.home();
      case key === 'PUT /places/current':
        return backend.setPlace(String(body.place));
      case key === 'GET /weather':
        return backend.weather(q.has('lat') ? { lat: Number(q.get('lat')), lon: Number(q.get('lon')) } : undefined);
      case key === 'GET /agenda':
        return backend.agenda(q.has('from') ? { from: q.get('from')!, to: q.get('to')! } : undefined);
      case key === 'POST /agenda/parse':
        return backend.agendaParse(String(body.text));
      case key === 'POST /agenda':
        return { item: await backend.agendaAdd(body.item as never) };
      case key === 'POST /agenda/leftover':
        return { item: await backend.agendaLeftover(body.choice as 'today' | 'drop') };
      case method === 'POST' && seg[0] === 'agenda' && seg[2] === 'alarm-ack':
        await backend.agendaAlarmAck(id, String(body.scheduledFor));
        return { ok: true };
      case method === 'GET' && seg[0] === 'agenda':
        return { item: await backend.agendaItem(id) };
      case method === 'PATCH' && seg[0] === 'agenda':
        return { item: await backend.agendaPatch(id, body as never) };
      case key === 'GET /devices':
        return backend.devices(q.get('place') ?? undefined);
      case method === 'PUT' && seg[0] === 'home' && seg[1] === 'devices' && seg[3] === 'favorite':
        return backend.setDeviceFavorite(decodeURIComponent(seg[2] ?? ''), (body as { favorite: boolean }).favorite);
      case method === 'POST' && seg[0] === 'home' && seg[1] === 'devices':
        return backend.controlDevice(decodeURIComponent(seg[2] ?? ''), body as never);
      case method === 'POST' && seg[0] === 'routines':
        return backend.runRoutine(id, body.place === undefined ? undefined : String(body.place));
      case key === 'PUT /box':
        return backend.setBoxMic(Boolean(body.micOn));
      case key === 'GET /business':
        return backend.business(q.get('place') ?? undefined, (q.get('period') as never) ?? undefined);
      case key === 'POST /business/reorder':
        return backend.businessReorder(String(body.stockId));
      case key === 'GET /connections':
        return backend.connections();
      case method === 'GET' && seg[0] === 'connections':
        return backend.connectionDetail(id);
      case method === 'PUT' && seg[0] === 'connections' && seg[2] === 'permission':
        return backend.setConnectionPermission(id, body as never);
      case method === 'POST' && seg[0] === 'connections' && seg[2] === 'forget':
        return backend.forgetConnection(id);
      case method === 'POST' && seg[0] === 'connections' && seg[2] === 'start':
        return backend.startConnection(id);
      case method === 'DELETE' && seg[0] === 'connections':
        await backend.disconnectConnection(id);
        return { ok: true };
      case key === 'GET /history':
        return backend.history({
          kind: (q.get('kind') as never) ?? undefined,
          before: q.get('before') ?? undefined,
          limit: q.has('limit') ? Number(q.get('limit')) : undefined,
        });
      case key === 'GET /account':
        return backend.account();
      case key === 'PUT /account/assistant':
        return backend.setAssistant(body as never);
      case key === 'PUT /account/greeting':
        return backend.setGreeting(body as never);
      case key === 'PUT /account/notifications':
        return backend.setNotifications(body as never);
      case method === 'DELETE' && seg[0] === 'account' && seg[1] === 'phones':
        return backend.removePhone(decodeURIComponent(seg[2] ?? ''));
      default:
        throw new ApiFailure('server', { status: 404, error: 'tidak_ada' });
    }
  }

  /** Pengganti `fetch`: memeriksa versi dan token, lalu menjalankan rutenya. */
  const fetchFn = async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.slice(API_PREFIX.length);
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    let status = 200;
    let payload: unknown;
    const open = path === '/auth/start' || path === '/auth/verify' || (method === 'DELETE' && path === '/push-tokens');
    if (upgrade) {
      status = 426;
      payload = { error: 'perlu_pembaruan' };
    } else if (!open && (valid === null || headers.Authorization !== `Bearer ${valid}`)) {
      status = 401;
      payload = { error: 'tidak_masuk' };
    } else {
      try {
        payload = await route(method, path, url.searchParams, body);
      } catch (e) {
        if (!(e instanceof ApiFailure)) throw e;
        const [defaultStatus, defaultError] = FAILURE_DEFAULTS[e.code];
        status = e.status ?? defaultStatus;
        payload = {
          error: e.error ?? defaultError,
          ...(e.retryInSec === undefined ? {} : { retryInSec: e.retryInSec }),
          ...(e.waNumber === undefined ? {} : { waNumber: e.waNumber }),
        };
      }
    }
    requests.push({ method, path, query: url.searchParams, headers, body: init?.body ? body : undefined, status });
    const text = payload === undefined ? '' : JSON.stringify(payload);
    return { status, ok: status >= 200 && status < 300, text: async () => text };
  };

  const voiceSocketFn = (url: string, headers: Record<string, string>): SocketLike => {
    const socket = new VoiceServerSocket(
      url,
      headers,
      backend,
      extra.voice ?? (() => DEFAULT_VOICE_TURN),
      extra.voiceThinkMs ?? 1000,
    );
    voiceSockets.push(socket);
    setTimeout(() => {
      if (socket.closed) return;
      if (upgrade) {
        socket.onerror?.({});
        socket.onclose?.({ code: 1006 });
        return;
      }
      if (valid === null || headers.Authorization !== `Bearer ${valid}`) {
        socket.onerror?.({});
        socket.onclose?.({ code: 4401 });
        return;
      }
      // Tanpa mesin pengenal ucapan (`features.voice` mati): seperti server asli, ditutup 4501.
      void backend.me().then((me) => {
        if (socket.closed) return;
        if (me.features?.voice === false) {
          socket.closed = true;
          socket.onclose?.({ code: 4501 });
          return;
        }
        socket.onopen?.({});
      });
    }, 0);
    return socket;
  };

  const socketFn = (url: string, headers: Record<string, string>): SocketLike => {
    if (url.endsWith('/voice')) return voiceSocketFn(url, headers);
    const socket = new ServerSocket(url, headers);
    sockets.push(socket);
    setTimeout(() => {
      if (socket.closed) return;
      if (upgrade) {
        // React Native melaporkan penolakan jabat tangan sebagai tutup biasa.
        socket.onerror?.({});
        socket.onclose?.({ code: 1006 });
        return;
      }
      if (valid === null || headers.Authorization !== `Bearer ${valid}`) {
        socket.onerror?.({});
        socket.onclose?.({ code: 4401 });
        return;
      }
      socket.onopen?.({});
      socket.off = backend.subscribe(
        (event) => socket.onmessage?.({ data: JSON.stringify(event) }),
        () => {},
        () => {},
      );
    }, 0);
    return socket;
  };

  const session: Session = createMemorySession(null);
  const httpTransport = () =>
    new HttpTransport('https://app.sekertaris.com', session, {
      fetch: fetchFn as unknown as typeof globalThis.fetch,
      socket: socketFn,
      random: () => 0.5,
      appVersion: '1.0.0',
    });
  const transport = httpTransport();
  const sampleOptions = (): FakeOptions => (typeof extra.akun === 'object' ? extra.akun : {});
  const created: Api[] = [];

  const sample =
    extra.akun === undefined || extra.akun === false
      ? null
      : new FakeTransport(createMemorySession(null), sampleOptions());
  const api: Api = sample
    ? { mode: 'akun', session, transport: new HybridTransport(transport, sample, session) }
    : { mode: 'server', session, transport };

  const server: FakeHttpServer = {
    backend,
    requests,
    sockets,
    voiceSockets,
    http: transport,
    sample,
    token: () => valid,
    api,
    revoke({ sockets: close = true } = {}) {
      valid = null;
      if (!close) return;
      for (const s of sockets) {
        if (s.closed) continue;
        s.off?.();
        s.off = null;
        s.onerror?.({});
        s.onclose?.({ code: 4401 });
      }
    },
    requireUpgrade(on = true) {
      upgrade = on;
    },
    async signIn(phone = '6281220457781') {
      await backend.authStart({ phone });
      const res = await backend.authVerify({ phone, code: '123456' });
      valid = res.token;
      await session.set(res.token);
      return res.token;
    },
    hits: (method, path) => requests.filter((r) => r.method === method && r.path === path),
    newAkunApi() {
      const fresh: Api = {
        mode: 'akun',
        session,
        transport: new HybridTransport(
          httpTransport(),
          new FakeTransport(createMemorySession(null), sampleOptions()),
          session,
        ),
      };
      created.push(fresh);
      return fresh;
    },
    dispose() {
      for (const a of created) a.transport.dispose();
      api.transport.dispose();
      transport.dispose();
      backend.dispose();
    },
  };
  return server;
}
