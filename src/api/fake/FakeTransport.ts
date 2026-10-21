import type { z } from 'zod';
import { draftIntro, THINK_MS } from '@/sample/chat';
import { MAIN_AC_ID } from '@/sample/devices';
import { STOCK } from '@/sample/business';
import { initialOutgoing, stockOrderDrafts } from '@/sample/outgoing';
import { user } from '@/sample/profile';
import { VOICE_UTTERANCES } from '@/sample/voice';
import type { SampleState } from '@/sample/reducer';
import { createSampleStore, type SampleStore } from '@/sample/sampleStore';
import { deviceById, draftFor } from '@/sample/selectors';
import { ROUTINES, routineActions, routineDone } from '@/sample/routines';
import { PLACES, type AcFan, type AcMode } from '@/sample/types';
import {
  agendaAddReqSchema,
  boxReqSchema,
  businessQuerySchema,
  businessReorderReqSchema,
  connectionPermissionReqSchema,
  devicesQuerySchema,
  routineRunReqSchema,
  agendaLeftoverReqSchema,
  agendaQuerySchema,
  agendaParseReqSchema,
  agendaPatchReqSchema,
  alarmAckReqSchema,
  assistantNameSchema,
  assistantUpdateReqSchema,
  greetingUpdateReqSchema,
  historyQuerySchema,
  notificationsUpdateReqSchema,
  authStartReqSchema,
  authVerifyReqSchema,
  deviceControlReqSchema,
  draftActionReqSchema,
  HELD_MINUTES,
  MESSAGES_LIMIT,
  MESSAGES_LIMIT_MAX,
  pinResetVerifyReqSchema,
  pinSetReqSchema,
  placeReqSchema,
  pinVerifyReqSchema,
  pushTokenDeleteReqSchema,
  pushTokenReqSchema,
  securityUpdateReqSchema,
  sendMessageReqSchema,
  type Account,
  type AccountPhone,
  type AccountPlan,
  type AssistantUpdateReq,
  type AgendaItem,
  type AgendaNew,
  type AgendaParseRes,
  type AgendaPatchReq,
  type AgendaRes,
  type AuthStartReq,
  type AuthStartRes,
  type AuthVerifyReq,
  type AuthVerifyRes,
  type BoxRes,
  type Business,
  type BusinessPeriod,
  type BusinessReorderRes,
  type ConnectionDetail,
  type ConnectionForgetRes,
  type ConnectionPermissionReq,
  type ConnectionStartRes,
  type Connections,
  type Service,
  type DeviceControlReq,
  type DeviceControlRes,
  type DevicesRes,
  type Draft,
  type DraftActionReq,
  type DraftActionRes,
  type GreetingUpdateReq,
  type HistoryPage,
  type HistoryQuery,
  type Home,
  type Me,
  type Message,
  type MessagesPage,
  type MessagesChangedPage,
  type NotificationsUpdateReq,
  type PinResetVerifyReq,
  type PinSetReq,
  type PushTokenDeleteReq,
  type PushTokenReq,
  type RoutineRunRes,
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
  type VoiceSession,
} from '../transport';
import {
  agendaIn,
  defaultRange,
  FAKE_NOW,
  FAKE_TODAY,
  FAKE_TZ_MINUTES,
  leftoverOf,
  previewOf,
  toContractItem,
} from './agenda';
import { FakeClock } from './clock';
import { cardFromDevice } from '../devices';
import { accountFrom, initialAccountState, type FakeAccountState } from './account';
import { historyFrom, pageOf } from './activity';
import { businessFrom } from './business';
import { connectionsFrom, detailFrom, serviceFrom, startUrlOf, type FakeConnectionsContext } from './connections';
import { boxFrom, devicesFrom, toDevice, withoutGuardedActions } from './devices';
import { homeFrom } from './home';
import { draftFromOutgoing, SAMPLE_FILE_MEDIA_ID, SAMPLE_QR_MEDIA_ID, sampleHistory } from './history';
import { FakeScenario, sampleMe } from './scenario';
import { formatRupiah } from '../format';
import { VoiceChannel } from '../voiceSession';
import { attachFakeVoice, type FakeVoiceTurn } from './voice';

/** Jeda minta kode lagi di server tiruan. */
export const FAKE_RESEND_SEC = 60;
/** Kode yang selalu dibalas `kode_salah`, untuk mencoba layar "kodenya belum cocok". Kode 6 angka lain diterima. */
export const FAKE_WRONG_CODE = '000000';
/** Kode lupa PIN yang cocok di server tiruan (setelah `pinResetStart`); kode lain: `kode_salah`. */
export const FAKE_PIN_RESET_CODE = '123456';

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
  /** Keadaan awal penyimpanan contoh milik server tiruan ({@link FakeTransport.sample}). Bawaan: keadaan awal contoh 0b. */
  sample?: SampleState;
  /** Paling banyak pesan per `messagesChanged`, supaya `more` bisa dicoba. Bawaan batas kontrak. */
  afterLimit?: number;
  /** Jeda dari `startConnection` sampai layanan tersambung (pengguna selesai masuk di halaman resminya). Bawaan 300 ms. */
  connectMs?: number;
  /** Paket di Akun (nama, status, batas, harga) yang menimpa bawaan: Bisnis, aktif sampai 12 Jan 2027. */
  plan?: Partial<AccountPlan>;
  /** Mode Suara menyala untuk akun ini (`Me.features.voice`). Bawaan menyala. */
  voice?: boolean;
  /** HP yang terhubung di Akun. Bawaan: Pixel 8 (HP ini) dan Galaxy A54. */
  phones?: AccountPhone[];
}

type Timer = ReturnType<typeof setTimeout>;
type SimulatedFailure = Exclude<FailureCode, 'unauthorized' | 'kode_salah'>;

const AC_MODES: readonly string[] = ['Dingin', 'Kering', 'Kipas', 'Otomatis'];
const AC_FANS: readonly string[] = ['Pelan', 'Sedang', 'Kencang', 'Otomatis'];

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const invalid = (cause?: unknown) => new ApiFailure('server', { status: 400, error: 'tidak_valid', cause });
const notFound = () => new ApiFailure('server', { status: 404, error: 'tidak_ditemukan' });
const wrongStatus = () => new ApiFailure('server', { status: 409, error: 'status_draf' });
const wrongPin = () => new ApiFailure('pin_wrong', { status: 403, error: 'pin_salah' });
const pinNeeded = () => new ApiFailure('pin_required', { status: 428, error: 'pin_diperlukan' });
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
  /** Id HP yang dikeluarkan lewat `removePhone`, dari yang pertama. Hanya dicatat. */
  readonly removedPhones: string[] = [];
  /** Setiap tanda terima alarm lokal (`agendaAlarmAck`), dari yang pertama. Server asli lalu tidak mengirim pengingatnya lewat WhatsApp. */
  readonly alarmAcks: { id: string; scheduledFor: string }[] = [];
  /**
   * Data contoh (agenda, perangkat, kiriman, layanan, riwayat, usaha, tempat) milik server tiruan. Skenario dan Beranda
   * membaca dan menulis di sini; di mode contoh layar yang belum pindah ke kontrak melihat penyimpanan yang sama
   * (`ApiSampleProvider`).
   */
  readonly sample: SampleStore;

  private readonly clock: FakeClock;
  private readonly scenario: FakeScenario;
  private readonly thinkMs: number;
  private readonly latencyMs: number;
  private readonly requireSession: boolean;
  private readonly afterLimit: number;
  private readonly meValue: Me;
  private readonly waNumber: string | null;
  private pinEnabled: boolean;
  /** Kapan kode lupa PIN terakhir diminta (ms); 0 = belum ada yang menunggu. */
  private pinResetAsked = 0;
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
  /** Id kiriman yang sudah punya kartu di chat, dan status terakhirnya (untuk menangkap perubahan dari layar lain). */
  private readonly knownOutgoing = new Set<string>(Object.keys(initialOutgoing));
  private readonly outgoingStatus = new Map<string, string>();
  private readonly offSample: () => void;
  private homeTimer: Promise<void> | null = null;
  private homeSig = '';
  private homeRev = 0;
  /** `rev` Beranda terakhir yang disiarkan lewat stream (jawaban GET tidak menghitung: ia hanya membaca). */
  private homeSent = 0;
  private devicesTimer: Promise<void> | null = null;
  /** Keadaan perangkat yang terakhir dihitung: perangkat per id (JSON) dan kotak, untuk menghitung perubahan. */
  private deviceSnap = new Map<string, string>();
  private boxSnap = '';
  private devicesRev = 1;
  private businessTimer: Promise<void> | null = null;
  /** Usaha yang pernah diminta (`place|period`) dan isinya yang terakhir dihitung (JSON), untuk menghitung perubahan. */
  private readonly businessSeen = new Map<string, string>();
  private businessRev = 1;
  /** Barang → id kiriman pesanan yang dibuat "Pesan lagi" (dianggap terbuka selama masih `draft`). */
  private readonly stockDrafts = new Map<string, string>();
  private connectionsTimer: Promise<void> | null = null;
  /** Keadaan layanan yang terakhir disiarkan: per id (JSON), untuk menghitung perubahan. */
  private connectionsSnap = new Map<string, string>();
  private connectionsRev = 1;
  private readonly connectMs: number;
  /** Saat server tiruan dibuat: "terakhir dipakai" layanan dihitung mundur dari sini, jadi tidak berubah-ubah. */
  private readonly connectionsBase = Date.now();
  private readonly connectedAt = new Map<string, string>();
  /** Layanan tersambung yang aksesnya kedaluwarsa: perlu disambungkan ulang (`attention.action` `reconnect`). */
  private readonly needsReconnect = new Set<string>();
  /** Kemampuan yang diubah pengguna: `id:key` -> aktif. */
  private readonly capabilityOverrides = new Map<string, boolean>();
  private historyTimer: Promise<void> | null = null;
  /** Entri Riwayat yang terakhir disiarkan: per id (JSON), untuk menghitung perubahan. */
  private historySnap = new Map<string, string>();
  private historyRev = 1;
  private readonly accountState: FakeAccountState;
  private accountTimer: Promise<void> | null = null;
  private accountSnap = '';
  private accountRev = 1;
  private agendaTimer: Promise<void> | null = null;
  /** Keadaan agenda yang terakhir disiarkan: item per id (JSON) dan sisa tugas, untuk menghitung perubahan. */
  private agendaSnap = new Map<string, string>();
  private leftoverSnap = 'null';
  private agendaRev = 1;
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
  /** Ucapan contoh berikutnya untuk Mode Suara. */
  private voiceCursor = 0;

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
    this.connectMs = options.connectMs ?? 300;
    this.meValue = { ...sampleMe(this.clock), features: { voice: options.voice ?? true } };
    this.accountState = initialAccountState(this.clock, options);
    this.waNumber = options.waNumber === undefined ? FAKE_WA_NUMBER : options.waNumber;
    this.pinValue = options.security?.pin ?? null;
    this.pinEnabled = (options.security?.pinEnabled ?? false) && this.pinValue !== null;
    for (const message of copy(options.history ?? sampleHistory())) {
      this.msgSeq = Math.max(this.msgSeq, message.seq);
      this.msgRev = Math.max(this.msgRev, message.rev);
      this.store(message);
    }
    this.sample = createSampleStore(options.sample);
    // Keadaan AC yang sebenarnya ada di penyimpanan contoh, jadi "AC kamar gimana?" sama dengan Beranda.
    this.scenario.setAcReader(() => {
      const ac = deviceById(this.sample.getState(), MAIN_AC_ID);
      return { on: ac?.on ?? false, temp: ac?.ac?.temp ?? 24 };
    });
    for (const o of Object.values(this.sample.getState().outgoing)) this.outgoingStatus.set(o.id, o.status);
    this.offSample = this.sample.subscribe(() => this.onSampleChange());
    // Kiriman yang sudah ada di penyimpanan awal tapi belum punya kartu di chat.
    this.syncOutgoing();
    this.currentHome();
    this.homeSent = this.homeRev;
    this.snapshotAgenda();
    this.snapshotDevices();
    this.snapshotConnections();
    this.snapshotHistory();
    this.accountSnap = JSON.stringify(this.accountBase());
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
        if (reply.acChange) {
          const { on, temp } = reply.acChange;
          this.sample.dispatch({ type: 'setAc', deviceId: MAIN_AC_ID, on, temp, source: 'chat' });
        }
        this.emit({ type: 'thinking', runId, on: false });
      });
      return this.present(message);
    });
  }

  draftAction(id: string, req: DraftActionReq): Promise<DraftActionRes> {
    return this.call(true, () => this.runDraftAction(id, req));
  }

  private runDraftAction(id: string, req: DraftActionReq): DraftActionRes {
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
  }

  home(): Promise<Home> {
    return this.call(true, () => this.currentHome());
  }

  setPlace(place: string): Promise<Home> {
    return this.call(true, () => {
      const req = parse(placeReqSchema, { place });
      if (!(PLACES as readonly string[]).includes(req.place)) throw invalid();
      this.sample.dispatch({ type: 'setPlace', place: req.place as (typeof PLACES)[number] });
      return this.currentHome();
    });
  }

  agenda(range?: { from: string; to: string }): Promise<AgendaRes> {
    return this.call(true, () => {
      const { from, to } = range ?? defaultRange();
      const query = parse(agendaQuerySchema, { from, to });
      if (query.from! > query.to!) throw invalid();
      const state = this.sample.getState();
      return copy({
        items: agendaIn(state, query.from!, query.to!),
        leftover: leftoverOf(state),
        from: query.from!,
        to: query.to!,
        today: FAKE_TODAY,
        now: FAKE_NOW,
        tzOffsetMinutes: FAKE_TZ_MINUTES,
        rev: this.agendaRev,
      });
    });
  }

  agendaItem(id: string): Promise<AgendaItem> {
    return this.call(true, () => {
      const found = this.sample.getState().agenda.find((a) => a.id === id);
      if (!found) throw notFound();
      return copy(toContractItem(found));
    });
  }

  agendaParse(text: string): Promise<AgendaParseRes> {
    return this.call(true, () => {
      const req = parse(agendaParseReqSchema, { text });
      const preview = previewOf(req.text);
      if (!preview) throw new ApiFailure('not_understood', { status: 422, error: 'tidak_paham' });
      return preview;
    });
  }

  agendaAdd(item: AgendaNew): Promise<AgendaItem> {
    return this.call(true, () => {
      const req = parse(agendaAddReqSchema, { item });
      const { item: n } = req;
      this.sample.dispatch({
        type: 'addAgenda',
        item: {
          date: n.date,
          time: n.time,
          title: n.title,
          kind: n.kind,
          ...(n.way === 'alarm' || n.way === 'call' ? { way: n.way } : {}),
          ...(n.repeat ? { repeat: n.repeat } : {}),
          ...(n.note ? { note: n.note } : {}),
        },
      });
      return copy(toContractItem(this.sample.getState().agenda.at(-1)!));
    });
  }

  agendaPatch(id: string, req: AgendaPatchReq): Promise<AgendaItem> {
    return this.call(true, () => {
      const patch = parse(agendaPatchReqSchema, req);
      if (!this.sample.getState().agenda.some((a) => a.id === id)) throw notFound();
      if (patch.done !== undefined) this.sample.dispatch({ type: 'setDone', id, done: patch.done });
      if (patch.snoozeUntil !== undefined) {
        this.sample.dispatch({ type: 'snooze', id, until: patch.snoozeUntil });
      }
      return copy(toContractItem(this.sample.getState().agenda.find((a) => a.id === id)!));
    });
  }

  agendaLeftover(choice: 'today' | 'drop'): Promise<AgendaItem | null> {
    return this.call(true, () => {
      const req = parse(agendaLeftoverReqSchema, { choice });
      if (!this.sample.getState().leftover) throw notFound();
      this.sample.dispatch({ type: 'finishLeftover', choice: req.choice });
      return req.choice === 'today' ? copy(toContractItem(this.sample.getState().agenda.at(-1)!)) : null;
    });
  }

  agendaAlarmAck(id: string, scheduledFor: string): Promise<void> {
    return this.call(true, () => {
      const req = parse(alarmAckReqSchema, { scheduledFor });
      if (!this.sample.getState().agenda.some((a) => a.id === id)) throw notFound();
      this.alarmAcks.push({ id, scheduledFor: req.scheduledFor });
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
      const { pinEnabled, pin } = parse(securityUpdateReqSchema, req);
      if (pinEnabled && this.pinValue === null) throw invalid();
      // Mematikan permintaan PIN butuh PIN yang sekarang: tanpa itu, token yang sah saja tidak cukup.
      if (!pinEnabled && this.pinValue !== null && pin !== this.pinValue) throw wrongPin();
      this.pinEnabled = pinEnabled;
      this.scheduleAccount();
      return this.securityState();
    });
  }

  setPin(req: PinSetReq): Promise<SecurityRes> {
    return this.call(true, () => {
      const { pin, currentPin, enable } = parse(pinSetReqSchema, req);
      if (this.pinValue !== null) {
        if (currentPin === undefined) throw invalid();
        if (currentPin !== this.pinValue) throw wrongPin();
      }
      // Atomik: PIN dan permintaan PIN berubah bersama, atau tidak sama sekali.
      this.pinValue = pin;
      if (enable) this.pinEnabled = true;
      this.scheduleAccount();
      return this.securityState();
    });
  }

  pinResetStart(): Promise<AuthStartRes> {
    return this.call(true, () => {
      const left = Math.ceil((this.pinResetAsked + FAKE_RESEND_SEC * 1000 - this.clock.now()) / 1000);
      if (this.pinResetAsked > 0 && left > 0) {
        throw new ApiFailure('rate_limited', { status: 429, error: 'terlalu_sering', retryInSec: left });
      }
      this.pinResetAsked = this.clock.now();
      return { resendInSec: FAKE_RESEND_SEC };
    });
  }

  pinResetVerify(req: PinResetVerifyReq): Promise<SecurityRes> {
    return this.call(true, () => {
      const { code, pin } = parse(pinResetVerifyReqSchema, req);
      // Kode harus diminta lebih dulu; di server tiruan hanya FAKE_PIN_RESET_CODE yang cocok.
      if (this.pinResetAsked === 0 || code !== FAKE_PIN_RESET_CODE) {
        throw new ApiFailure('kode_salah', { status: 400, error: 'kode_salah' });
      }
      this.pinResetAsked = 0;
      this.pinValue = pin;
      this.scheduleAccount();
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

  devices(place?: string): Promise<DevicesRes> {
    return this.call(true, () => {
      const query = parse(devicesQuerySchema, { place });
      const state = this.sample.getState();
      const target = query.place ?? state.place;
      if (!(PLACES as readonly string[]).includes(target)) throw invalid();
      // Perubahan yang belum disiarkan dihitung dulu, jadi `rev` jawaban ini sudah memuatnya.
      this.flushDevices();
      return copy({ ...devicesFrom(state, target), rev: this.devicesRev });
    });
  }

  /**
   * Atur perangkat di penyimpanan contoh. Mematikan perangkat yang dijaga (kamera, kunci) saat PIN dihidupkan butuh
   * `pin`: tanpa `pin` 428 `pin_diperlukan`, `pin` salah 403 `pin_salah`. Perangkat yang tidak terjangkau tidak berubah
   * (jawabannya keadaan yang sebenarnya).
   */
  controlDevice(deviceId: string, req: DeviceControlReq): Promise<DeviceControlRes> {
    return this.call(true, (): DeviceControlRes => {
      const r = parse(deviceControlReqSchema, req);
      const found = deviceById(this.sample.getState(), deviceId);
      if (!found) throw notFound();
      const ac = found.kind === 'ac';
      if (!ac && (r.temp !== undefined || r.mode !== undefined || r.fan !== undefined)) throw invalid();
      if (r.level !== undefined && found.kind !== 'lampu') throw invalid();
      if (r.mode !== undefined && !AC_MODES.includes(r.mode)) throw invalid();
      if (r.fan !== undefined && !AC_FANS.includes(r.fan)) throw invalid();
      if (found.needsPin && r.on === false && this.pinEnabled) {
        if (r.pin === undefined) throw pinNeeded();
        if (r.pin !== this.pinValue) throw wrongPin();
      }
      if (ac) {
        this.sample.dispatch({
          type: 'setAc',
          deviceId,
          on: r.on,
          temp: r.temp,
          mode: r.mode as AcMode | undefined,
          fan: r.fan as AcFan | undefined,
          source: 'aplikasi',
        });
      } else {
        if (r.on !== undefined) this.sample.dispatch({ type: 'toggleDevice', id: deviceId, on: r.on });
        if (r.level !== undefined) this.sample.dispatch({ type: 'setLevel', id: deviceId, level: r.level });
      }
      const device = toDevice(deviceById(this.sample.getState(), deviceId)!);
      this.flushDevices();
      return copy({ device, card: cardFromDevice(device), rev: this.devicesRev });
    });
  }

  runRoutine(routineId: string, place?: string): Promise<RoutineRunRes> {
    return this.call(true, (): RoutineRunRes => {
      const req = parse(routineRunReqSchema, place === undefined ? {} : { place });
      const routine = ROUTINES.find((r) => r.id === routineId);
      if (!routine) throw notFound();
      const target = req.place ?? this.sample.getState().place;
      if (!(PLACES as readonly string[]).includes(target)) throw invalid();
      const before = new Map(this.sample.getState().devices.map((d) => [d.id, JSON.stringify(toDevice(d))]));
      // Rutinitas tidak menyentuh perangkat yang dijaga (buka kunci, kamera mati, alarm mati): dilewati dan disebut.
      const { allowed, skipped } = withoutGuardedActions(
        routineActions(routine, this.sample.getState(), target),
        this.sample.getState(),
      );
      for (const action of allowed) this.sample.dispatch(action);
      const devices = this.sample
        .getState()
        .devices.map(toDevice)
        .filter((d) => before.get(d.id) !== JSON.stringify(d));
      this.flushDevices();
      const note = skipped.length ? ` ${[...new Set(skipped)].join(', ')} tidak disentuh karena dijaga PIN.` : '';
      return copy({ devices, summary: routineDone(routine, target) + note, rev: this.devicesRev });
    });
  }

  setBoxMic(micOn: boolean): Promise<BoxRes> {
    return this.call(true, (): BoxRes => {
      const req = parse(boxReqSchema, { micOn });
      this.sample.dispatch({ type: 'setBoxMic', on: req.micOn });
      this.flushDevices();
      return copy({ box: boxFrom(this.sample.getState()), rev: this.devicesRev });
    });
  }

  business(place?: string, period?: BusinessPeriod): Promise<Business> {
    return this.call(true, () => {
      const query = parse(businessQuerySchema, { place, period });
      const target = query.place ?? this.sample.getState().place;
      if (!(PLACES as readonly string[]).includes(target)) throw invalid();
      const range = query.period ?? 'hari';
      // Perubahan yang belum disiarkan dihitung dulu, jadi `rev` jawaban ini sudah memuatnya.
      this.flushBusiness();
      const base = businessFrom(target, range, this.reorderOf);
      this.businessSeen.set(`${target}|${range}`, JSON.stringify(base));
      return copy({ ...base, rev: this.businessRev });
    });
  }

  /**
   * Buat draf pesanan ke pemasok barang `stockId` di penyimpanan contoh; kartunya muncul di chat lewat
   * {@link syncOutgoing}. Selama drafnya (atau draf lain ke pemasok yang sama) masih menunggu, jawabannya draf itu.
   */
  businessReorder(stockId: string): Promise<BusinessReorderRes> {
    return this.call(true, (): BusinessReorderRes => {
      const req = parse(businessReorderReqSchema, { stockId });
      const stock = STOCK[req.stockId];
      const template = stockOrderDrafts[req.stockId];
      if (!stock || !template) throw notFound();
      const open = this.reorderOf(stock.id) ?? draftFor(this.sample.getState(), template.to)?.id;
      let draftId = open;
      if (!draftId) {
        const before = new Set(Object.keys(this.sample.getState().outgoing));
        this.sample.dispatch({ type: 'addDraft', draft: template });
        draftId = Object.keys(this.sample.getState().outgoing).find((id) => !before.has(id))!;
      }
      this.stockDrafts.set(stock.id, draftId);
      const message = this.thread.find((m) =>
        m.parts.some((p) => p.type === 'card' && p.card.kind === 'draft' && p.card.draft.id === draftId),
      );
      if (!message) throw new ApiFailure('server', { status: 500, error: 'server' });
      this.scheduleBusiness();
      return { draftId, messageId: message.id };
    });
  }

  connections(): Promise<Connections> {
    return this.call(true, () => {
      // Perubahan yang belum disiarkan dihitung dulu, jadi `rev` jawaban ini sudah memuatnya.
      this.flushConnections();
      return copy({ ...connectionsFrom(this.sample.getState(), this.connectionsContext()), rev: this.connectionsRev });
    });
  }

  connectionDetail(id: string): Promise<ConnectionDetail> {
    return this.call(true, () => {
      const detail = detailFrom(this.sample.getState(), id, this.connectionsContext(), this.capabilityOverrides);
      if (!detail) throw notFound();
      return copy(detail);
    });
  }

  setConnectionPermission(id: string, req: ConnectionPermissionReq): Promise<ConnectionDetail> {
    return this.call(true, () => {
      const r = parse(connectionPermissionReqSchema, req);
      const current = this.sample.getState().services.find((x) => x.id === id);
      if (!current) throw notFound();
      this.sample.dispatch({ type: 'setPermission', id, permission: r.permission === 'baca_tulis' ? 'act' : 'read' });
      for (const c of r.capabilities ?? []) this.capabilityOverrides.set(`${id}:${c.key}`, c.enabled);
      return copy(detailFrom(this.sample.getState(), id, this.connectionsContext(), this.capabilityOverrides)!);
    });
  }

  forgetConnection(id: string): Promise<ConnectionForgetRes> {
    return this.call(true, (): ConnectionForgetRes => {
      const detail = detailFrom(this.sample.getState(), id, this.connectionsContext(), this.capabilityOverrides);
      if (!detail || detail.service.status !== 'connected') throw notFound();
      const forgotten = detail.memoryCount ?? 0;
      this.sample.dispatch({ type: 'forget', id });
      return { ok: true, forgotten };
    });
  }

  disconnectConnection(id: string): Promise<void> {
    return this.call(true, () => {
      if (!this.sample.getState().services.some((x) => x.id === id)) throw notFound();
      this.sample.dispatch({ type: 'disconnect', id });
      this.connectedAt.delete(id);
      this.needsReconnect.delete(id);
    });
  }

  /**
   * Mulai menyambungkan: alamat halaman masuk tiruan. Layanan dianggap selesai masuk {@link FakeOptions.connectMs}
   * kemudian: ia tersambung di penyimpanan contoh, jadi event `connection` dan `home` (simpul cincin baru) menyusul.
   */
  startConnection(id: string): Promise<ConnectionStartRes> {
    return this.call(true, (): ConnectionStartRes => {
      const state = this.sample.getState();
      const service = serviceFrom(state, id, this.connectionsContext());
      if (!service) throw notFound();
      // Yang sudah tersambung boleh `start` hanya kalau perlu disambungkan ulang.
      const reconnect = service.status === 'connected' && service.attention?.action === 'reconnect';
      if ((service.status === 'connected' && !reconnect) || service.status === 'soon' || id === 'kotak')
        throw invalid();
      this.later(this.connectMs, () => {
        if (reconnect) {
          this.needsReconnect.delete(id);
          this.scheduleConnections();
          return;
        }
        this.connectedAt.set(id, this.clock.iso());
        this.sample.dispatch({ type: 'connect', id });
      });
      return { url: startUrlOf(id, `contoh-${++this.counter}`), callbackScheme: 'sekretarisai' };
    });
  }

  /** Untuk tes dan contoh: akses layanan tersambung ini kedaluwarsa, jadi perlu disambungkan ulang. */
  expireConnection(id: string) {
    if (!this.sample.getState().services.some((s) => s.id === id)) return;
    this.needsReconnect.add(id);
    this.scheduleConnections();
  }

  history(query: Partial<Pick<HistoryQuery, 'kind' | 'before' | 'limit'>> = {}): Promise<HistoryPage> {
    return this.call(true, (): HistoryPage => {
      const q = parse(historyQuerySchema, query);
      // Perubahan yang belum disiarkan dihitung dulu, jadi `rev` jawaban ini sudah memuatnya.
      this.flushHistory();
      const page = pageOf(this.historyAll(), q);
      return copy({ ...page, rev: this.historyRev, now: this.clock.iso() });
    });
  }

  account(): Promise<Account> {
    return this.call(true, () => this.accountNow());
  }

  setAssistant(req: AssistantUpdateReq): Promise<Account> {
    return this.call(true, () => {
      const r = parse(assistantUpdateReqSchema, req);
      if (r.name !== undefined) {
        const name = assistantNameSchema.safeParse(r.name);
        if (!name.success) throw new ApiFailure('invalid_name', { status: 400, error: 'nama_tidak_valid' });
        this.meValue.assistantName = name.data;
      }
      if (r.style !== undefined) this.accountState.assistantStyle = r.style;
      return this.accountNow();
    });
  }

  setGreeting(req: GreetingUpdateReq): Promise<Account> {
    return this.call(true, () => {
      const r = parse(greetingUpdateReqSchema, req);
      const time = r.time ?? this.accountState.greeting.time;
      this.accountState.greeting = { daily: r.daily, ...(time ? { time } : {}) };
      return this.accountNow();
    });
  }

  setNotifications(req: NotificationsUpdateReq): Promise<Account> {
    return this.call(true, () => {
      const r = parse(notificationsUpdateReqSchema, req);
      this.accountState.notifications = { ...this.accountState.notifications, ...r };
      return this.accountNow();
    });
  }

  removePhone(id: string): Promise<Account> {
    return this.call(true, () => {
      const phone = this.accountState.phones.find((p) => p.id === id);
      if (!phone) throw notFound();
      // HP ini keluar lewat Keluar (yang juga mencabut tokennya), bukan dari daftar.
      if (phone.current) throw invalid();
      this.accountState.phones = this.accountState.phones.filter((p) => p.id !== id);
      this.removedPhones.push(id);
      return this.accountNow();
    });
  }

  openVoice(): VoiceSession {
    const channel = new VoiceChannel();
    attachFakeVoice(channel, {
      later: (ms, run) => this.later(ms, run),
      cancel: (timer) => this.cancelTimer(timer),
      thinkMs: this.thinkMs,
      nextSentence: () => VOICE_UTTERANCES[this.voiceCursor++ % VOICE_UTTERANCES.length]!,
      availability: async () => {
        if (this.offline) return 'network';
        if (this.revoked || (this.requireSession && !(await this.session.get()))) {
          await this.unauthorized();
          return 'unauthorized';
        }
        return 'ok';
      },
      turn: (spoken) => this.voiceTurn(spoken),
    });
    return channel;
  }

  /** Satu giliran Mode Suara: ucapan dan balasannya masuk utas chat (bertanda suara), perintahnya dijalankan skenario. */
  private voiceTurn(spoken: string): FakeVoiceTurn {
    const said = this.store({
      id: this.nextId(),
      seq: ++this.msgSeq,
      rev: ++this.msgRev,
      at: this.clock.iso(),
      from: 'user',
      via: 'app',
      voice: true,
      parts: [{ type: 'text', text: spoken }],
    });
    this.emit({ type: 'message', message: this.present(said) });
    // "kirim ke Pak Budi, ..." dibaca seperti "balas Pak Budi, ..."; "bayar ..." seperti pembelian token.
    const text = /\bkirim\s+ke\b/i.test(spoken)
      ? spoken.replace(/^.*?\bkirim\s+ke\b/i, 'balas')
      : /\bbayar\b/i.test(spoken) && !/\btoken\b/i.test(spoken)
        ? `token ${spoken}`
        : spoken;
    const reply = this.scenario.reply({ text });
    for (const draft of reply.drafts) this.drafts.set(draft.id, draft);
    const stored = reply.messages.map((parts) => this.receive({ from: 'assistant', via: 'app', voice: true, parts }));
    if (reply.acChange) {
      const { on, temp } = reply.acChange;
      this.sample.dispatch({ type: 'setAc', deviceId: MAIN_AC_ID, on, temp, source: 'suara' });
    }
    const replyText = stored.flatMap((m) => m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : []))).join(' ');
    let confirm: FakeVoiceTurn['confirm'];
    for (const m of stored) {
      for (const p of m.parts) {
        if (!confirm && p.type === 'card' && (p.card.kind === 'payment' || p.card.kind === 'draft')) {
          confirm = { card: p.card, messageId: m.id };
        }
      }
    }
    const first = stored[0]!;
    // Kartu pembayaran tidak membawa kalimat; yang diucapkan menyebut nominalnya dan meminta ketukan.
    const spokenReply =
      replyText ||
      (confirm?.card.kind === 'payment'
        ? `${confirm.card.title} ${formatRupiah(confirm.card.amountRp)}. Sudah benar? Ketuk Ya, benar kalau sudah.`
        : 'Baik.');
    return { replyText: spokenReply, messageId: first.id, ...(confirm ? { confirm } : {}) };
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
    this.offSample();
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
  receive(input: Pick<Message, 'from' | 'via' | 'parts'> & { voice?: boolean }): Message {
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

  /** Mulai sekarang, draf yang selesai ditahan menjadi `failed` (pengiriman gagal), bukan `sent`. */
  failHeldSends(on = true) {
    this.failHeld = on;
  }

  // ---- Penyimpanan contoh ----

  /**
   * Draf yang berubah di chat diteruskan ke kiriman yang sama di penyimpanan contoh (`sendDraft`, `markSent`,
   * `cancelSend`, `discardDraft`, `editDraft`), jadi Riwayat dan Beranda ikut berubah. Draf tanpa kiriman di
   * penyimpanan (balasan dari skenario) tidak diteruskan ke mana pun.
   */
  private mirrorDraft(draft: Draft) {
    const o = this.sample.getState().outgoing[draft.id];
    if (!o) return;
    if (draft.status === 'held' && o.status === 'draft') {
      this.sample.dispatch({ type: 'sendDraft', id: o.id });
    } else if (draft.status === 'sent' && o.status === 'held') {
      this.sample.dispatch({ type: 'markSent', id: o.id });
    } else if (draft.status === 'cancelled' && o.status === 'held') {
      this.sample.dispatch({ type: 'cancelSend', id: o.id });
    } else if (draft.status === 'cancelled' && o.status === 'draft') {
      this.sample.dispatch({ type: 'discardDraft', id: o.id });
    } else if (draft.status === 'draft' && o.status === 'draft' && draft.text !== o.text) {
      this.sample.dispatch({ type: 'editDraft', id: o.id, text: draft.text });
    }
  }

  private onSampleChange() {
    this.syncOutgoing();
    this.scheduleHome();
    this.scheduleAgenda();
    this.scheduleDevices();
    this.scheduleBusiness();
    this.scheduleConnections();
    this.scheduleHistory();
    this.scheduleAccount();
  }

  /**
   * Arah sebaliknya: kiriman baru dari layar lain ("Pesan lagi" di Usaha) menjadi pesan asisten berisi kartu draf, dan
   * Batalkan di Riwayat membatalkan drafnya di chat.
   */
  private syncOutgoing() {
    for (const o of Object.values(this.sample.getState().outgoing)) {
      if (!this.knownOutgoing.has(o.id)) {
        this.knownOutgoing.add(o.id);
        this.receive({
          from: 'assistant',
          via: 'app',
          parts: [
            { type: 'text', text: draftIntro(o.what) },
            { type: 'card', card: { kind: 'draft', draft: draftFromOutgoing(o) } },
          ],
        });
      }
      const before = this.outgoingStatus.get(o.id);
      this.outgoingStatus.set(o.id, o.status);
      if (before === 'held' && o.status === 'cancelled' && this.drafts.get(o.id)?.status === 'held') {
        try {
          this.runDraftAction(o.id, { action: 'cancel' });
        } catch {
          // Draf sudah berubah di tempat lain: tidak ada yang perlu dibatalkan.
        }
      }
    }
  }

  // ---- Beranda ----

  /** Beranda sekarang. `rev` naik hanya kalau isinya berbeda dari penghitungan sebelumnya. */
  private currentHome(): Home {
    const base = homeFrom(this.sample.getState(), user.name);
    const sig = JSON.stringify(base);
    if (sig !== this.homeSig) {
      this.homeSig = sig;
      this.homeRev += 1;
    }
    return copy({ ...base, rev: this.homeRev });
  }

  /** Perubahan penyimpanan dalam satu giliran digabung menjadi satu event `home` (hanya kalau Beranda berubah). */
  private scheduleHome() {
    if (this.homeTimer) return;
    this.homeTimer = Promise.resolve().then(() => {
      this.homeTimer = null;
      const home = this.currentHome();
      // Sudah dibaca lewat GET atau PUT pun tetap disiarkan, supaya koneksi lain (dan layar yang lain) ikut.
      if (home.rev > this.homeSent) {
        this.homeSent = home.rev;
        this.emit({ type: 'home', home });
      }
    });
  }

  // ---- Perangkat ----

  private devicesSnapshot(): { devices: Map<string, string>; box: string } {
    const state = this.sample.getState();
    return {
      devices: new Map(state.devices.map((d) => [d.id, JSON.stringify(toDevice(d))])),
      box: JSON.stringify(boxFrom(state)),
    };
  }

  private snapshotDevices() {
    const snap = this.devicesSnapshot();
    this.deviceSnap = snap.devices;
    this.boxSnap = snap.box;
  }

  /** Hitung perubahan perangkat sejak hitungan terakhir; kalau ada, naikkan `rev` dan siarkan satu event `device`. */
  private flushDevices() {
    const before = this.deviceSnap;
    const boxBefore = this.boxSnap;
    const now = this.devicesSnapshot();
    const devices = [...now.devices]
      .filter(([id, json]) => before.get(id) !== json)
      .map(([, json]) => JSON.parse(json));
    const boxChanged = now.box !== boxBefore;
    this.deviceSnap = now.devices;
    this.boxSnap = now.box;
    if (devices.length === 0 && !boxChanged) return;
    this.devicesRev += 1;
    this.emit({
      type: 'device',
      ...(devices.length ? { devices } : {}),
      ...(boxChanged ? { box: JSON.parse(now.box) } : {}),
      rev: this.devicesRev,
    });
  }

  /** Perubahan penyimpanan dalam satu giliran digabung menjadi satu event `device` (hanya kalau ada yang berubah). */
  private scheduleDevices() {
    if (this.devicesTimer) return;
    this.devicesTimer = Promise.resolve().then(() => {
      this.devicesTimer = null;
      this.flushDevices();
    });
  }

  // ---- Usaha ----

  /** Id kiriman pesanan untuk `stockId` yang masih menunggu persetujuan. */
  private readonly reorderOf = (stockId: string): string | undefined => {
    const id = this.stockDrafts.get(stockId);
    return id !== undefined && this.sample.getState().outgoing[id]?.status === 'draft' ? id : undefined;
  };

  /** Hitung ulang Usaha yang pernah diminta; yang berubah disiarkan satu per satu dengan `rev` yang sama (naik sekali). */
  private flushBusiness() {
    const changed: { key: string; json: string }[] = [];
    for (const [key, before] of this.businessSeen) {
      const [place, period] = key.split('|') as [string, BusinessPeriod];
      const json = JSON.stringify(businessFrom(place, period, this.reorderOf));
      if (json !== before) changed.push({ key, json });
    }
    if (changed.length === 0) return;
    this.businessRev += 1;
    for (const { key, json } of changed) {
      this.businessSeen.set(key, json);
      this.emit({
        type: 'business',
        business: { ...(JSON.parse(json) as Omit<Business, 'rev'>), rev: this.businessRev },
      });
    }
  }

  /** Perubahan penyimpanan dalam satu giliran digabung menjadi satu putaran event `business`. */
  private scheduleBusiness() {
    if (this.businessTimer) return;
    this.businessTimer = Promise.resolve().then(() => {
      this.businessTimer = null;
      this.flushBusiness();
    });
  }

  // ---- Terhubung ----

  private connectionsContext(): FakeConnectionsContext {
    return { base: this.connectionsBase, connectedAt: this.connectedAt, reconnect: this.needsReconnect };
  }

  private connectionsSnapshot(): Map<string, Service> {
    const all = connectionsFrom(this.sample.getState(), this.connectionsContext());
    return new Map([...all.connected, ...all.catalog, ...all.formerly].map((s) => [s.id, s]));
  }

  private snapshotConnections() {
    this.connectionsSnap = new Map([...this.connectionsSnapshot()].map(([id, s]) => [id, JSON.stringify(s)]));
  }

  /** Hitung layanan yang berubah sejak hitungan terakhir; kalau ada, naikkan `rev` sekali dan siarkan satu event per layanan. */
  private flushConnections() {
    const before = this.connectionsSnap;
    const now = this.connectionsSnapshot();
    const changed = [...now].filter(([id, s]) => before.get(id) !== JSON.stringify(s));
    const removed = [...before.keys()].filter((id) => !now.has(id));
    this.snapshotConnections();
    if (changed.length === 0 && removed.length === 0) return;
    this.connectionsRev += 1;
    for (const [, service] of changed) this.emit({ type: 'connection', service, rev: this.connectionsRev });
    for (const id of removed) {
      const service = JSON.parse(before.get(id)!) as Service;
      this.emit({ type: 'connection', service, removed: true, rev: this.connectionsRev });
    }
  }

  /** Perubahan penyimpanan dalam satu giliran digabung menjadi satu putaran event `connection`. */
  private scheduleConnections() {
    if (this.connectionsTimer) return;
    this.connectionsTimer = Promise.resolve().then(() => {
      this.connectionsTimer = null;
      this.flushConnections();
    });
  }

  // ---- Riwayat ----

  private historyAll() {
    return historyFrom(this.sample.getState(), this.drafts);
  }

  private snapshotHistory() {
    this.historySnap = new Map(this.historyAll().map((e) => [e.id, JSON.stringify(e)]));
  }

  /** Hitung entri yang baru atau berubah; kalau ada, naikkan `rev` sekali dan siarkan satu event `history` per entri. */
  private flushHistory() {
    const before = this.historySnap;
    const changed = this.historyAll().filter((e) => before.get(e.id) !== JSON.stringify(e));
    this.snapshotHistory();
    if (changed.length === 0) return;
    this.historyRev += 1;
    // Dari yang tertua, supaya penerima yang menaruh entri baru di depan menyusunnya dengan benar.
    for (const entry of changed.reverse()) this.emit({ type: 'history', entry, rev: this.historyRev });
  }

  private scheduleHistory() {
    if (this.historyTimer) return;
    this.historyTimer = Promise.resolve().then(() => {
      this.historyTimer = null;
      this.flushHistory();
    });
  }

  // ---- Akun ----

  private accountBase(): Omit<Account, 'rev'> {
    return accountFrom(
      copy(this.meValue),
      this.accountState,
      this.securityState(),
      this.sample.getState(),
      this.connectionsContext(),
    );
  }

  /** Hitung perubahan Akun; kalau ada, naikkan `rev` dan siarkan satu event `account`. */
  private flushAccount() {
    const base = this.accountBase();
    const json = JSON.stringify(base);
    if (json === this.accountSnap) return;
    this.accountSnap = json;
    this.accountRev += 1;
    this.emit({ type: 'account', account: { ...base, rev: this.accountRev } });
  }

  private accountNow(): Account {
    this.flushAccount();
    return copy({ ...this.accountBase(), rev: this.accountRev });
  }

  private scheduleAccount() {
    if (this.accountTimer) return;
    this.accountTimer = Promise.resolve().then(() => {
      this.accountTimer = null;
      this.flushAccount();
    });
  }

  // ---- Agenda ----

  private agendaSnapshot(): { items: Map<string, string>; leftover: string } {
    const state = this.sample.getState();
    return {
      items: new Map(state.agenda.map((a) => [a.id, JSON.stringify(toContractItem(a))])),
      leftover: JSON.stringify(leftoverOf(state)),
    };
  }

  private snapshotAgenda() {
    const snap = this.agendaSnapshot();
    this.agendaSnap = snap.items;
    this.leftoverSnap = snap.leftover;
  }

  /** Perubahan agenda dalam satu giliran digabung menjadi satu event `agenda` (hanya kalau ada yang berubah). */
  private scheduleAgenda() {
    if (this.agendaTimer) return;
    this.agendaTimer = Promise.resolve().then(() => {
      this.agendaTimer = null;
      const before = this.agendaSnap;
      const leftoverBefore = this.leftoverSnap;
      const now = this.agendaSnapshot();
      const items = [...now.items]
        .filter(([id, json]) => before.get(id) !== json)
        .map(([, json]) => JSON.parse(json) as AgendaItem);
      const removed = [...before.keys()].filter((id) => !now.items.has(id));
      const leftoverChanged = now.leftover !== leftoverBefore;
      this.agendaSnap = now.items;
      this.leftoverSnap = now.leftover;
      if (items.length === 0 && removed.length === 0 && !leftoverChanged) return;
      this.agendaRev += 1;
      this.emit({
        type: 'agenda',
        ...(items.length ? { items } : {}),
        ...(removed.length ? { removed } : {}),
        ...(leftoverChanged ? { leftover: JSON.parse(now.leftover) as AgendaItem | null } : {}),
        rev: this.agendaRev,
      });
    });
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
    this.mirrorDraft(next);
    this.scheduleHistory();
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
        this.mirrorDraft(done);
        this.scheduleHistory();
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
