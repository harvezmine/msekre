import type {
  AgendaItem,
  AgendaNew,
  AgendaParseRes,
  AgendaPatchReq,
  AgendaRes,
  AuthStartReq,
  AuthStartRes,
  AuthVerifyReq,
  AuthVerifyRes,
  BoxRes,
  DeviceControlReq,
  DeviceControlRes,
  DevicesRes,
  DraftActionReq,
  DraftActionRes,
  Home,
  Me,
  Message,
  MessagesPage,
  MessagesChangedPage,
  PinSetReq,
  RoutineRunRes,
  PushTokenDeleteReq,
  PushTokenReq,
  SecurityRes,
  SecurityUpdateReq,
  SendMessageReq,
  StreamEvent,
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
 * - `pin_required`: aksi perangkat yang dijaga butuh PIN (428 `pin_diperlukan`); aplikasi meminta PIN lalu mengulang;
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
