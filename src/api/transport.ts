import type {
  Account,
  AgendaItem,
  AgendaNew,
  AgendaParseRes,
  AgendaPatchReq,
  AgendaRes,
  AuthStartReq,
  AuthStartRes,
  AuthVerifyReq,
  AssistantUpdateReq,
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
  DevicesRes,
  DraftActionReq,
  DraftActionRes,
  GreetingUpdateReq,
  Home,
  HistoryPage,
  HistoryQuery,
  Me,
  Message,
  MessagesPage,
  MessagesChangedPage,
  NotificationsUpdateReq,
  PinResetVerifyReq,
  PinSetReq,
  RoutineRunRes,
  PushTokenDeleteReq,
  PushTokenReq,
  SecurityRes,
  SecurityUpdateReq,
  SendMessageReq,
  StreamEvent,
  VoiceClientMessage,
  VoiceEvent,
} from './contract';
import type { DataMode } from './mode';

/**
 * Jenis kegagalan yang dilihat layar. Teks untuk pengguna dibuat `friendlyError` (errors.ts); kodenya tidak pernah
 * ditampilkan.
 * - `network`: tidak tersambung (tanpa sinyal, server tidak terjangkau);
 * - `timeout`: server tidak menjawab dalam batas waktu;
 * - `unauthorized`: sesi tidak ada atau ditolak server (401). Sesi sudah dihapus saat error ini dilempar;
 * - `kode_salah`: kode masuk salah;
 * - `blocked`: akun dinonaktifkan atau diblokir (403 `diblokir`); sesi tidak dihapus;
 * - `rate_limited`: terlalu sering (429 `terlalu_sering`); `retryInSec` kalau server menyebutnya;
 * - `upgrade_required`: versi aplikasi terlalu lama (426 `perlu_pembaruan`);
 * - `not_registered`: nomor belum punya akun (404 `belum_terdaftar` dari `auth/start`); `waNumber` kalau server
 *   menyebutnya. Aplikasi adalah add-on, akun hanya dibuat lewat WhatsApp;
 * - `pin_wrong`: PIN (atau PIN lama) tidak cocok (403 `pin_salah`); sesi dan akun tidak terpengaruh;
 * - `pin_cooldown`: PIN baru diganti lewat lupa PIN dan aksi yang dijaga ditolak 15 menit (423 `pin_baru`);
 * - `pin_required`: aksi perangkat yang dijaga butuh PIN (428 `pin_diperlukan`); aplikasi meminta PIN lalu mengulang;
 * - `not_understood`: server tidak bisa membaca kalimat agenda (422 `tidak_paham`);
 * - `invalid_name`: nama asisten tidak sah (400 `nama_tidak_valid`);
 * - `unavailable`: jalur belum diisi server (501 `belum_tersedia`);
 * - `server`: kendala lain, termasuk jawaban server yang bentuknya tidak sesuai kontrak.
 */
export type FailureCode =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'kode_salah'
  | 'blocked'
  | 'not_registered'
  | 'pin_wrong'
  | 'pin_required'
  | 'pin_cooldown'
  | 'not_understood'
  | 'invalid_name'
  | 'rate_limited'
  | 'upgrade_required'
  | 'unavailable'
  | 'server';

export class ApiFailure extends Error {
  readonly code: FailureCode;
  /** Status HTTP, kalau ada jawaban. */
  readonly status?: number;
  /** Kode `error` dari isi jawaban server (`ApiError`), kalau ada. Contoh: `status_draf` untuk aksi draf yang telat. */
  readonly error?: string;
  /** Detik sampai boleh mencoba lagi (429 `terlalu_sering`). */
  readonly retryInSec?: number;
  /** Nomor WhatsApp Sekretaris AI dari jawaban `belum_terdaftar` (E.164 tanpa "+"). */
  readonly waNumber?: string;

  constructor(
    code: FailureCode,
    details: { status?: number; error?: string; retryInSec?: number; waNumber?: string; cause?: unknown } = {},
  ) {
    super(`api:${code}${details.status ? ` ${details.status}` : ''}${details.error ? ` ${details.error}` : ''}`, {
      cause: details.cause,
    });
    this.name = 'ApiFailure';
    this.code = code;
    this.status = details.status;
    this.error = details.error;
    this.retryInSec = details.retryInSec;
    this.waNumber = details.waNumber;
  }
}

export function isApiFailure(e: unknown): e is ApiFailure {
  return e instanceof ApiFailure;
}

/**
 * Status WebSocket:
 * - `connecting`: sedang menyambung, termasuk saat menunggu jeda sebelum mencoba lagi;
 * - `open`: tersambung, event mengalir;
 * - `closed`: tidak menyambung sama sekali (belum masuk, sesi ditolak, atau tidak ada yang mendengarkan);
 * - `blocked` / `upgrade_required`: server menolak jabat tangan karena akun diblokir (403) atau versi aplikasi terlalu
 *   lama (426); penyambungan ulang dihentikan. Layar menampilkan `BLOCKED_TEXT` / `UPGRADE_TEXT`.
 */
export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'blocked' | 'upgrade_required';

/**
 * Sumber gambar untuk media (`mediaId` di bagian `image`, `document`, `audio`, dan kartu `qris`).
 * - `uri`: unduh dari `uri` dengan `headers` (token), misalnya `<Image source={{ uri, headers }} />`;
 * - `sampleQr`: hanya dari server tiruan. Tidak ada berkas; layar menggambar pola QR contoh (`qrPattern`) dengan SVG,
 *   seperti `QrisCard` di Fase 0b;
 * - `sampleFile`: hanya dari server tiruan. Dokumen contoh tanpa berkas; layar memberi tahu bahwa ini contoh.
 */
export type MediaSource =
  { kind: 'uri'; uri: string; headers: Record<string, string> } | { kind: 'sampleQr' } | { kind: 'sampleFile' };

export type Unsubscribe = () => void;

/**
 * Kenapa soket suara tertutup:
 * - `ended`: selesai dengan baik (server mengirim `end`, atau aplikasi yang menutup);
 * - `unauthorized`: server menolak token (4401); sesi sudah dihapus;
 * - `idle`: server menutup karena diam terlalu lama (4408);
 * - `network`: tidak tersambung atau putus;
 * - `unavailable`: Mode Suara belum tersedia untuk akun ini (4501 `belum_tersedia`).
 */
export type VoiceCloseReason = 'ended' | 'unauthorized' | 'idle' | 'network' | 'unavailable';

/**
 * Satu sesi Mode Suara (`GET /voice`). Pesan yang dikirim sebelum soket terbuka diantre. Setelah tertutup, `send` tidak
 * berbuat apa-apa dan `onClose` dipanggil tepat sekali.
 */
export interface VoiceSession {
  send(message: VoiceClientMessage): void;
  /** Tutup dari sisi aplikasi. Tidak memanggil `onClose`. */
  close(): void;
  onEvent(listener: (event: VoiceEvent) => void): Unsubscribe;
  onClose(listener: (reason: VoiceCloseReason) => void): Unsubscribe;
}

/**
 * Satu antarmuka ke server, dengan dua isi: `HttpTransport` (server asli) dan `FakeTransport` (server tiruan di
 * memori). Layar dan hook tidak tahu isi mana yang dipakai.
 *
 * Semua method melempar `ApiFailure` saat gagal, tidak pernah error lain. Jawaban server selalu diperiksa dengan skema
 * kontrak; jawaban yang bentuknya salah menjadi `ApiFailure('server')`.
 */
export interface Transport {
  readonly mode: DataMode;

  /** Minta kode masuk dikirim lewat WhatsApp. */
  authStart(req: AuthStartReq): Promise<AuthStartRes>;
  /** Cocokkan kode. Saat berhasil, token sudah disimpan ke sesi sebelum janji ini selesai. */
  authVerify(req: AuthVerifyReq): Promise<AuthVerifyRes>;
  /**
   * Keluar. Sesi dihapus di HP lebih dulu (janji ini selesai saat itu juga, juga saat server tidak terjangkau); token
   * yang tadi dipakai dikirim ke `auth/logout` di belakang layar dan kegagalannya diabaikan. Tidak pernah gagal.
   */
  logout(): Promise<void>;
  me(): Promise<Me>;
  /**
   * Satu halaman riwayat, dari yang terbaru. Tanpa `before` (atau `before` = seq yang tidak ada lagi): halaman
   * terbaru. `before` di hasilnya dipakai untuk halaman yang lebih lama.
   */
  messages(before?: number): Promise<MessagesPage>;
  /**
   * Pesan yang dibuat atau diperbarui setelah `rev` itu (`GET /messages?changedAfter=`), dari `rev` terkecil, termasuk
   * pesan lama yang baru diperbarui (QRIS lunas, draf berubah, pilihan diambil). `more` = ulangi dengan `rev` pesan
   * terakhir. Untuk resync.
   */
  messagesChanged(changedAfter: number): Promise<MessagesChangedPage>;
  /** Kirim pesan pengguna; hasilnya pesan yang tersimpan. Balasan asisten datang lewat `subscribe`. */
  send(req: SendMessageReq): Promise<Message>;
  /** Aksi pada kartu draf (`POST /drafts/:id`): draf yang baru dan `rev` pesan yang memuat kartunya. */
  draftAction(id: string, req: DraftActionReq): Promise<DraftActionRes>;
  /** Daftarkan token notifikasi HP (`POST /push-tokens`). */
  registerPushToken(req: PushTokenReq): Promise<void>;
  /**
   * Cabut token notifikasi HP (`DELETE /push-tokens`), tanpa token masuk: dipakai setelah keluar, saat pemberitahuan
   * `auth/logout` mungkin tidak sampai. Idempoten; token yang tidak dikenal juga berhasil.
   */
  unregisterPushToken(req: PushTokenDeleteReq): Promise<void>;
  /** Keamanan akun (`GET /account/security`): PIN aktif atau tidak, dan sudah dibuat atau belum. */
  security(): Promise<SecurityRes>;
  /** Hidupkan atau matikan permintaan PIN (`PUT /account/security`). Menghidupkan tanpa PIN ditolak (`tidak_valid`). */
  setSecurity(req: SecurityUpdateReq): Promise<SecurityRes>;
  /** Buat PIN, atau ganti PIN dengan `currentPin` (`POST /account/pin`). `currentPin` salah: `pin_wrong`. */
  setPin(req: PinSetReq): Promise<SecurityRes>;
  /** Periksa PIN (`POST /account/pin/verify`): `true` kalau cocok, `false` kalau salah (403 `pin_salah`). */
  verifyPin(pin: string): Promise<boolean>;
  /** Lupa PIN, langkah 1 (`POST /account/pin/reset/start`): kode 6 angka dikirim ke WhatsApp pemilik. */
  pinResetStart(): Promise<AuthStartRes>;
  /**
   * Lupa PIN, langkah 2 (`POST /account/pin/reset/verify`): kode cocok menyimpan `pin` sebagai PIN baru. Kode salah
   * atau kedaluwarsa: `kode_salah`.
   */
  pinResetVerify(req: PinResetVerifyReq): Promise<SecurityRes>;
  /** Beranda (`GET /home`): ringkasan untuk tempat terpilih. Perubahan berikutnya datang lewat event stream `home`. */
  home(): Promise<Home>;
  /** Pilih tempat (`PUT /places/current`); jawabannya Beranda untuk tempat itu. Tempat yang tidak dikenal: `tidak_valid`. */
  setPlace(place: string): Promise<Home>;
  /**
   * Perangkat satu tempat (`GET /devices?place=`): ruangan, perangkat, kotak, dan rutinitas. Tanpa `place`: tempat
   * terpilih. Perubahan berikutnya datang lewat event stream `device`.
   */
  devices(place?: string): Promise<DevicesRes>;
  /**
   * Atur perangkat (`POST /home/devices/:id`): perangkat yang diperbarui dan kartunya. Aksi yang dijaga (matikan
   * kamera, buka kunci) saat PIN dihidupkan tanpa `pin`: `pin_required`; `pin` salah: `pin_wrong`.
   */
  controlDevice(deviceId: string, req: DeviceControlReq): Promise<DeviceControlRes>;
  /** Jalankan rutinitas (`POST /routines/:id/run`); `place` kosong = tempat terpilih. Tidak ada: `tidak_ditemukan`. */
  runRoutine(routineId: string, place?: string): Promise<RoutineRunRes>;
  /** Nyalakan atau matikan mikrofon Kotak (`PUT /box`). */
  setBoxMic(micOn: boolean): Promise<BoxRes>;
  /**
   * Usaha satu tempat dan rentang (`GET /business?place=&period=`). Tanpa `place`: tempat terpilih; tanpa `period`:
   * `hari`. Perubahan berikutnya datang lewat event stream `business`.
   */
  business(place?: string, period?: BusinessPeriod): Promise<Business>;
  /**
   * Buat draf pesanan ke pemasok barang `stockId` (`POST /business/reorder`). Drafnya muncul di chat sebagai pesan asisten
   * dan tidak ada yang terkirim tanpa persetujuan. Selama drafnya masih menunggu, memanggil lagi mengembalikan draf yang
   * sama. Barang tidak ada: `tidak_ditemukan`; barang tanpa pemasok: `tidak_valid`.
   */
  businessReorder(stockId: string): Promise<BusinessReorderRes>;
  /** Layanan tersambung, katalog, dan yang pernah tersambung (`GET /connections`). Perubahan datang lewat event `connection`. */
  connections(): Promise<Connections>;
  /** Detail satu layanan (`GET /connections/:id`), juga yang belum tersambung. Tidak ada: `tidak_ditemukan`. */
  connectionDetail(id: string): Promise<ConnectionDetail>;
  /** Ubah izin (dan kemampuan) satu layanan tersambung (`PUT /connections/:id/permission`). Mengembalikan detail terbaru. */
  setConnectionPermission(id: string, req: ConnectionPermissionReq): Promise<ConnectionDetail>;
  /** Lupakan yang Nadia pelajari dari layanan itu, sambungan tetap (`POST /connections/:id/forget`, memory_forget). */
  forgetConnection(id: string): Promise<ConnectionForgetRes>;
  /** Putuskan layanan (`DELETE /connections/:id`); ia pindah ke `formerly`. */
  disconnectConnection(id: string): Promise<void>;
  /**
   * Mulai menyambungkan (`POST /connections/:id/start`): alamat halaman masuk resmi layanan. Layanan `soon` atau yang
   * sudah tersambung: `tidak_valid`.
   */
  startConnection(id: string): Promise<ConnectionStartRes>;
  /**
   * Riwayat (`GET /history`), dari yang terbaru. Tanpa `kind`: semua jenis. `before` = penanda halaman dari jawaban
   * sebelumnya. Perubahan berikutnya datang lewat event stream `history`. Batalkan kiriman memakai `draftAction`.
   */
  history(query?: Partial<Pick<HistoryQuery, 'kind' | 'before' | 'limit'>>): Promise<HistoryPage>;
  /** Akun (`GET /account`): paket, asisten, sapaan, notifikasi, keamanan, HP, privasi. Perubahan datang lewat event `account`. */
  account(): Promise<Account>;
  /** Ubah nama dan/atau gaya asisten (`PUT /account/assistant`). Nama tidak sah: `invalid_name`. Mengembalikan Akun terbaru. */
  setAssistant(req: AssistantUpdateReq): Promise<Account>;
  /** Sapaan harian (`PUT /account/greeting`). Mengembalikan Akun terbaru. */
  setGreeting(req: GreetingUpdateReq): Promise<Account>;
  /** Jenis notifikasi (`PUT /account/notifications`), hanya yang diubah. Mengembalikan Akun terbaru. */
  setNotifications(req: NotificationsUpdateReq): Promise<Account>;
  /**
   * Keluarkan satu HP (`DELETE /account/phones/:id`): sesi dan token notifikasinya dicabut. HP ini sendiri (`current`):
   * `tidak_valid`. Tidak ada: `tidak_ditemukan`. Mengembalikan Akun terbaru.
   */
  removePhone(id: string): Promise<Account>;
  /**
   * Agenda (`GET /agenda`). Tanpa `range`: Senin pekan ini sampai Minggu pekan depan. Perubahan berikutnya datang lewat
   * event stream `agenda`.
   */
  agenda(range?: { from: string; to: string }): Promise<AgendaRes>;
  /** Satu item agenda (`GET /agenda/:id`), misalnya untuk layar alarm. Tidak ada: `tidak_ditemukan`. */
  agendaItem(id: string): Promise<AgendaItem>;
  /** Server mengurai kalimat bebas menjadi pratinjau item (`POST /agenda/parse`); belum disimpan. */
  agendaParse(text: string): Promise<AgendaParseRes>;
  /** Simpan item dari pratinjau (`POST /agenda`). */
  agendaAdd(item: AgendaNew): Promise<AgendaItem>;
  /** Tandai selesai atau tunda (`PATCH /agenda/:id`). */
  agendaPatch(id: string, req: AgendaPatchReq): Promise<AgendaItem>;
  /** Sisa tugas kemarin (`POST /agenda/leftover`): `today` membuat tugasnya hari ini (item baru), `drop` melepasnya (`null`). */
  agendaLeftover(choice: 'today' | 'drop'): Promise<AgendaItem | null>;
  /**
   * HP sudah menjadwalkan alarm lokal untuk item itu pada `scheduledFor` (`POST /agenda/:id/alarm-ack`). Server lalu
   * tidak mengirim pengingat yang sama lewat WhatsApp. Idempoten.
   */
  agendaAlarmAck(id: string, scheduledFor: string): Promise<void>;
  /** Buka sesi Mode Suara (soket `/voice`, terpisah dari `subscribe`). */
  openVoice(): VoiceSession;
  /** Cara menampilkan media `mediaId`, dengan header token untuk server asli. */
  mediaUrl(mediaId: string): Promise<MediaSource>;
  /**
   * Dengarkan event utas. `onStatus` langsung dipanggil dengan status sekarang, lalu tiap kali berubah. `onResync`
   * dipanggil SETIAP kali koneksi terbuka (juga yang pertama), dengan `lastRev` = `rev` terbesar yang sudah diterima
   * transport lewat stream dan `messages()` / `messagesChanged()` (`undefined` kalau belum ada): saatnya mengambil pesan
   * yang terlewat lewat `messagesChanged(lastRev)` (atau `messages()` kalau `lastRev` kosong) dan menggabungkannya
   * berdasarkan `id`. Event `thinking` yang terlewat tidak bisa diambil: kosongkan himpunan `runId` aktif saat resync.
   * Satu koneksi dipakai bersama semua pendengar; koneksi ditutup saat pendengar terakhir berhenti.
   * Satu pendengar yang melempar error tidak menghentikan pendengar lain.
   */
  subscribe(
    onEvent: (event: StreamEvent) => void,
    onStatus: (status: ConnectionStatus) => void,
    onResync?: (lastRev: number | undefined) => void,
  ): Unsubscribe;
  /**
   * Hentikan koneksi dan timer milik transport ini, misalnya saat mode data diganti. Pendengar menerima status
   * `closed`. Pendengar yang datang sesudahnya membuka koneksi baru, tapi biasanya transport yang dilepas tidak dipakai
   * lagi.
   */
  dispose(): void;
}
