import type {
  AuthStartReq,
  AuthStartRes,
  AuthVerifyReq,
  AuthVerifyRes,
  DeviceRegisterReq,
  Draft,
  DraftActionReq,
  Me,
  Message,
  MessagesPage,
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
 * - `server`: kendala lain, termasuk jawaban server yang bentuknya tidak sesuai kontrak.
 */
export type FailureCode = 'network' | 'timeout' | 'unauthorized' | 'kode_salah' | 'server';

export class ApiFailure extends Error {
  readonly code: FailureCode;
  /** Status HTTP, kalau ada jawaban. */
  readonly status?: number;
  /** Kode `error` dari isi jawaban server (`ApiError`), kalau ada. Contoh: `status_draf` untuk aksi draf yang telat. */
  readonly error?: string;

  constructor(code: FailureCode, details: { status?: number; error?: string; cause?: unknown } = {}) {
    super(`api:${code}${details.status ? ` ${details.status}` : ''}${details.error ? ` ${details.error}` : ''}`, {
      cause: details.cause,
    });
    this.name = 'ApiFailure';
    this.code = code;
    this.status = details.status;
    this.error = details.error;
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
 *   seperti `QrisCard` di Fase 0b.
 */
export type MediaSource = { kind: 'uri'; uri: string; headers: Record<string, string> } | { kind: 'sampleQr' };

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
  /** Satu halaman riwayat, dari yang terbaru. Tanpa `before`: halaman terbaru. */
  messages(before?: string): Promise<MessagesPage>;
  /** Kirim pesan pengguna; hasilnya pesan yang tersimpan. Balasan asisten datang lewat `subscribe`. */
  send(req: SendMessageReq): Promise<Message>;
  draftAction(id: string, req: DraftActionReq): Promise<Draft>;
  registerDevice(req: DeviceRegisterReq): Promise<void>;
  /** Cara menampilkan media `mediaId`, dengan header token untuk server asli. */
  mediaUrl(mediaId: string): Promise<MediaSource>;
  /**
   * Dengarkan event utas. `onStatus` langsung dipanggil dengan status sekarang, lalu tiap kali berubah. `onResync`
   * dipanggil setelah tersambung lagi sesudah putus: saatnya mengambil pesan yang terlewat lewat `messages()`. Satu
   * koneksi dipakai bersama semua pendengar; koneksi ditutup saat pendengar terakhir berhenti.
   */
  subscribe(
    onEvent: (event: StreamEvent) => void,
    onStatus: (status: ConnectionStatus) => void,
    onResync?: () => void,
  ): Unsubscribe;
  /**
   * Hentikan koneksi dan timer milik transport ini, misalnya saat mode data diganti. Pendengar menerima status
   * `closed`. Pendengar yang datang sesudahnya membuka koneksi baru, tapi biasanya transport yang dilepas tidak dipakai
   * lagi.
   */
  dispose(): void;
}
