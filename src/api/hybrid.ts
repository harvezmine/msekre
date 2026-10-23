import { planFromMe } from './account';
import type {
  Account,
  AgendaItem,
  AgendaNew,
  AgendaParseRes,
  AgendaPatchReq,
  AgendaRes,
  AssistantUpdateReq,
  AuthStartReq,
  AuthStartRes,
  AuthVerifyReq,
  AuthVerifyRes,
  BoxRes,
  Business,
  BusinessPeriod,
  BusinessReorderRes,
  ConnectionDetail,
  ConnectionForgetRes,
  ConnectionPermissionReq,
  ConnectionStartRes,
  Connections,
  DeviceControlReq,
  DeviceControlRes,
  DeviceFavoriteRes,
  DevicesRes,
  DraftActionReq,
  DraftActionRes,
  GreetingUpdateReq,
  HistoryPage,
  HistoryQuery,
  Home,
  Me,
  Message,
  MessagesChangedPage,
  MessagesPage,
  NotificationsUpdateReq,
  PinResetVerifyReq,
  PinSetReq,
  PushTokenDeleteReq,
  PushTokenReq,
  RoutineRunRes,
  SecurityRes,
  SecurityUpdateReq,
  SendMessageReq,
  StreamEvent,
} from './contract';
import type { FakeTransport } from './fake/FakeTransport';
import { isSampleMediaId } from './fake/history';
import type { Session } from './session';
import type { ConnectionStatus, MediaSource, Transport, Unsubscribe, VoiceSession } from './transport';

/**
 * Ke mana satu method `HybridTransport` dikirim:
 * - `akun`: server asli (`HttpTransport`);
 * - `contoh`: server tiruan di aplikasi (`FakeTransport`), untuk layar yang belum disediakan server;
 * - `gabung`: keduanya (stream yang digabung, dan melepas keduanya);
 * - `pilah`: menurut id. Yang milik utas asli ke server asli, yang milik data contoh ke server tiruan.
 */
export type HybridRoute = 'akun' | 'contoh' | 'gabung' | 'pilah';

/** Semua method `Transport` (tanpa `mode`, yang bukan method). */
export type TransportMethod = Exclude<keyof Transport, 'mode'>;

/**
 * Tabel jalur mode `akun`. Setiap method `Transport` wajib tercantum (diperiksa `tsc` lewat `satisfies` dan tes
 * `api-hybrid`), supaya method baru tidak diam-diam jatuh ke salah satu sisi.
 *
 * Yang sudah disediakan server (Fase 1b-mini, `docs/app-api.md` di repo server): masuk, `GET /me`, utas chat, media,
 * stream, Mode Suara, token notifikasi, dan Agenda (`/agenda`, termasuk tanda terima alarm dan event `agenda`). Sisanya
 * dibalas 501 oleh server, jadi di sini memakai data contoh. `POST /agenda/parse` yang masih 501 tidak jatuh ke data
 * contoh: lembar Tambah lalu mengirim kalimatnya ke asisten lewat chat.
 */
export const HYBRID_ROUTES = {
  authStart: 'akun',
  authVerify: 'akun',
  logout: 'akun',
  me: 'akun',
  messages: 'akun',
  messagesChanged: 'akun',
  send: 'akun',
  // Kartu draf di utas asli (server belum mengirimnya) ke server; draf contoh (Riwayat, Usaha) ke server tiruan.
  draftAction: 'pilah',
  registerPushToken: 'akun',
  unregisterPushToken: 'akun',
  security: 'contoh',
  setSecurity: 'contoh',
  setPin: 'contoh',
  verifyPin: 'contoh',
  pinResetStart: 'contoh',
  pinResetVerify: 'contoh',
  // Beranda contoh dengan nama asli dari `GET /me`.
  home: 'contoh',
  setPlace: 'contoh',
  devices: 'contoh',
  controlDevice: 'contoh',
  setDeviceFavorite: 'contoh',
  runRoutine: 'contoh',
  setBoxMic: 'contoh',
  business: 'contoh',
  businessReorder: 'contoh',
  connections: 'contoh',
  connectionDetail: 'contoh',
  setConnectionPermission: 'contoh',
  forgetConnection: 'contoh',
  disconnectConnection: 'contoh',
  startConnection: 'contoh',
  history: 'contoh',
  // Akun contoh dengan nama, nomor, paket, dan nama asisten asli dari `GET /me`.
  account: 'contoh',
  setAssistant: 'contoh',
  setGreeting: 'contoh',
  setNotifications: 'contoh',
  removePhone: 'contoh',
  // Agenda asli: pengingat dan alarm di HP milik pemilik akun, bukan contoh.
  agenda: 'akun',
  agendaItem: 'akun',
  agendaParse: 'akun',
  agendaAdd: 'akun',
  agendaPatch: 'akun',
  agendaLeftover: 'akun',
  agendaAlarmAck: 'akun',
  openVoice: 'akun',
  // Media pesan asli dan suara balasan ke server; QRIS, laporan, dan gambar kamera contoh ke server tiruan.
  mediaUrl: 'pilah',
  subscribe: 'gabung',
  dispose: 'gabung',
} as const satisfies Record<TransportMethod, HybridRoute>;

/**
 * Asal setiap jenis event stream yang diteruskan ke pendengar: utas chat dari server asli, data layar contoh dari server
 * tiruan. Satu jenis hanya dari satu sisi, jadi tidak ada event yang sampai dua kali. `null` = tidak pernah diteruskan.
 */
export const HYBRID_EVENTS = {
  message: 'akun',
  draft: 'akun',
  thinking: 'akun',
  home: 'contoh',
  agenda: 'akun',
  device: 'contoh',
  business: 'contoh',
  connection: 'contoh',
  history: 'contoh',
  account: 'contoh',
  ping: null,
} as const satisfies Record<StreamEvent['type'], 'akun' | 'contoh' | null>;

/** Beranda contoh yang menyapa pemilik akun asli (bukan nama contoh). */
function homeFor(home: Home, me: Me | null): Home {
  return { ...home, greetingName: me?.name?.trim() || null };
}

/** Akun contoh dengan siapa pemiliknya yang asli: nama, nomor, paket, dan nama asisten dari `GET /me`. */
function accountFor(account: Account, me: Me): Account {
  return {
    ...account,
    me,
    plan: planFromMe(me.plan),
    assistant: { ...account.assistant, name: me.assistantName },
  };
}

const sameIdentity = (a: Me | null, b: Me) =>
  a !== null &&
  a.id === b.id &&
  a.name === b.name &&
  a.assistantName === b.assistantName &&
  a.phone === b.phone &&
  a.plan.name === b.plan.name &&
  a.plan.activeUntil === b.plan.activeUntil;

/** Id draf di kartu sebuah pesan. */
function draftIds(message: Message): string[] {
  return message.parts.flatMap((p) => (p.type === 'card' && p.card.kind === 'draft' ? [p.card.draft.id] : []));
}

interface Listener {
  onEvent: (event: StreamEvent) => void;
}

/**
 * Mode `akun`: akun asli pengguna, dengan chat dan Mode Suara dari server asli dan layar yang belum disediakan server
 * dari data contoh (lihat {@link HYBRID_ROUTES}). Sesinya milik server asli: 401 dari mana pun mengeluarkan pengguna
 * persis seperti mode `server`. Server tiruan di dalamnya tidak meminta sesi.
 *
 * Siapa pemilik akunnya (nama, nomor, paket, nama asisten) selalu dari `GET /me`, juga di Beranda dan Akun yang isinya
 * contoh, supaya pengguna asli tidak disapa dengan nama orang lain.
 */
export class HybridTransport implements Transport {
  readonly mode = 'akun' as const;
  /** `GET /me` terakhir dari server asli, atau `null` sebelum terbaca (dan setelah keluar). */
  private identity: Me | null = null;
  private identityLoading: Promise<Me> | null = null;
  /** Id draf yang pernah datang di utas asli: aksinya ke server asli. */
  private readonly realDrafts = new Set<string>();
  private readonly listeners = new Set<Listener>();
  private readonly offSession: () => void;

  constructor(
    /** Server asli (`HttpTransport`). */
    readonly real: Transport,
    /** Server tiruan untuk layar contoh. */
    readonly fake: FakeTransport,
    session: Session,
  ) {
    this.offSession = session.onChange((token) => {
      if (token !== null) return;
      // Keluar, atau sesi dicabut server: pemilik berikutnya bisa orang lain.
      this.identity = null;
      this.identityLoading = null;
      this.realDrafts.clear();
    });
  }

  // ---- Server asli ----

  authStart(req: AuthStartReq): Promise<AuthStartRes> {
    return this.real.authStart(req);
  }

  async authVerify(req: AuthVerifyReq): Promise<AuthVerifyRes> {
    const res = await this.real.authVerify(req);
    this.noteIdentity(res.user);
    return res;
  }

  logout(): Promise<void> {
    this.identity = null;
    this.identityLoading = null;
    this.realDrafts.clear();
    return this.real.logout();
  }

  async me(): Promise<Me> {
    const me = await this.real.me();
    this.noteIdentity(me);
    return me;
  }

  async messages(before?: number): Promise<MessagesPage> {
    const page = await this.real.messages(before);
    this.noteMessages(page.items);
    return page;
  }

  async messagesChanged(changedAfter: number): Promise<MessagesChangedPage> {
    const page = await this.real.messagesChanged(changedAfter);
    this.noteMessages(page.items);
    return page;
  }

  async send(req: SendMessageReq): Promise<Message> {
    const message = await this.real.send(req);
    this.noteMessages([message]);
    return message;
  }

  draftAction(id: string, req: DraftActionReq): Promise<DraftActionRes> {
    return this.realDrafts.has(id) ? this.real.draftAction(id, req) : this.fake.draftAction(id, req);
  }

  registerPushToken(req: PushTokenReq): Promise<void> {
    return this.real.registerPushToken(req);
  }

  unregisterPushToken(req: PushTokenDeleteReq): Promise<void> {
    return this.real.unregisterPushToken(req);
  }

  openVoice(): VoiceSession {
    return this.real.openVoice();
  }

  mediaUrl(mediaId: string): Promise<MediaSource> {
    return isSampleMediaId(mediaId) ? this.fake.mediaUrl(mediaId) : this.real.mediaUrl(mediaId);
  }

  agenda(range?: { from: string; to: string }): Promise<AgendaRes> {
    return this.real.agenda(range);
  }

  agendaItem(id: string): Promise<AgendaItem> {
    return this.real.agendaItem(id);
  }

  agendaParse(text: string): Promise<AgendaParseRes> {
    return this.real.agendaParse(text);
  }

  agendaAdd(item: AgendaNew): Promise<AgendaItem> {
    return this.real.agendaAdd(item);
  }

  agendaPatch(id: string, req: AgendaPatchReq): Promise<AgendaItem> {
    return this.real.agendaPatch(id, req);
  }

  agendaLeftover(choice: 'today' | 'drop'): Promise<AgendaItem | null> {
    return this.real.agendaLeftover(choice);
  }

  agendaAlarmAck(id: string, scheduledFor: string): Promise<void> {
    return this.real.agendaAlarmAck(id, scheduledFor);
  }

  // ---- Data contoh ----

  security(): Promise<SecurityRes> {
    return this.fake.security();
  }

  setSecurity(req: SecurityUpdateReq): Promise<SecurityRes> {
    return this.fake.setSecurity(req);
  }

  setPin(req: PinSetReq): Promise<SecurityRes> {
    return this.fake.setPin(req);
  }

  verifyPin(pin: string): Promise<boolean> {
    return this.fake.verifyPin(pin);
  }

  pinResetStart(): Promise<AuthStartRes> {
    return this.fake.pinResetStart();
  }

  pinResetVerify(req: PinResetVerifyReq): Promise<SecurityRes> {
    return this.fake.pinResetVerify(req);
  }

  async home(): Promise<Home> {
    const [home, me] = await Promise.all([this.fake.home(), this.softIdentity()]);
    return homeFor(home, me);
  }

  async setPlace(place: string): Promise<Home> {
    const [home, me] = await Promise.all([this.fake.setPlace(place), this.softIdentity()]);
    return homeFor(home, me);
  }

  devices(place?: string): Promise<DevicesRes> {
    return this.fake.devices(place);
  }

  controlDevice(deviceId: string, req: DeviceControlReq): Promise<DeviceControlRes> {
    return this.fake.controlDevice(deviceId, req);
  }

  setDeviceFavorite(deviceId: string, favorite: boolean): Promise<DeviceFavoriteRes> {
    return this.fake.setDeviceFavorite(deviceId, favorite);
  }

  runRoutine(routineId: string, place?: string): Promise<RoutineRunRes> {
    return this.fake.runRoutine(routineId, place);
  }

  setBoxMic(micOn: boolean): Promise<BoxRes> {
    return this.fake.setBoxMic(micOn);
  }

  business(place?: string, period?: BusinessPeriod): Promise<Business> {
    return this.fake.business(place, period);
  }

  businessReorder(stockId: string): Promise<BusinessReorderRes> {
    return this.fake.businessReorder(stockId);
  }

  connections(): Promise<Connections> {
    return this.fake.connections();
  }

  connectionDetail(id: string): Promise<ConnectionDetail> {
    return this.fake.connectionDetail(id);
  }

  setConnectionPermission(id: string, req: ConnectionPermissionReq): Promise<ConnectionDetail> {
    return this.fake.setConnectionPermission(id, req);
  }

  forgetConnection(id: string): Promise<ConnectionForgetRes> {
    return this.fake.forgetConnection(id);
  }

  disconnectConnection(id: string): Promise<void> {
    return this.fake.disconnectConnection(id);
  }

  startConnection(id: string): Promise<ConnectionStartRes> {
    return this.fake.startConnection(id);
  }

  history(query?: Partial<Pick<HistoryQuery, 'kind' | 'before' | 'limit'>>): Promise<HistoryPage> {
    return this.fake.history(query);
  }

  account(): Promise<Account> {
    return this.withAccountIdentity(this.fake.account());
  }

  setAssistant(req: AssistantUpdateReq): Promise<Account> {
    return this.withAccountIdentity(this.fake.setAssistant(req));
  }

  setGreeting(req: GreetingUpdateReq): Promise<Account> {
    return this.withAccountIdentity(this.fake.setGreeting(req));
  }

  setNotifications(req: NotificationsUpdateReq): Promise<Account> {
    return this.withAccountIdentity(this.fake.setNotifications(req));
  }

  removePhone(id: string): Promise<Account> {
    return this.withAccountIdentity(this.fake.removePhone(id));
  }

  // ---- Keduanya ----

  /**
   * Stream gabungan. Status dan resync dari server asli (sambungan yang dilihat chat dan yang menentukan pesan apa yang
   * terlewat); event menurut {@link HYBRID_EVENTS}: utas chat dari server asli, data layar contoh dari server tiruan.
   */
  subscribe(
    onEvent: (event: StreamEvent) => void,
    onStatus: (status: ConnectionStatus) => void,
    onResync?: (lastRev: number | undefined) => void,
  ): Unsubscribe {
    const listener: Listener = { onEvent };
    this.listeners.add(listener);
    const offReal = this.real.subscribe(
      (event) => {
        if (HYBRID_EVENTS[event.type] !== 'akun') return;
        if (event.type === 'message') this.noteMessages([event.message]);
        if (event.type === 'draft') this.realDrafts.add(event.draft.id);
        onEvent(event);
      },
      onStatus,
      onResync,
    );
    const offFake = this.fake.subscribe(
      (event) => {
        if (HYBRID_EVENTS[event.type] !== 'contoh') return;
        const shown = this.sampleEvent(event);
        if (shown) onEvent(shown);
      },
      () => {},
    );
    return () => {
      this.listeners.delete(listener);
      offReal();
      offFake();
    };
  }

  dispose() {
    this.offSession();
    this.listeners.clear();
    this.real.dispose();
    this.fake.dispose();
  }

  // ---- Dalaman ----

  private noteMessages(items: Message[]) {
    for (const m of items) for (const id of draftIds(m)) this.realDrafts.add(id);
  }

  /** `GET /me` terbaru. Pemilik yang berubah (nama, paket) dibawa ke Beranda dan Akun yang sedang tampil. */
  private noteIdentity(me: Me) {
    if (sameIdentity(this.identity, me)) {
      this.identity = me;
      return;
    }
    this.identity = me;
    if (this.listeners.size === 0) return;
    void this.fake.home().then(
      (home) => this.emit({ type: 'home', home: homeFor(home, me) }),
      () => {},
    );
    void this.fake.account().then(
      (account) => this.emit({ type: 'account', account: accountFor(account, me) }),
      () => {},
    );
  }

  private emit(event: StreamEvent) {
    for (const l of [...this.listeners]) {
      try {
        l.onEvent(event);
      } catch (e) {
        console.error('Pendengar stream gagal', e);
      }
    }
  }

  /** Pemilik akun, memuat `GET /me` bila belum terbaca. Melempar bila gagal (Akun lalu menawarkan muat lagi). */
  private strictIdentity(): Promise<Me> {
    if (this.identity) return Promise.resolve(this.identity);
    this.identityLoading ??= this.me().finally(() => {
      this.identityLoading = null;
    });
    return this.identityLoading;
  }

  /** Seperti {@link strictIdentity}, tapi gagal = `null` (Beranda menyapa tanpa nama). */
  private softIdentity(): Promise<Me | null> {
    return this.strictIdentity().catch(() => null);
  }

  private async withAccountIdentity(pending: Promise<Account>): Promise<Account> {
    // Keduanya dimulai bersamaan; Akun contoh tanpa pemilik asli tidak pernah ditampilkan.
    const [account, me] = await Promise.all([pending, this.strictIdentity()]);
    return accountFor(account, me);
  }

  /** Event data contoh untuk pendengar: Beranda dan Akun memakai pemilik asli; Akun sebelum `GET /me` terbaca dibuang. */
  private sampleEvent(event: StreamEvent): StreamEvent | null {
    if (event.type === 'home') return { ...event, home: homeFor(event.home, this.identity) };
    if (event.type === 'account') {
      return this.identity ? { ...event, account: accountFor(event.account, this.identity) } : null;
    }
    return event;
  }
}
