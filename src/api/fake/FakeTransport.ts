import type { z } from 'zod';
import { THINK_MS } from '@/sample/chat';
import {
  authStartReqSchema,
  authVerifyReqSchema,
  deviceRegisterReqSchema,
  draftActionReqSchema,
  HELD_MINUTES,
  MESSAGES_LIMIT,
  sendMessageReqSchema,
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
} from '../contract';
import { StreamHub } from '../hub';
import type { Session } from '../session';
import {
  ApiFailure,
  type ConnectionStatus,
  type FailureCode,
  type MediaSource,
  type Transport,
  type Unsubscribe,
} from '../transport';
import { FakeClock } from './clock';
import { SAMPLE_QR_MEDIA_ID, sampleHistory } from './history';
import { FakeScenario, sampleMe } from './scenario';

/** Jeda minta kode lagi di server tiruan. */
export const FAKE_RESEND_SEC = 60;
/** Kode yang selalu dibalas `kode_salah`, untuk mencoba layar "kodenya belum cocok". Kode 6 angka lain diterima. */
export const FAKE_WRONG_CODE = '000000';

export interface FakeOptions {
  /** Jeda dari `thinking on` sampai jawaban asisten. Bawaan 1,2 detik. */
  thinkMs?: number;
  /** Jeda setiap request, supaya tanda "mengirim…" sempat terlihat di HP. Bawaan 0 (tes). */
  latencyMs?: number;
  /**
   * Seperti server asli: tanpa sesi, semua jalur selain `auth/*` dibalas 401 dan stream tidak tersambung. Bawaannya
   * tidak, karena mode contoh tidak memaksa masuk.
   */
  requireSession?: boolean;
  /** Riwayat awal, dari yang terlama. Bawaan utas contoh 0b. */
  history?: Message[];
  clock?: FakeClock;
}

type Timer = ReturnType<typeof setTimeout>;
type SimulatedFailure = Exclude<FailureCode, 'unauthorized' | 'kode_salah'>;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const invalid = (cause?: unknown) => new ApiFailure('server', { status: 400, error: 'tidak_valid', cause });
const notFound = () => new ApiFailure('server', { status: 404, error: 'tidak_ditemukan' });
const wrongStatus = () => new ApiFailure('server', { status: 409, error: 'status_draf' });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalid(parsed.error);
  return parsed.data;
}

/**
 * Server tiruan di memori, memenuhi kontrak dan aturan perilaku yang sama dengan server asli (lihat contract.ts):
 * - `authStart` menerima nomor E.164 apa pun (minimal 9 digit); `authVerify` menerima kode 6 angka apa pun kecuali
 *   {@link FAKE_WRONG_CODE};
 * - riwayat awal dari utas contoh 0b;
 * - `send` menyimpan pesan, lalu stream mengirim pesan itu, `thinking on`, jawaban setelah `thinkMs`, dan
 *   `thinking off`. Jawabannya dari {@link FakeScenario};
 * - draf `send` → `held` → `sent` setelah {@link HELD_MINUTES} menit, `cancel` hanya dari `held`.
 *
 * Untuk tes dan menu Coba ada kendali tambahan: {@link drop} / {@link restore} (putus sambung), {@link failNext},
 * {@link revokeSession}, dan {@link receive} (pesan masuk dari luar aplikasi, misalnya WhatsApp).
 */
export class FakeTransport implements Transport {
  readonly mode = 'contoh' as const;
  /** Setiap pendaftaran perangkat notifikasi, dari yang pertama. Hanya dicatat, tidak dikirim ke mana pun. */
  readonly registeredDevices: DeviceRegisterReq[] = [];

  private readonly clock: FakeClock;
  private readonly scenario: FakeScenario;
  private readonly thinkMs: number;
  private readonly latencyMs: number;
  private readonly requireSession: boolean;
  private readonly meValue: Me;

  /** Utas, dari yang terlama. Kartu draf di sini bisa usang; keadaan terbaru ada di `drafts`. */
  private readonly thread: Message[] = [];
  private readonly drafts = new Map<string, Draft>();
  private readonly byClientId = new Map<string, Message>();
  private readonly holds = new Map<string, Timer>();
  private readonly timers = new Set<Timer>();
  private readonly hub = new StreamHub({
    start: () => this.connect(),
    stop: () => {
      this.missed = false;
      this.hub.setStatus('closed');
    },
  });
  private readonly failures: SimulatedFailure[] = [];
  private offline = false;
  private restoreTimer: Timer | null = null;
  private revoked = false;
  /** Ada event yang tidak sampai ke pendengar (stream tidak terbuka): setelah tersambung, minta resync. */
  private missed = false;
  private seq = 0;

  constructor(
    private readonly session: Session,
    options: FakeOptions = {},
  ) {
    this.clock = options.clock ?? new FakeClock();
    this.scenario = new FakeScenario(this.clock);
    this.thinkMs = options.thinkMs ?? THINK_MS;
    this.latencyMs = options.latencyMs ?? 0;
    this.requireSession = options.requireSession ?? false;
    this.meValue = sampleMe(this.clock);
    for (const message of copy(options.history ?? sampleHistory())) this.store(message);
  }

  // ---- Jalur kontrak ----

  authStart(req: AuthStartReq): Promise<AuthStartRes> {
    return this.call(false, () => {
      parse(authStartReqSchema, req);
      return { resendInSec: FAKE_RESEND_SEC };
    });
  }

  authVerify(req: AuthVerifyReq): Promise<AuthVerifyRes> {
    return this.call(false, async () => {
      const { phone, code } = parse(authVerifyReqSchema, req);
      if (code === FAKE_WRONG_CODE) throw new ApiFailure('kode_salah', { status: 400, error: 'kode_salah' });
      const token = `contoh-${phone}-${++this.seq}`;
      this.revoked = false;
      await this.session.set(token);
      if (this.hub.active && this.hub.status !== 'open') this.connect();
      return { token, user: copy(this.meValue) };
    });
  }

  async logout(): Promise<void> {
    await this.session.clear();
    this.hub.setStatus('closed');
  }

  me(): Promise<Me> {
    return this.call(true, () => copy(this.meValue));
  }

  messages(before?: string): Promise<MessagesPage> {
    return this.call(true, () => {
      let end = this.thread.length;
      if (before !== undefined) {
        end = this.thread.findIndex((m) => m.id === before);
        if (end < 0) throw invalid();
      }
      const start = Math.max(0, end - MESSAGES_LIMIT);
      const items = this.thread
        .slice(start, end)
        .reverse()
        .map((m) => this.present(m));
      return { items, before: start > 0 ? items[items.length - 1]!.id : null };
    });
  }

  send(req: SendMessageReq): Promise<Message> {
    return this.call(true, () => {
      const parsed = parse(sendMessageReqSchema, req);
      const known = this.byClientId.get(parsed.clientId);
      if (known) return this.present(known);
      const text = 'text' in parsed ? parsed.text : parsed.choiceTitle;
      const choiceId = 'choiceId' in parsed ? parsed.choiceId : undefined;
      const message = this.store({
        id: this.nextId(),
        clientId: parsed.clientId,
        at: this.clock.iso(),
        from: 'user',
        via: 'app',
        parts: [{ type: 'text', text }],
      });
      this.later(0, () => {
        this.emit({ type: 'message', message: this.present(message) });
        this.emit({ type: 'thinking', on: true });
      });
      this.later(this.thinkMs, () => {
        const reply = this.scenario.reply({ text, choiceId });
        for (const draft of reply.drafts) this.drafts.set(draft.id, draft);
        for (const parts of reply.messages) this.receive({ from: 'assistant', via: 'app', parts });
        this.emit({ type: 'thinking', on: false });
      });
      return this.present(message);
    });
  }

  draftAction(id: string, req: DraftActionReq): Promise<Draft> {
    return this.call(true, () => {
      const action = parse(draftActionReqSchema, req);
      const draft = this.drafts.get(id);
      if (!draft) throw notFound();
      let next: Draft;
      switch (action.action) {
        case 'send':
          if (draft.status !== 'draft') throw wrongStatus();
          next = { ...draft, status: 'held', heldUntil: this.clock.hhmm(HELD_MINUTES) };
          this.hold(id);
          break;
        case 'cancel':
          if (draft.status !== 'held') throw wrongStatus();
          this.cancelTimer(this.holds.get(id));
          this.holds.delete(id);
          next = { ...draft, status: 'cancelled' };
          break;
        case 'edit':
          if (draft.status !== 'draft') throw wrongStatus();
          next = { ...draft, text: action.text };
          break;
      }
      this.drafts.set(id, next);
      return copy(next);
    });
  }

  registerDevice(req: DeviceRegisterReq): Promise<void> {
    return this.call(true, () => {
      this.registeredDevices.push(parse(deviceRegisterReqSchema, req));
    });
  }

  async mediaUrl(mediaId: string): Promise<MediaSource> {
    await this.checkSession();
    if (mediaId === SAMPLE_QR_MEDIA_ID) return { kind: 'sampleQr' };
    throw notFound();
  }

  subscribe(
    onEvent: (event: StreamEvent) => void,
    onStatus: (status: ConnectionStatus) => void,
    onResync?: () => void,
  ): Unsubscribe {
    return this.hub.add({ onEvent, onStatus, onResync });
  }

  dispose() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.holds.clear();
    this.restoreTimer = null;
    this.hub.setStatus('closed');
  }

  // ---- Kendali untuk tes dan menu Coba ----

  /**
   * Putuskan jaringan: stream putus (status `connecting`) dan setiap request gagal dengan kendala jaringan, sampai
   * {@link restore}. Dengan `ms`, tersambung lagi sendiri setelah sekian milidetik.
   */
  drop(ms?: number) {
    this.offline = true;
    if (this.hub.active && this.hub.status !== 'closed') {
      this.missed = true;
      this.hub.setStatus('connecting');
    }
    this.cancelTimer(this.restoreTimer);
    this.restoreTimer = ms === undefined ? null : this.later(ms, () => this.restore());
  }

  /** Sambungkan lagi. Stream terbuka kembali dan pendengar diminta resync kalau ada event yang terlewat. */
  restore() {
    if (!this.offline) return;
    this.offline = false;
    this.cancelTimer(this.restoreTimer);
    this.restoreTimer = null;
    if (this.hub.active && this.hub.status === 'connecting') this.connect();
  }

  /** Request berikutnya gagal dengan kendala ini (bisa diantre beberapa). */
  failNext(code: SimulatedFailure = 'network') {
    this.failures.push(code);
  }

  /** Server menolak token, seperti token yang dicabut: sesi dihapus dan stream ditutup (atau di request berikutnya). */
  revokeSession() {
    if (this.hub.active && this.hub.status !== 'closed') void this.unauthorized();
    else this.revoked = true;
  }

  /** Pesan baru dari luar aplikasi (asisten, atau pengguna lewat WhatsApp): disimpan di utas lalu dikirim lewat stream. */
  receive(input: Pick<Message, 'from' | 'via' | 'parts'>): Message {
    const message = this.store({ id: this.nextId(), at: this.clock.iso(), ...copy(input) });
    this.emit({ type: 'message', message: this.present(message) });
    return this.present(message);
  }

  // ---- Dalaman ----

  private async call<T>(auth: boolean, run: () => T | Promise<T>): Promise<T> {
    if (this.latencyMs > 0) await new Promise<void>((resolve) => this.later(this.latencyMs, resolve));
    if (this.offline) throw new ApiFailure('network');
    const failure = this.failures.shift();
    if (failure) throw new ApiFailure(failure);
    if (auth) await this.checkSession();
    return run();
  }

  private async checkSession() {
    if (this.revoked || (this.requireSession && !(await this.session.get()))) {
      await this.unauthorized();
      throw new ApiFailure('unauthorized', { status: 401, error: 'tidak_masuk' });
    }
  }

  private async unauthorized() {
    this.revoked = false;
    await this.session.clear();
    this.hub.setStatus('closed');
  }

  private connect() {
    if (!this.hub.active) return;
    if (this.offline) {
      this.hub.setStatus('connecting');
      return;
    }
    if (!this.requireSession) {
      this.open();
      return;
    }
    this.hub.setStatus('connecting');
    void this.session.get().then((token) => {
      if (!this.hub.active || this.offline || this.hub.status !== 'connecting') return;
      if (token) this.open();
      else this.hub.setStatus('closed');
    });
  }

  private open() {
    this.hub.setStatus('open');
    if (this.missed) {
      this.missed = false;
      this.hub.resync();
    }
  }

  private emit(event: StreamEvent) {
    if (this.hub.status === 'open') this.hub.emit(copy(event));
    else if (this.hub.active) this.missed = true;
  }

  /** Simpan pesan di utas dan catat draf serta `clientId`-nya. */
  private store(message: Message): Message {
    this.thread.push(message);
    if (message.clientId) this.byClientId.set(message.clientId, message);
    for (const part of message.parts) {
      if (part.type !== 'card' || part.card.kind !== 'draft' || this.drafts.has(part.card.draft.id)) continue;
      this.drafts.set(part.card.draft.id, part.card.draft);
      if (part.card.draft.status === 'held') this.hold(part.card.draft.id);
    }
    return message;
  }

  /** Salinan pesan untuk dikirim keluar, dengan kartu draf berisi keadaan draf yang terbaru. */
  private present(message: Message): Message {
    return copy({
      ...message,
      parts: message.parts.map((part) =>
        part.type === 'card' && part.card.kind === 'draft'
          ? { ...part, card: { ...part.card, draft: this.drafts.get(part.card.draft.id) ?? part.card.draft } }
          : part,
      ),
    });
  }

  /** Draf `held` menjadi `sent` setelah {@link HELD_MINUTES} menit, dikabarkan lewat event `draft`. */
  private hold(id: string) {
    this.cancelTimer(this.holds.get(id));
    this.holds.set(
      id,
      this.later(HELD_MINUTES * 60_000, () => {
        this.holds.delete(id);
        const draft = this.drafts.get(id);
        if (draft?.status !== 'held') return;
        const sent: Draft = { ...draft, status: 'sent' };
        this.drafts.set(id, sent);
        this.emit({ type: 'draft', draft: sent });
      }),
    );
  }

  private nextId(): string {
    return `m-contoh-${++this.seq}`;
  }

  private later(ms: number, run: () => void): Timer {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      run();
    }, ms);
    this.timers.add(timer);
    return timer;
  }

  private cancelTimer(timer: Timer | null | undefined) {
    if (!timer) return;
    clearTimeout(timer);
    this.timers.delete(timer);
  }
}
