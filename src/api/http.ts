import { backoffDelay } from './backoff';
import {
  agendaItemResSchema,
  agendaLeftoverResSchema,
  agendaParseResSchema,
  API_PREFIX,
  apiErrorSchema,
  APP_VERSION_HEADER,
  authStartResSchema,
  authVerifyResSchema,
  CONTRACT_VERSION,
  CONTRACT_VERSION_HEADER,
  deviceControlResSchema,
  meSchema,
  MESSAGES_LIMIT,
  MESSAGES_LIMIT_MAX,
  okResSchema,
  securityResSchema,
  waNumberSchema,
  WS_CLOSE_UNAUTHORIZED,
  type AgendaItem,
  type AgendaNew,
  type AgendaParseRes,
  type AgendaPatchReq,
  type AgendaRes,
  type AuthStartReq,
  type AuthStartRes,
  type AuthVerifyReq,
  type AuthVerifyRes,
  type DeviceCard,
  type DeviceControlReq,
  type DraftActionReq,
  type DraftActionRes,
  type Home,
  type Me,
  type Message,
  type MessagesPage,
  type MessagesChangedPage,
  type PinSetReq,
  type PushTokenDeleteReq,
  type PushTokenReq,
  type SecurityRes,
  type SecurityUpdateReq,
  type SendMessageReq,
  type StreamEvent,
} from './contract';
import {
  parseChangedPageLenient,
  parseDraftResLenient,
  parseEventLenient,
  parseAgendaLenient,
  parseHomeLenient,
  parseMessageLenient,
  parsePageLenient,
} from './lenient';
import { StreamHub } from './hub';
import type { Session } from './session';
import { ApiFailure, type ConnectionStatus, type MediaSource, type Transport, type Unsubscribe } from './transport';
import { appVersion } from './version';

/** Batas waktu satu request HTTP, termasuk membaca isinya. */
export const REQUEST_TIMEOUT_MS = 15_000;
/** Soket yang tidak kunjung terbuka selama ini dianggap macet dan dicoba lagi dengan jeda bertingkat. */
export const CONNECT_TIMEOUT_MS = 15_000;
/** Tanpa pesan apa pun (server mengirim `ping` tiap 25 detik) selama ini, koneksi dianggap mati dan disambung ulang. */
export const STREAM_SILENCE_MS = 60_000;

/** Gagal terbuka sebanyak ini berturut-turut: tanya `GET /me` apakah penyebabnya akun diblokir atau versi terlalu lama. */
export const FAILED_OPENS_BEFORE_PROBE = 3;

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
  /** Membuat soket ke `url` dengan `headers` jabat tangan (token ada di `Authorization`, bukan di URL). */
  socket?: (url: string, headers: Record<string, string>) => SocketLike;
  timeoutMs?: number;
  connectTimeoutMs?: number;
  /** Isi header `X-App-Version`. Bawaan: versi dari app.config.ts. */
  appVersion?: string;
  silenceMs?: number;
  /** 0..1, untuk goyangan jeda sambung ulang. */
  random?: () => number;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Transport ke server asli: HTTP `/app/v1/*` dan WebSocket `/app/v1/stream`. */
export class HttpTransport implements Transport {
  readonly mode = 'server' as const;
  private readonly base: string;
  private readonly fetchFn: typeof fetch;
  private readonly socketFn: (url: string, headers: Record<string, string>) => SocketLike;
  private readonly timeoutMs: number;
  private readonly connectTimeoutMs: number;
  private readonly appVersionValue: string;
  private readonly silenceMs: number;
  private readonly random: () => number;

  private readonly hub = new StreamHub({ start: () => this.startStream(), stop: () => this.closeStream() });
  private ws: SocketLike | null = null;
  /** Naik setiap koneksi dibuka atau ditutup, supaya langkah async yang sudah usang berhenti. */
  private generation = 0;
  private attempt = 0;
  /** Soket yang gagal terbuka berturut-turut sejak koneksi terakhir yang sempat terbuka. */
  private failedOpens = 0;
  /** Pemeriksaan `GET /me` setelah gagal terbuka berulang sedang jalan, atau sudah dijawab server. */
  private probing = false;
  private probed = false;
  /** Naik saat stream dimulai atau ditutup, supaya jawaban pemeriksaan yang usang diabaikan. */
  private streamEpoch = 0;
  /** Token yang dipakai soket yang sedang berjalan, untuk memeriksa 4401 yang usang. */
  private wsToken: string | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    baseUrl: string,
    private readonly session: Session,
    options: HttpOptions = {},
  ) {
    this.base = `${baseUrl.replace(/\/+$/, '')}${API_PREFIX}`;
    this.fetchFn = options.fetch ?? ((input, init) => fetch(input, init));
    this.socketFn = options.socket ?? defaultSocket;
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.connectTimeoutMs = options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS;
    this.appVersionValue = options.appVersion ?? appVersion();
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
    // Pengguna bisa berbeda dari sebelumnya: `rev` lama bukan miliknya.
    this.hub.resetRev();
    if (this.hub.active && !this.ws) this.startStream();
    return res;
  }

  async logout(): Promise<void> {
    const token = await this.session.get();
    await this.session.clear();
    this.hub.resetRev();
    this.closeStream();
    // Pemberitahuan ke server menyusul di belakang layar dengan token tadi; gagal pun HP sudah keluar.
    if (token) void this.request('POST', '/auth/logout', okResSchema, { body: {}, token }).catch(() => {});
  }

  me(): Promise<Me> {
    return this.request('GET', '/me', meSchema);
  }

  async messages(before?: number): Promise<MessagesPage> {
    const query = `limit=${MESSAGES_LIMIT}${before === undefined ? '' : `&before=${before}`}`;
    const page = await this.request('GET', `/messages?${query}`, reader(parsePageLenient));
    // Halaman terbaru berisi ujung utas; halaman lama tidak mengubah apa yang sudah dikenal.
    if (before === undefined) this.noteRevs(page.items);
    return page;
  }

  async messagesChanged(changedAfter: number): Promise<MessagesChangedPage> {
    const page = await this.request(
      'GET',
      `/messages?limit=${MESSAGES_LIMIT_MAX}&changedAfter=${changedAfter}`,
      reader(parseChangedPageLenient),
    );
    this.noteRevs(page.items);
    return page;
  }

  send(req: SendMessageReq): Promise<Message> {
    return this.request('POST', '/messages', reader(parseSendRes), { body: req });
  }

  draftAction(id: string, req: DraftActionReq): Promise<DraftActionRes> {
    return this.request('POST', `/drafts/${encodeURIComponent(id)}`, reader(parseDraftResLenient), { body: req });
  }

  async registerPushToken(req: PushTokenReq): Promise<void> {
    await this.request('POST', '/push-tokens', okResSchema, { body: req });
  }

  async unregisterPushToken(req: PushTokenDeleteReq): Promise<void> {
    await this.request('DELETE', '/push-tokens', okResSchema, { body: req, auth: false });
  }

  security(): Promise<SecurityRes> {
    return this.request('GET', '/account/security', securityResSchema);
  }

  setSecurity(req: SecurityUpdateReq): Promise<SecurityRes> {
    return this.request('PUT', '/account/security', securityResSchema, { body: req });
  }

  setPin(req: PinSetReq): Promise<SecurityRes> {
    return this.request('POST', '/account/pin', securityResSchema, { body: req });
  }

  async verifyPin(pin: string): Promise<boolean> {
    try {
      await this.request('POST', '/account/pin/verify', okResSchema, { body: { pin } });
      return true;
    } catch (e) {
      if (e instanceof ApiFailure && e.code === 'pin_wrong') return false;
      throw e;
    }
  }

  home(): Promise<Home> {
    return this.request('GET', '/home', reader(parseHomeLenient));
  }

  setPlace(place: string): Promise<Home> {
    return this.request('PUT', '/places/current', reader(parseHomeLenient), { body: { place } });
  }

  agenda(range?: { from: string; to: string }): Promise<AgendaRes> {
    const query = range ? `?from=${range.from}&to=${range.to}` : '';
    return this.request('GET', `/agenda${query}`, reader(parseAgendaLenient));
  }

  async agendaItem(id: string): Promise<AgendaItem> {
    const res = await this.request('GET', `/agenda/${encodeURIComponent(id)}`, agendaItemResSchema);
    return res.item;
  }

  agendaParse(text: string): Promise<AgendaParseRes> {
    return this.request('POST', '/agenda/parse', agendaParseResSchema, { body: { text } });
  }

  async agendaAdd(item: AgendaNew): Promise<AgendaItem> {
    const res = await this.request('POST', '/agenda', agendaItemResSchema, { body: { item } });
    return res.item;
  }

  async agendaPatch(id: string, req: AgendaPatchReq): Promise<AgendaItem> {
    const res = await this.request('PATCH', `/agenda/${encodeURIComponent(id)}`, agendaItemResSchema, { body: req });
    return res.item;
  }

  async agendaLeftover(choice: 'today' | 'drop'): Promise<AgendaItem | null> {
    const res = await this.request('POST', '/agenda/leftover', agendaLeftoverResSchema, { body: { choice } });
    return res.item;
  }

  async agendaAlarmAck(id: string, scheduledFor: string): Promise<void> {
    await this.request('POST', `/agenda/${encodeURIComponent(id)}/alarm-ack`, okResSchema, { body: { scheduledFor } });
  }

  async controlDevice(deviceId: string, req: DeviceControlReq): Promise<DeviceCard> {
    const res = await this.request('POST', `/home/devices/${encodeURIComponent(deviceId)}`, deviceControlResSchema, {
      body: req,
    });
    return res.card;
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

  private noteRevs(items: Message[]) {
    for (const m of items) this.hub.noteRev(m.rev);
  }

  /** Header di setiap request HTTP dan jabat tangan WebSocket. */
  private baseHeaders(): Record<string, string> {
    return { [APP_VERSION_HEADER]: this.appVersionValue, [CONTRACT_VERSION_HEADER]: String(CONTRACT_VERSION) };
  }

  private async request<T>(
    method: Method,
    path: string,
    schema: Reader<T>,
    { body, auth = true, token: given }: { body?: unknown; auth?: boolean; token?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', ...this.baseHeaders() };
    let token: string | null = null;
    if (auth) {
      token = given ?? (await this.session.get());
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
      await this.unauthorized(token);
      throw new ApiFailure('unauthorized', { status, error: errorCode(data) });
    }
    if (!ok) throw failureFor(status, data);
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new ApiFailure('server', { status, cause: parsed.error });
    return parsed.data;
  }

  /**
   * Server menolak `failedToken`. Sesi hanya dihapus kalau itu masih token sekarang: 401 yang datang terlambat untuk
   * token lama (sudah keluar lalu masuk lagi) tidak boleh mengeluarkan sesi yang baru. `true` kalau sesi dihapus.
   */
  private async unauthorized(failedToken: string | null): Promise<boolean> {
    if (failedToken === null || (await this.session.get()) !== failedToken) return false;
    await this.session.clear();
    this.hub.resetRev();
    this.closeStream();
    return true;
  }

  // ---- Stream ----

  subscribe(
    onEvent: (event: StreamEvent) => void,
    onStatus: (status: ConnectionStatus) => void,
    onResync?: (lastRev: number | undefined) => void,
  ): Unsubscribe {
    return this.hub.add({ onEvent, onStatus, onResync });
  }

  private startStream() {
    this.attempt = 0;
    this.failedOpens = 0;
    this.probed = false;
    this.streamEpoch += 1;
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
      ws = this.socketFn(`${this.base.replace(/^http/, 'ws')}/stream`, {
        ...this.baseHeaders(),
        Authorization: `Bearer ${token}`,
      });
    } catch {
      this.retry(true);
      return;
    }
    this.ws = ws;
    this.wsToken = token;
    this.armConnect(ws);
    let opened = false;
    ws.onopen = () => {
      if (ws !== this.ws) return;
      opened = true;
      this.attempt = 0;
      this.failedOpens = 0;
      this.probed = false;
      this.clearConnect();
      this.hub.setStatus('open');
      this.armSilence();
      // Setiap koneksi baru mengambil pesan yang terlewat, juga yang pertama (riwayat bisa lebih tua dari stream).
      this.hub.resync();
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
      this.clearConnect();
      if (ev?.code !== WS_CLOSE_UNAUTHORIZED) return this.retry(!opened);
      // 4401 untuk token yang sudah diganti: sambung lagi dengan token sekarang, jangan hapus sesi baru.
      void this.unauthorized(this.wsToken).then((cleared) => {
        if (!cleared) this.retry(!opened);
      });
    };
  }

  /** Soket yang terlalu lama `connecting` dibuang lalu dicoba lagi dengan jeda bertingkat. */
  private armConnect(ws: SocketLike) {
    this.clearConnect();
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      if (ws !== this.ws) return;
      this.ws = null;
      detach(ws);
      ws.close();
      this.retry(true);
    }, this.connectTimeoutMs);
  }

  private clearConnect() {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = null;
  }

  /** Koneksi putus atau gagal: coba lagi setelah jeda bertingkat, selama masih ada yang mendengarkan. */
  private retry(failedOpen: boolean) {
    this.clearTimers();
    if (!this.hub.active) return;
    if (failedOpen) {
      this.failedOpens += 1;
      if (this.failedOpens >= FAILED_OPENS_BEFORE_PROBE) void this.probeHandshake();
    }
    this.hub.setStatus('connecting');
    const delay = backoffDelay(this.attempt, this.random);
    this.attempt += 1;
    this.retryTimer = setTimeout(() => void this.openSocket(), delay);
  }

  /**
   * React Native melaporkan penolakan jabat tangan WebSocket (403 diblokir, 426 perlu pembaruan, 429) sebagai tutup biasa
   * (1006), sama dengan jaringan putus. Setelah beberapa kali gagal terbuka berturut-turut, tanya server lewat HTTP:
   * 401 menghapus sesi (status keluar), 403 dan 426 menghentikan penyambungan ulang dengan status yang bisa
   * ditampilkan; jawaban lain, atau tanpa jawaban, melanjutkan jeda bertingkat. Ditanyakan sampai server menjawab.
   */
  private async probeHandshake() {
    if (this.probing || this.probed) return;
    this.probing = true;
    const epoch = this.streamEpoch;
    let verdict: ConnectionStatus | null = null;
    let answered = false;
    try {
      await this.me();
      answered = true;
    } catch (e) {
      const code = e instanceof ApiFailure ? e.code : null;
      if (code === 'blocked') verdict = 'blocked';
      else if (code === 'upgrade_required') verdict = 'upgrade_required';
      // Jawaban pasti (juga 401, yang sudah menghapus sesi). Gangguan lain: tanya lagi pada kegagalan berikutnya.
      answered = verdict !== null || code === 'unauthorized';
    } finally {
      this.probing = false;
    }
    if (epoch !== this.streamEpoch) return;
    if (answered) this.probed = true;
    if (verdict === null) return;
    // Berhenti menyambung; pendengar tetap terdaftar dan menerima status penyebabnya.
    this.closeStream();
    this.hub.setStatus(verdict);
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
      this.retry(false);
    }, this.silenceMs);
  }

  /** Tutup koneksi tanpa menyambung ulang; pendengar tetap terdaftar dan menerima status `closed`. */
  private closeStream() {
    this.generation += 1;
    this.streamEpoch += 1;
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
    this.clearConnect();
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

/** Pembaca jawaban: bentuk `safeParse` zod, supaya skema zod dan pembacaan longgar bisa dipakai bergantian. */
interface Reader<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error?: unknown };
}

function reader<T>(parse: (data: unknown) => T | null): Reader<T> {
  return {
    safeParse(data) {
      const value = parse(data);
      return value === null ? { success: false } : { success: true, data: value };
    },
  };
}

function parseSendRes(data: unknown): Message | null {
  return parseMessageLenient((data as { message?: unknown } | null | undefined)?.message);
}

function defaultSocket(url: string, headers: Record<string, string>): SocketLike {
  // React Native menerima `{ headers }` sebagai argumen ketiga; tipe WebSocket standar tidak mengenalnya.
  const Native = WebSocket as unknown as new (
    url: string,
    protocols: undefined,
    options: { headers: object },
  ) => SocketLike;
  return new Native(url, undefined, { headers });
}

/** Kegagalan untuk jawaban non-2xx (selain 401, yang diurus tersendiri). */
function failureFor(status: number, data: unknown): ApiFailure {
  const error = errorCode(data);
  const details = { status, error };
  if (status === 403 && error === 'pin_salah') return new ApiFailure('pin_wrong', details);
  if (status === 403) return new ApiFailure('blocked', details);
  if (status === 404 && error === 'belum_terdaftar') {
    return new ApiFailure('not_registered', { ...details, waNumber: waNumber(data) });
  }
  if (status === 426) return new ApiFailure('upgrade_required', details);
  if (status === 429) return new ApiFailure('rate_limited', { ...details, retryInSec: retryInSec(data) });
  if (status === 501) return new ApiFailure('unavailable', details);
  return new ApiFailure(error === 'kode_salah' ? 'kode_salah' : 'server', details);
}

function waNumber(data: unknown): string | undefined {
  const raw = (data as { waNumber?: unknown } | null | undefined)?.waNumber;
  return typeof raw === 'string' && waNumberSchema.safeParse(raw).success ? raw : undefined;
}

function retryInSec(data: unknown): number | undefined {
  const raw = (data as { retryInSec?: unknown } | null | undefined)?.retryInSec;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.ceil(raw) : undefined;
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
  return typeof data === 'string' ? parseEventLenient(parseJson(data)) : null;
}
