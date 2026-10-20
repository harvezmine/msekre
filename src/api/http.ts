import type { z } from 'zod';
import { backoffDelay } from './backoff';
import {
  API_PREFIX,
  apiErrorSchema,
  authStartResSchema,
  authVerifyResSchema,
  draftActionResSchema,
  meSchema,
  messagesPageSchema,
  MESSAGES_LIMIT,
  okResSchema,
  sendMessageResSchema,
  streamEventSchema,
  WS_CLOSE_UNAUTHORIZED,
  type AuthStartReq,
  type AuthStartRes,
  type AuthVerifyReq,
  type AuthVerifyRes,
  type DeviceRegisterReq,
  type Draft,
  type DraftActionReq,
  type Me,
  type Message,
  type MessagesPage,
  type SendMessageReq,
  type StreamEvent,
} from './contract';
import { StreamHub } from './hub';
import type { Session } from './session';
import { ApiFailure, type ConnectionStatus, type MediaSource, type Transport, type Unsubscribe } from './transport';

/** Batas waktu satu request HTTP, termasuk membaca isinya. */
export const REQUEST_TIMEOUT_MS = 15_000;
/** Tanpa pesan apa pun (server mengirim `ping` tiap 25 detik) selama ini, koneksi dianggap mati dan disambung ulang. */
export const STREAM_SILENCE_MS = 60_000;

/** Bagian WebSocket yang dipakai, supaya tes bisa memberi soket tiruan. */
export interface SocketLike {
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data?: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: { code?: number }) => void) | null;
  close(code?: number, reason?: string): void;
}

export interface HttpOptions {
  fetch?: typeof fetch;
  socket?: (url: string) => SocketLike;
  timeoutMs?: number;
  silenceMs?: number;
  /** 0..1, untuk goyangan jeda sambung ulang. */
  random?: () => number;
}

type Method = 'GET' | 'POST';

/** Transport ke server asli: HTTP `/app/v1/*` dan WebSocket `/app/v1/stream`. */
export class HttpTransport implements Transport {
  readonly mode = 'server' as const;
  private readonly base: string;
  private readonly fetchFn: typeof fetch;
  private readonly socketFn: (url: string) => SocketLike;
  private readonly timeoutMs: number;
  private readonly silenceMs: number;
  private readonly random: () => number;

  private readonly hub = new StreamHub({ start: () => this.startStream(), stop: () => this.closeStream() });
  private ws: SocketLike | null = null;
  /** Naik setiap koneksi dibuka atau ditutup, supaya langkah async yang sudah usang berhenti. */
  private generation = 0;
  private attempt = 0;
  /** Ada kemungkinan event terlewat (koneksi pernah putus atau gagal): setelah tersambung, minta resync. */
  private missed = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    baseUrl: string,
    private readonly session: Session,
    options: HttpOptions = {},
  ) {
    this.base = `${baseUrl.replace(/\/+$/, '')}${API_PREFIX}`;
    this.fetchFn = options.fetch ?? ((input, init) => fetch(input, init));
    this.socketFn = options.socket ?? ((url) => new WebSocket(url) as unknown as SocketLike);
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.silenceMs = options.silenceMs ?? STREAM_SILENCE_MS;
    this.random = options.random ?? Math.random;
  }

  // ---- HTTP ----

  authStart(req: AuthStartReq): Promise<AuthStartRes> {
    return this.request('POST', '/auth/start', authStartResSchema, { body: req, auth: false });
  }

  async authVerify(req: AuthVerifyReq): Promise<AuthVerifyRes> {
    const res = await this.request('POST', '/auth/verify', authVerifyResSchema, { body: req, auth: false });
    await this.session.set(res.token);
    if (this.hub.active && !this.ws) this.startStream();
    return res;
  }

  async logout(): Promise<void> {
    try {
      await this.request('POST', '/auth/logout', okResSchema, { body: {} });
    } catch {
      // Keluar tetap berhasil di HP walau server tidak terjangkau.
    } finally {
      await this.session.clear();
      this.closeStream();
    }
  }

  me(): Promise<Me> {
    return this.request('GET', '/me', meSchema);
  }

  messages(before?: string): Promise<MessagesPage> {
    const query = `limit=${MESSAGES_LIMIT}${before ? `&before=${encodeURIComponent(before)}` : ''}`;
    return this.request('GET', `/messages?${query}`, messagesPageSchema);
  }

  async send(req: SendMessageReq): Promise<Message> {
    return (await this.request('POST', '/messages', sendMessageResSchema, { body: req })).message;
  }

  async draftAction(id: string, req: DraftActionReq): Promise<Draft> {
    return (await this.request('POST', `/drafts/${encodeURIComponent(id)}`, draftActionResSchema, { body: req })).draft;
  }

  async registerDevice(req: DeviceRegisterReq): Promise<void> {
    await this.request('POST', '/devices', okResSchema, { body: req });
  }

  async mediaUrl(mediaId: string): Promise<MediaSource> {
    const token = await this.session.get();
    if (!token) throw new ApiFailure('unauthorized');
    return {
      kind: 'uri',
      uri: `${this.base}/media/${encodeURIComponent(mediaId)}`,
      headers: { Authorization: `Bearer ${token}` },
    };
  }

  dispose() {
    this.closeStream();
  }

  private async request<T>(
    method: Method,
    path: string,
    schema: z.ZodType<T>,
    { body, auth = true }: { body?: unknown; auth?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth) {
      const token = await this.session.get();
      if (!token) throw new ApiFailure('unauthorized');
      headers.Authorization = `Bearer ${token}`;
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ApiFailure('timeout'));
      }, this.timeoutMs);
    });
    let reply: { status: number; ok: boolean; data: unknown };
    try {
      const exchange = async () => {
        const res = await this.fetchFn(`${this.base}${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
        return { status: res.status, ok: res.ok, data: parseJson(await res.text()) };
      };
      reply = await Promise.race([exchange(), timeout]);
    } catch (e) {
      throw e instanceof ApiFailure ? e : new ApiFailure('network', { cause: e });
    } finally {
      clearTimeout(timer);
    }

    const { status, ok, data } = reply;
    if (status === 401) {
      await this.unauthorized();
      throw new ApiFailure('unauthorized', { status, error: errorCode(data) });
    }
    if (!ok) {
      const error = errorCode(data);
      throw new ApiFailure(error === 'kode_salah' ? 'kode_salah' : 'server', { status, error });
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new ApiFailure('server', { status, cause: parsed.error });
    return parsed.data;
  }

  private async unauthorized() {
    await this.session.clear();
    this.closeStream();
  }

  // ---- Stream ----

  subscribe(
    onEvent: (event: StreamEvent) => void,
    onStatus: (status: ConnectionStatus) => void,
    onResync?: () => void,
  ): Unsubscribe {
    return this.hub.add({ onEvent, onStatus, onResync });
  }

  private startStream() {
    this.attempt = 0;
    this.missed = false;
    void this.openSocket();
  }

  private async openSocket() {
    const generation = ++this.generation;
    this.clearTimers();
    this.hub.setStatus('connecting');
    const token = await this.session.get();
    if (generation !== this.generation || !this.hub.active) return;
    if (!token) {
      this.hub.setStatus('closed');
      return;
    }
    let ws: SocketLike;
    try {
      ws = this.socketFn(`${this.base.replace(/^http/, 'ws')}/stream?token=${encodeURIComponent(token)}`);
    } catch {
      this.retry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      if (ws !== this.ws) return;
      this.attempt = 0;
      this.hub.setStatus('open');
      this.armSilence();
      if (this.missed) {
        this.missed = false;
        this.hub.resync();
      }
    };
    ws.onmessage = (ev) => {
      if (ws !== this.ws) return;
      this.armSilence();
      const event = parseEvent(ev.data);
      // Event yang bentuknya tidak dikenal (rusak, atau dari kontrak yang lebih baru) dilewati.
      if (event && event.type !== 'ping') this.hub.emit(event);
    };
    ws.onerror = () => {
      // `onclose` selalu menyusul; penyambungan ulang diurus di sana.
    };
    ws.onclose = (ev) => {
      if (ws !== this.ws) return;
      this.ws = null;
      if (ev?.code === WS_CLOSE_UNAUTHORIZED) void this.unauthorized();
      else this.retry();
    };
  }

  /** Koneksi putus atau gagal: coba lagi setelah jeda bertingkat, selama masih ada yang mendengarkan. */
  private retry() {
    this.clearTimers();
    this.missed = true;
    if (!this.hub.active) return;
    this.hub.setStatus('connecting');
    const delay = backoffDelay(this.attempt, this.random);
    this.attempt += 1;
    this.retryTimer = setTimeout(() => void this.openSocket(), delay);
  }

  /** Server diam terlalu lama: soketnya dianggap mati walau belum ditutup oleh HP. */
  private armSilence() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      const ws = this.ws;
      if (!ws) return;
      this.ws = null;
      detach(ws);
      ws.close();
      this.retry();
    }, this.silenceMs);
  }

  /** Tutup koneksi tanpa menyambung ulang; pendengar tetap terdaftar dan menerima status `closed`. */
  private closeStream() {
    this.generation += 1;
    this.clearTimers();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      detach(ws);
      ws.close(1000);
    }
    this.hub.setStatus('closed');
  }

  private clearTimers() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.retryTimer = null;
    this.silenceTimer = null;
  }
}

function detach(ws: SocketLike) {
  ws.onopen = null;
  ws.onmessage = null;
  ws.onerror = null;
  ws.onclose = null;
}

/** Kode `error` dari isi jawaban gagal (`ApiError`). Kode yang belum dikenal tetap diteruskan untuk catatan. */
function errorCode(data: unknown): string | undefined {
  const parsed = apiErrorSchema.safeParse(data);
  if (parsed.success) return parsed.data.error;
  const raw = (data as { error?: unknown } | null | undefined)?.error;
  return typeof raw === 'string' ? raw : undefined;
}

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function parseEvent(data: unknown): StreamEvent | null {
  if (typeof data !== 'string') return null;
  const parsed = streamEventSchema.safeParse(parseJson(data));
  return parsed.success ? parsed.data : null;
}
