import type {
  AuthStartReq,
  AuthStartRes,
  AuthVerifyReq,
  AuthVerifyRes,
  DeviceCard,
  DeviceControlReq,
  Draft,
  DraftActionReq,
  Me,
  Message,
  MessagesPage,
  MessagesSincePage,
  PushTokenReq,
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
 * - `unavailable`: jalur belum diisi server (501 `belum_tersedia`);
 * - `server`: kendala lain, termasuk jawaban server yang bentuknya tidak sesuai kontrak.
 */
export type FailureCode =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'kode_salah'
  | 'blocked'
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

  constructor(
    code: FailureCode,
    details: { status?: number; error?: string; retryInSec?: number; cause?: unknown } = {},
  ) {
    super(`api:${code}${details.status ? ` ${details.status}` : ''}${details.error ? ` ${details.error}` : ''}`, {
      cause: details.cause,
    });
    this.name = 'ApiFailure';
    this.code = code;
    this.status = details.status;
    this.error = details.error;
    this.retryInSec = details.retryInSec;
  }
}

export function isApiFailure(e: unknown): e is ApiFailure {
  return e instanceof ApiFailure;
}

/**
 * Status WebSocket:
 * - `connecting`: sedang menyambung, termasuk saat menunggu jeda sebelum mencoba lagi;
 * - `open`: tersambung, event mengalir;
 * - `closed`: tidak menyambung sama sekali (belum masuk, sesi ditolak, atau tidak ada yang mendengarkan).
 */
export type ConnectionStatus = 'connecting' | 'open' | 'closed';

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
  /** Keluar. Sesi selalu dihapus, juga saat server tidak terjangkau; tidak pernah gagal. */
  logout(): Promise<void>;
  me(): Promise<Me>;
  /**
   * Satu halaman riwayat, dari yang terbaru. Tanpa `before` (atau `before` = seq yang tidak ada lagi): halaman
   * terbaru. `before` di hasilnya dipakai untuk halaman yang lebih lama.
   */
  messages(before?: number): Promise<MessagesPage>;
  /** Pesan dengan `seq` lebih besar dari `after`, dari yang terlama; `more` = ulangi dengan seq terakhir. Untuk resync. */
  messagesAfter(after: number): Promise<MessagesSincePage>;
  /** Kirim pesan pengguna; hasilnya pesan yang tersimpan. Balasan asisten datang lewat `subscribe`. */
  send(req: SendMessageReq): Promise<Message>;
  draftAction(id: string, req: DraftActionReq): Promise<Draft>;
  /** Daftarkan token notifikasi HP (`POST /push-tokens`). */
  registerPushToken(req: PushTokenReq): Promise<void>;
  /** Atur perangkat rumah dari kartu (`POST /home/devices/:id`). Fase 3; sebelum itu `unavailable`. */
  controlDevice(deviceId: string, req: DeviceControlReq): Promise<DeviceCard>;
  /** Cara menampilkan media `mediaId`, dengan header token untuk server asli. */
  mediaUrl(mediaId: string): Promise<MediaSource>;
  /**
   * Dengarkan event utas. `onStatus` langsung dipanggil dengan status sekarang, lalu tiap kali berubah. `onResync`
   * dipanggil SETIAP kali koneksi terbuka (juga yang pertama), dengan `lastSeq` = seq terbesar yang sudah diterima
   * transport lewat stream dan `messages()` / `messagesAfter()` (`undefined` kalau belum ada): saatnya mengambil pesan
   * yang terlewat lewat `messagesAfter(lastSeq)` (atau `messages()` kalau `lastSeq` kosong) dan menggabungkannya
   * berdasarkan `id`. Event `thinking` yang terlewat tidak bisa diambil: kosongkan himpunan `runId` aktif saat resync.
   * Satu koneksi dipakai bersama semua pendengar; koneksi ditutup saat pendengar terakhir berhenti.
   * Satu pendengar yang melempar error tidak menghentikan pendengar lain.
   */
  subscribe(
    onEvent: (event: StreamEvent) => void,
    onStatus: (status: ConnectionStatus) => void,
    onResync?: (lastSeq: number | undefined) => void,
  ): Unsubscribe;
  /**
   * Hentikan koneksi dan timer milik transport ini, misalnya saat mode data diganti. Pendengar menerima status
   * `closed`. Pendengar yang datang sesudahnya membuka koneksi baru, tapi biasanya transport yang dilepas tidak dipakai
   * lagi.
   */
  dispose(): void;
}
