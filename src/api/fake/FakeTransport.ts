import type { z } from 'zod';
import { THINK_MS } from '@/sample/chat';
import {
  authStartReqSchema,
  authVerifyReqSchema,
  deviceControlReqSchema,
  draftActionReqSchema,
  HELD_MINUTES,
  MESSAGES_LIMIT,
  MESSAGES_LIMIT_MAX,
  pinSetReqSchema,
  pinVerifyReqSchema,
  pushTokenDeleteReqSchema,
  pushTokenReqSchema,
  securityUpdateReqSchema,
  sendMessageReqSchema,
  type AuthStartReq,
  type AuthStartRes,
  type AuthVerifyReq,
  type AuthVerifyRes,
  type DeviceCard,
  type DeviceControlReq,
  type Draft,
  type DraftActionReq,
  type DraftActionRes,
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
} from '../contract';
import { StreamHub } from '../hub';
import type { DataMode } from '../mode';
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
import { SAMPLE_FILE_MEDIA_ID, SAMPLE_QR_MEDIA_ID, sampleHistory } from './history';
import { FakeScenario, sampleMe, type AcState } from './scenario';

/** Jeda minta kode lagi di server tiruan. */
export const FAKE_RESEND_SEC = 60;
/** Kode yang selalu dibalas `kode_salah`, untuk mencoba layar "kodenya belum cocok". Kode 6 angka lain diterima. */
export const FAKE_WRONG_CODE = '000000';

/** Nomor WhatsApp Sekretaris AI di server tiruan, untuk jawaban `belum_terdaftar`. */
export const FAKE_WA_NUMBER = '6281100002222';
/** Nomor berakhiran ini dianggap belum terdaftar (`auth/start` dibalas 404 `belum_terdaftar`). */
export const FAKE_UNREGISTERED_SUFFIX = '0000';

export interface FakeOptions {
  /** Nomor WhatsApp Sekretaris AI yang disebut `belum_terdaftar`; `null` = tidak disebut. Bawaan {@link FAKE_WA_NUMBER}. */
  waNumber?: string | null;
  /** Keadaan awal PIN akun. Bawaan: tanpa PIN dan PIN mati. */
  security?: { pinEnabled?: boolean; pin?: string };
  /** Hanya untuk tes: label mode transport ini. Bawaan `contoh`. */
  mode?: DataMode;
  /** Jeda dari `thinking on` sampai jawaban asisten. Bawaan 1,2 detik. */
  thinkMs?: number;
  /** Jeda setiap request, supaya tanda "mengirim…" sempat terlihat di HP. Bawaan 0 (tes). */
  latencyMs?: number;
  /**
   * Seperti server asli: tanpa sesi, semua jalur selain `auth/*` dibalas 401 dan stream tidak tersambung. Bawaannya
   * tidak, karena mode contoh tidak memaksa masuk.
   */
  requireSession?: boolean;
  /** Riwayat awal, dari yang terlama, dengan `seq` naik. Bawaan utas contoh 0b. */
  history?: Message[];
  clock?: FakeClock;
  /** Paling banyak pesan per `messagesChanged`, supaya `more` bisa dicoba. Bawaan batas kontrak. */
  afterLimit?: number;
}

type Timer = ReturnType<typeof setTimeout>;
type SimulatedFailure = Exclude<FailureCode, 'unauthorized' | 'kode_salah'>;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const invalid = (cause?: unknown) => new ApiFailure('server', { status: 400, error: 'tidak_valid', cause });
const notFound = () => new ApiFailure('server', { status: 404, error: 'tidak_ditemukan' });
const wrongStatus = () => new ApiFailure('server', { status: 409, error: 'status_draf' });
const wrongPin = () => new ApiFailure('pin_wrong', { status: 403, error: 'pin_salah' });
const alreadyChosen = () => new ApiFailure('server', { status: 409, error: 'sudah_dipilih' });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalid(parsed.error);
  return parsed.data;
}

/**
 * Server tiruan di memori, memenuhi kontrak dan aturan perilaku yang sama dengan server asli (lihat contract.ts):
 * - `authStart` menerima nomor E.164 apa pun (minimal 9 digit) tapi membalas 429 `terlalu_sering` (dengan
 *   `retryInSec`) kalau diulang sebelum {@link FAKE_RESEND_SEC} detik; `authVerify` menerima kode 6 angka apa pun
 *   kecuali {@link FAKE_WRONG_CODE}, dan hanya untuk nomor yang sudah `authStart` (selain itu `kode_salah`);
 * - riwayat awal dari utas contoh 0b; setiap pesan punya `seq` (tetap) dan `rev` (naik tiap simpan dan perbarui, juga saat drafnya berubah), dibaca lewat `messages(before)` / `messagesChanged`;
 * - `send` menyimpan pesan, lalu stream mengirim pesan itu, `thinking on` (dengan `runId`), jawaban setelah `thinkMs`,
 *   dan `thinking off`. Jawabannya dari {@link FakeScenario}. Pilihan (`kind: 'choice'`) divalidasi terhadap pesan
 *   `messageId`, judulnya diambil dari sana, dan pesan itu di-upsert dengan `chosenId`;
 * - draf `send` → `held` → `sent` (atau `failed`, lihat {@link failHeldSends}) setelah {@link HELD_MINUTES} menit,
 *   `cancel` hanya dari `held`, `discard` hanya dari `draft`. Setiap perubahan disiarkan lewat event `draft`;
 * - QRIS `menunggu` menjadi `kedaluwarsa` saat `until` lewat, atau `lunas` lewat {@link payQris}, keduanya lewat
 *   upsert pesan (event `message` dengan `id` dan `seq` yang sama).
 *
 * Untuk tes dan menu Coba ada kendali tambahan: {@link drop} / {@link restore} (putus sambung), {@link failNext},
 * {@link revokeSession}, {@link receive} (pesan masuk dari luar aplikasi, misalnya WhatsApp), {@link payQris}, dan
 * {@link failHeldSends}.
 */
export class FakeTransport implements Transport {
  /** `contoh`, kecuali tes yang meniru server (`options.mode`) supaya `Transport.mode` sama dengan `Api.mode`. */
  readonly mode: DataMode;
  /** Setiap pendaftaran token notifikasi, dari yang pertama. Hanya dicatat, tidak dikirim ke mana pun. */
  readonly registeredPushTokens: PushTokenReq[] = [];
  /** Token yang dicabut (`unregisterPushToken`), dari yang pertama. Hanya dicatat. */
  readonly unregisteredPushTokens: string[] = [];

  private readonly clock: FakeClock;
  private readonly scenario: FakeScenario;
  private readonly thinkMs: number;
  private readonly latencyMs: number;
  private readonly requireSession: boolean;
  private readonly afterLimit: number;
  private readonly meValue: Me;
  private readonly waNumber: string | null;
  private pinEnabled: boolean;
  private pinValue: string | null;

  /** Utas, dari yang terlama (juga urutan `seq`). Kartu draf di sini bisa usang; keadaan terbaru ada di `drafts`. */
  private readonly thread: Message[] = [];
  private readonly drafts = new Map<string, Draft>();
  /** `clientId` → id pesan, untuk kirim ulang yang aman. */
  private readonly byClientId = new Map<string, string>();
  private readonly holds = new Map<string, Timer>();
  private readonly qrisExpiry = new Map<string, Timer>();
  private readonly timers = new Set<Timer>();
  /** Nomor yang sudah meminta kode: kapan (ms jam tiruan). */
  private readonly codeRequests = new Map<string, number>();
  /** Request yang sedang berjalan; `dispose` menolaknya supaya tidak menggantung. */
  private readonly pending = new Set<(e: ApiFailure) => void>();
  private readonly hub = new StreamHub({
    start: () => this.connect(),
    stop: () => this.hub.setStatus('closed'),
  });
  private readonly acListeners = new Set<(ac: AcState) => void>();
  private readonly failures: SimulatedFailure[] = [];
  private offline = false;
  private restoreTimer: Timer | null = null;
  private revoked = false;
  private failHeld = false;
  /** Pencacah untuk id pesan, token, dan runId. */
  private counter = 0;
  /** `seq` pesan terakhir. */
  private msgSeq = 0;
  /** `rev` terakhir: naik untuk setiap pesan yang disimpan atau diperbarui. */
  private msgRev = 0;

  constructor(
    private readonly session: Session,
    options: FakeOptions = {},
  ) {
    this.mode = options.mode ?? 'contoh';
    this.clock = options.clock ?? new FakeClock();
    this.scenario = new FakeScenario(this.clock);
    this.thinkMs = options.thinkMs ?? THINK_MS;
    this.latencyMs = options.latencyMs ?? 0;
    this.requireSession = options.requireSession ?? false;
    this.afterLimit = options.afterLimit ?? MESSAGES_LIMIT_MAX;
    this.meValue = sampleMe(this.clock);
    this.waNumber = options.waNumber === undefined ? FAKE_WA_NUMBER : options.waNumber;
    this.pinValue = options.security?.pin ?? null;
    this.pinEnabled = (options.security?.pinEnabled ?? false) && this.pinValue !== null;
    for (const message of copy(options.history ?? sampleHistory())) {
      this.msgSeq = Math.max(this.msgSeq, message.seq);
      this.msgRev = Math.max(this.msgRev, message.rev);
      this.store(message);
    }
  }

  // ---- Jalur kontrak ----

  authStart(req: AuthStartReq): Promise<AuthStartRes> {
    return this.call(false, () => {
      const { phone } = parse(authStartReqSchema, req);
      // Aplikasi adalah add-on: akun hanya dibuat lewat WhatsApp, jadi nomor asing ditolak sebelum kode dikirim.
      if (phone.endsWith(FAKE_UNREGISTERED_SUFFIX)) {
        throw new ApiFailure('not_registered', {
          status: 404,
          error: 'belum_terdaftar',
          waNumber: this.waNumber ?? undefined,
        });
      }
      const last = this.codeRequests.get(phone);
      if (last !== undefined) {
        const left = Math.ceil((last + FAKE_RESEND_SEC * 1000 - this.clock.now()) / 1000);
        if (left > 0) {
          throw new ApiFailure('rate_limited', { status: 429, error: 'terlalu_sering', retryInSec: left });
        }
      }
      this.codeRequests.set(phone, this.clock.now());
      return { resendInSec: FAKE_RESEND_SEC };
    });
  }

  authVerify(req: AuthVerifyReq): Promise<AuthVerifyRes> {
    return this.call(false, async () => {
      const { phone, code } = parse(authVerifyReqSchema, req);
      if (code === FAKE_WRONG_CODE || !this.codeRequests.has(phone)) {
        throw new ApiFailure('kode_salah', { status: 400, error: 'kode_salah' });
      }
      // Kode sudah terpakai: masuk berikutnya perlu meminta kode lagi.
      this.codeRequests.delete(phone);
      const token = `contoh-${phone}-${++this.counter}`;
      this.revoked = false;
      await this.session.set(token);
      this.hub.resetRev();
      if (this.hub.active && this.hub.status !== 'open') this.connect();
      return { token, user: copy(this.meValue) };
    });
  }

  async logout(): Promise<void> {
    await this.session.clear();
    this.hub.resetRev();
    this.hub.setStatus('closed');
  }

  me(): Promise<Me> {
    return this.call(true, () => copy(this.meValue));
  }

  messages(before?: number): Promise<MessagesPage> {
    return this.call(true, () => {
      // `before` yang tidak ada di utas (misalnya setelah memory_forget) memberi halaman terbaru, bukan error.
      const at = before === undefined ? -1 : this.thread.findIndex((m) => m.seq === before);
      const end = at < 0 ? this.thread.length : at;
      const start = Math.max(0, end - MESSAGES_LIMIT);
      const items = this.thread
        .slice(start, end)
        .reverse()
        .map((m) => this.present(m));
      if (at < 0) for (const m of items) this.hub.noteRev(m.rev);
      return { items, before: start > 0 ? items[items.length - 1]!.seq : null };
    });
  }

  messagesChanged(changedAfter: number): Promise<MessagesChangedPage> {
    return this.call(true, () => {
      const newer = this.thread.filter((m) => m.rev > changedAfter).sort((a, b) => a.rev - b.rev);
      const items = newer.slice(0, this.afterLimit).map((m) => this.present(m));
      for (const m of items) this.hub.noteRev(m.rev);
      return { items, more: newer.length > items.length };
    });
  }

  send(req: SendMessageReq): Promise<Message> {
    return this.call(true, () => {
      const parsed = parse(sendMessageReqSchema, req);
      const known = this.byClientId.get(parsed.clientId);
      const knownMessage = known === undefined ? undefined : this.thread.find((m) => m.id === known);
      if (knownMessage) return this.present(knownMessage);

      let text: string;
      let choiceId: string | undefined;
      let chosenIn: string | undefined;
      if (parsed.kind === 'text') {
        text = parsed.text;
      } else {
        const source = this.thread.find((m) => m.id === parsed.messageId);
        if (!source) throw notFound();
        const choices = source.parts.find((p) => p.type === 'choices');
        if (choices?.type !== 'choices') throw invalid();
        const choice = choices.choices.find((c) => c.id === parsed.choiceId);
        if (!choice) throw invalid();
        if (choices.chosenId !== undefined) throw alreadyChosen();
        // Judul dari pilihan tersimpan, bukan dari klien.
        text = choice.title;
        choiceId = choice.id;
        chosenIn = source.id;
      }

      const message = this.store({
        id: this.nextId(),
        seq: ++this.msgSeq,
        rev: ++this.msgRev,
        clientId: parsed.clientId,
        at: this.clock.iso(),
        from: 'user',
        via: 'app',
        parts: [{ type: 'text', text }],
      });
      let chosen: Message | null = null;
      if (chosenIn !== undefined) {
        chosen = this.replace(chosenIn, (m) => ({
          ...m,
          parts: m.parts.map((p) => (p.type === 'choices' ? { ...p, chosenId: choiceId } : p)),
        }));
      }
      const runId = `r-contoh-${++this.counter}`;
      this.later(0, () => {
        this.emit({ type: 'message', message: this.present(message) });
        if (chosen) this.emit({ type: 'message', message: chosen });
        this.emit({ type: 'thinking', runId, on: true });
      });
      this.later(this.thinkMs, () => {
        const reply = this.scenario.reply({ text, choiceId });
        for (const draft of reply.drafts) this.drafts.set(draft.id, draft);
        for (const parts of reply.messages) this.receive({ from: 'assistant', via: 'app', parts });
        if (reply.acChange) for (const l of [...this.acListeners]) l(reply.acChange);
        this.emit({ type: 'thinking', runId, on: false });
      });
      return this.present(message);
    });
  }

  draftAction(id: string, req: DraftActionReq): Promise<DraftActionRes> {
    return this.call(true, () => {
      const action = parse(draftActionReqSchema, req);
      const draft = this.drafts.get(id);
      if (!draft) throw notFound();
      let next: Draft;
      switch (action.action) {
        case 'send':
          // `failed` boleh dikirim ulang ("Coba lagi"); `sent` dan `cancelled` tidak.
          if (draft.status !== 'draft' && draft.status !== 'failed') throw wrongStatus();
          next = { ...draft, status: 'held', heldUntil: this.clock.iso(HELD_MINUTES) };
          this.hold(id);
          break;
        case 'cancel':
          if (draft.status !== 'held') throw wrongStatus();
          this.endHold(id);
          next = { ...draft, status: 'cancelled' };
          break;
        case 'discard':
          if (draft.status !== 'draft') throw wrongStatus();
          next = { ...draft, status: 'cancelled' };
          break;
        case 'edit':
          if (draft.status !== 'draft') throw wrongStatus();
          next = { ...draft, text: action.text };
          break;
      }
      const rev = this.changeDraft(next);
      return { draft: copy(next), rev };
    });
  }

  registerPushToken(req: PushTokenReq): Promise<void> {
    return this.call(true, () => {
      this.registeredPushTokens.push(parse(pushTokenReqSchema, req));
    });
  }

  unregisterPushToken(req: PushTokenDeleteReq): Promise<void> {
    return this.call(false, () => {
      this.unregisteredPushTokens.push(parse(pushTokenDeleteReqSchema, req).pushToken);
    });
  }

  security(): Promise<SecurityRes> {
    return this.call(true, () => this.securityState());
  }

  setSecurity(req: SecurityUpdateReq): Promise<SecurityRes> {
    return this.call(true, () => {
      const { pinEnabled } = parse(securityUpdateReqSchema, req);
      if (pinEnabled && this.pinValue === null) throw invalid();
      this.pinEnabled = pinEnabled;
      return this.securityState();
    });
  }

  setPin(req: PinSetReq): Promise<SecurityRes> {
    return this.call(true, () => {
      const { pin, currentPin } = parse(pinSetReqSchema, req);
      if (this.pinValue !== null) {
        if (currentPin === undefined) throw invalid();
        if (currentPin !== this.pinValue) throw wrongPin();
      }
      this.pinValue = pin;
      return this.securityState();
    });
  }

  verifyPin(pin: string): Promise<boolean> {
    return this.call(true, () => {
      const { pin: given } = parse(pinVerifyReqSchema, { pin });
      return this.pinValue !== null && given === this.pinValue;
    });
  }

  private securityState(): SecurityRes {
    return { pinEnabled: this.pinEnabled, hasPin: this.pinValue !== null };
  }

  /** Kendali perangkat dari kartu adalah Fase 3: server tiruan, seperti server Fase 1b, menjawab 501. */
  controlDevice(_deviceId: string, req: DeviceControlReq): Promise<DeviceCard> {
    return this.call(true, (): DeviceCard => {
      parse(deviceControlReqSchema, req);
      throw new ApiFailure('unavailable', { status: 501, error: 'belum_tersedia' });
    });
  }

  async mediaUrl(mediaId: string): Promise<MediaSource> {
    await this.checkSession();
    if (mediaId === SAMPLE_QR_MEDIA_ID) return { kind: 'sampleQr' };
    if (mediaId === SAMPLE_FILE_MEDIA_ID) return { kind: 'sampleFile' };
    throw notFound();
  }

  subscribe(
    onEvent: (event: StreamEvent) => void,
    onStatus: (status: ConnectionStatus) => void,
    onResync?: (lastRev: number | undefined) => void,
  ): Unsubscribe {
    return this.hub.add({ onEvent, onStatus, onResync });
  }

  dispose() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.holds.clear();
    this.qrisExpiry.clear();
    this.restoreTimer = null;
    // Request yang masih menunggu (jeda, atau sesi) ditolak, bukan dibiarkan menggantung.
    const rejects = [...this.pending];
    this.pending.clear();
    for (const reject of rejects) reject(new ApiFailure('network', { cause: new Error('transport dilepas') }));
    this.hub.setStatus('closed');
  }

  // ---- Kendali untuk tes dan menu Coba ----

  /**
   * Putuskan jaringan: stream putus (status `connecting`) dan setiap request gagal dengan kendala jaringan, sampai
   * {@link restore}. Dengan `ms`, tersambung lagi sendiri setelah sekian milidetik. Event selama putus tidak sampai;
   * setelah {@link restore} pendengar diminta resync.
   */
  drop(ms?: number) {
    this.offline = true;
    if (this.hub.active && this.hub.status !== 'closed') this.hub.setStatus('connecting');
    this.cancelTimer(this.restoreTimer);
    this.restoreTimer = ms === undefined ? null : this.later(ms, () => this.restore());
  }

  /** Sambungkan lagi. Stream terbuka kembali dan pendengar diminta resync. */
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
    const message = this.store({
      id: this.nextId(),
      seq: ++this.msgSeq,
      rev: ++this.msgRev,
      at: this.clock.iso(),
      ...copy(input),
    });
    this.emit({ type: 'message', message: this.present(message) });
    return this.present(message);
  }

  /** Pembayaran masuk: QRIS `menunggu` (`messageId`, atau yang terbaru) menjadi `lunas`, lewat upsert pesan. */
  payQris(messageId?: string): Message | null {
    const target = messageId ?? this.latestWaitingQris()?.id;
    return target === undefined ? null : this.setQris(target, 'lunas');
  }

  /**
   * Mode contoh: pembaca keadaan AC yang sebenarnya (penyimpanan contoh), supaya jawaban "AC kamar gimana?" sesuai
   * Beranda. Tanpa pembaca, skenario memakai keadaannya sendiri.
   */
  setAcReader(read: (() => AcState) | null) {
    this.scenario.setAcReader(read);
  }

  /** Dipanggil saat permintaan pengguna di chat benar-benar mengubah AC (bukan saat hanya ditanya). */
  onAcChange(listener: (ac: AcState) => void): Unsubscribe {
    this.acListeners.add(listener);
    return () => {
      this.acListeners.delete(listener);
    };
  }

  /** Mulai sekarang, draf yang selesai ditahan menjadi `failed` (pengiriman gagal), bukan `sent`. */
  failHeldSends(on = true) {
    this.failHeld = on;
  }

  // ---- Dalaman ----

  private call<T>(auth: boolean, run: () => T | Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.add(reject);
      this.execute(auth, run)
        .then(resolve, reject)
        .finally(() => this.pending.delete(reject));
    });
  }

  private async execute<T>(auth: boolean, run: () => T | Promise<T>): Promise<T> {
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
    this.hub.resetRev();
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

  /** Setiap koneksi yang terbuka, juga yang pertama, meminta pendengar resync. */
  private open() {
    this.hub.setStatus('open');
    this.hub.resync();
  }

  /** Kirim ke pendengar. Saat stream tidak terbuka eventnya hilang, seperti server asli; resync mengambilnya. */
  private emit(event: StreamEvent) {
    if (this.hub.status === 'open') this.hub.emit(copy(event));
  }

  /** Simpan pesan di utas dan catat draf, `clientId`, serta batas bayar QRIS-nya. */
  private store(message: Message): Message {
    this.thread.push(message);
    if (message.clientId) this.byClientId.set(message.clientId, message.id);
    for (const part of message.parts) {
      if (part.type !== 'card') continue;
      const card = part.card;
      if (card.kind === 'qris' && card.status === 'menunggu') this.expireQrisAt(message.id, card.until);
      if (card.kind !== 'draft' || this.drafts.has(card.draft.id)) continue;
      this.drafts.set(card.draft.id, card.draft);
      if (card.draft.status === 'held') this.hold(card.draft.id);
    }
    return message;
  }

  /** Ganti isi pesan `id` di tempatnya (`seq` tetap, `rev` naik) dan kembalikan salinan untuk dikirim; `null` kalau tidak ada. */
  private replace(id: string, update: (m: Message) => Message): Message | null {
    const i = this.thread.findIndex((m) => m.id === id);
    if (i < 0) return null;
    this.thread[i] = { ...update(this.thread[i]!), rev: ++this.msgRev };
    return this.present(this.thread[i]!);
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

  /** Catat perubahan draf dan siarkan ke semua koneksi (juga untuk aksi dari aplikasi ini). Mengembalikan `rev` barunya. */
  private changeDraft(next: Draft): number {
    this.drafts.set(next.id, next);
    const rev = this.touchDraft(next.id);
    this.later(0, () => this.emit({ type: 'draft', draft: next, rev }));
    return rev;
  }

  /** Draf `held` menjadi `sent` (atau `failed`) setelah {@link HELD_MINUTES} menit. */
  private hold(id: string) {
    this.endHold(id);
    this.holds.set(
      id,
      this.later(HELD_MINUTES * 60_000, () => {
        this.holds.delete(id);
        const draft = this.drafts.get(id);
        if (draft?.status !== 'held') return;
        const done: Draft = { ...draft, status: this.failHeld ? 'failed' : 'sent' };
        this.drafts.set(id, done);
        const rev = this.touchDraft(id);
        this.emit({ type: 'draft', draft: done, rev });
      }),
    );
  }

  /** Draf berubah: pesan yang memuat kartunya naik `rev`, supaya resync membawanya. Mengembalikan `rev` barunya. */
  private touchDraft(id: string): number {
    let rev = 0;
    this.thread.forEach((m, i) => {
      if (m.parts.some((p) => p.type === 'card' && p.card.kind === 'draft' && p.card.draft.id === id)) {
        rev = ++this.msgRev;
        this.thread[i] = { ...m, rev };
      }
    });
    return rev || ++this.msgRev;
  }

  private endHold(id: string) {
    this.cancelTimer(this.holds.get(id));
    this.holds.delete(id);
  }

  private latestWaitingQris(): Message | undefined {
    return [...this.thread]
      .reverse()
      .find((m) => m.parts.some((p) => p.type === 'card' && p.card.kind === 'qris' && p.card.status === 'menunggu'));
  }

  /** QRIS `menunggu` pada pesan `id` menjadi `lunas` atau `kedaluwarsa`, lewat upsert. */
  private setQris(id: string, status: 'lunas' | 'kedaluwarsa'): Message | null {
    const current = this.thread.find((m) => m.id === id);
    const waiting = current?.parts.some(
      (p) => p.type === 'card' && p.card.kind === 'qris' && p.card.status === 'menunggu',
    );
    if (!waiting) return null;
    this.cancelTimer(this.qrisExpiry.get(id));
    this.qrisExpiry.delete(id);
    const message = this.replace(id, (m) => ({
      ...m,
      parts: m.parts.map((p) =>
        p.type === 'card' && p.card.kind === 'qris' && p.card.status === 'menunggu'
          ? { ...p, card: { ...p.card, status } }
          : p,
      ),
    }));
    if (message) this.emit({ type: 'message', message });
    return message;
  }

  private expireQrisAt(id: string, until: string) {
    const wait = Date.parse(until) - this.clock.now();
    if (!(wait > 0)) return;
    this.cancelTimer(this.qrisExpiry.get(id));
    this.qrisExpiry.set(
      id,
      this.later(wait, () => {
        this.qrisExpiry.delete(id);
        this.setQris(id, 'kedaluwarsa');
      }),
    );
  }

  private nextId(): string {
    return `m-contoh-${++this.counter}`;
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
