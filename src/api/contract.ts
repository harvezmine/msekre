/**
 * Kontrak API aplikasi, versi 1 (revisi 20 Okt). File ini sumber kontrak server.
 *
 * Di Fase 1b file ini dipindah apa adanya ke milo-ai `src/appapi/contract.ts` dan menjadi sumber kebenaran; aplikasi
 * lalu menyalinnya balik lewat `npm run sync:contract`. Karena itu file ini hanya boleh bergantung pada zod: jangan
 * impor apa pun dari aplikasi (`@/...`), React, atau Expo.
 *
 * Jalur (semua diawali `/app/v1`, isi JSON, header `Authorization: Bearer <token>` wajib kecuali `auth/*`):
 *
 * | Jalur                          | Request              | Response (200)                    |
 * |--------------------------------|----------------------|-----------------------------------|
 * | POST /auth/start               | AuthStartReq         | AuthStartRes                      |
 * | POST /auth/verify              | AuthVerifyReq        | AuthVerifyRes                     |
 * | POST /auth/logout              | -                    | OkRes                             |
 * | GET  /me                       | -                    | Me                                |
 * | GET  /messages?before=&limit=  | MessagesQuery        | MessagesPage (terbaru dulu)       |
 * | GET  /messages?changedAfter=&limit= | MessagesQuery     | MessagesChangedPage (terlama dulu menurut rev) |
 * | POST /messages                 | SendMessageReq       | SendMessageRes                    |
 * | POST /drafts/:id               | DraftActionReq       | DraftActionRes                    |
 * | POST /push-tokens              | PushTokenReq         | OkRes                             |
 * | POST /home/devices/:id         | DeviceControlReq     | DeviceControlRes (Fase 3)         |
 * | GET  /media/:id                | -                    | berkasnya (gambar QRIS, dokumen)  |
 * | WS   /stream                   | -                    | StreamEvent, satu JSON per pesan  |
 *
 * Header di setiap request HTTP dan di jabat tangan WebSocket: `X-App-Version` (versi aplikasi, contoh `1.0.0`) dan
 * `X-Contract-Version` ({@link CONTRACT_VERSION}). WebSocket membawa token lewat header `Authorization: Bearer <token>`,
 * bukan query string (query string tercatat di log proxy).
 *
 * Error: status 4xx/5xx dengan isi `ApiError` (`{ error: <kode> }`):
 * - 400 `tidak_valid`: isi request tidak sesuai skema, atau `choiceId` bukan salah satu pilihan di pesan itu;
 * - 400 `kode_salah`: kode masuk salah, kedaluwarsa, atau belum diminta;
 * - 401 `tidak_masuk`: token tidak ada, salah, atau sudah keluar. Aplikasi menghapus sesi dan kembali ke layar masuk;
 * - 403 `diblokir`: akun dinonaktifkan atau diblokir di admin. Sesi tidak dihapus;
 * - 404 `tidak_ditemukan`: id draf, pesan, atau media tidak ada (atau milik orang lain);
 * - 409 `status_draf`: aksi draf tidak boleh dari status sekarang (lihat aturan draf);
 * - 409 `sudah_dipilih`: pilihan di pesan itu sudah diambil;
 * - 426 `perlu_pembaruan`: versi aplikasi terlalu lama (dari `X-App-Version` / `X-Contract-Version`);
 * - 429 `terlalu_sering`: terlalu banyak permintaan, misalnya `auth/start` diulang sebelum `resendInSec` habis. Isinya
 *   membawa `retryInSec`;
 * - 500 `server`: kendala lain;
 * - 501 `belum_tersedia`: jalur ada di kontrak tapi belum diisi server (kendali perangkat sebelum Fase 3).
 *
 * Aturan perilaku server:
 * - Semua waktu memakai ISO 8601 dengan zona (`heldUntil`, `until` QRIS, `at`). Aplikasi yang memformatnya ke jam HP.
 * - `POST /messages` langsung menyimpan pesan pengguna dan mengembalikannya (dengan `clientId` yang sama). Setelah itu
 *   stream mengirim pesan itu, `thinking on` (dengan `runId`), satu atau beberapa `message` dari asisten, lalu
 *   `thinking off` (`runId` yang sama).
 * - Isi `POST /messages` ada dua macam, dibedakan `kind` dan tidak boleh dicampur (objek ketat): `text`
 *   (`{ kind, clientId, text }`) dan `choice` (`{ kind, clientId, messageId, choiceId }`). Judul pilihan tidak dikirim
 *   aplikasi: server mengambilnya dari pilihan tersimpan di pesan `messageId`, lalu menyimpan pesan pengguna berisi
 *   satu bagian `text` dengan judul itu. `choiceId` yang tidak ada di pesan itu dibalas 400 `tidak_valid`.
 * - `clientId` dibuat aplikasi (unik per pesan). Mengirim ulang `clientId` yang sama tidak membuat pesan baru: server
 *   mengembalikan pesan yang sudah tersimpan, supaya "Coba lagi" dan antrean offline aman diulang.
 * - Setiap pesan punya `seq`, nomor urut yang hanya naik dan tetap seumur pesan. Pesan yang diperbarui (upsert) tetap
 *   membawa `seq`-nya (tempatnya di utas tidak berpindah).
 * - Setiap pesan juga punya `rev`, nomor perubahan per pengguna yang hanya naik: dinaikkan (nilai baru, lebih besar dari
 *   semua `rev` yang pernah ada milik pengguna itu) setiap pesan DISIMPAN dan setiap kali pesan DIPERBARUI, termasuk
 *   perubahan draf pada kartu `draft` di dalamnya. `rev` pesan yang tidak berubah tidak berubah. Karena upsert tetap
 *   membawa `seq`, `rev`-lah yang dipakai resync.
 * - Upsert: event `message` dengan `id` yang sudah dikenal MENGGANTIKAN versi sebelumnya (tempatnya di utas tetap).
 *   Dipakai untuk QRIS menjadi `lunas` atau `kedaluwarsa`, keadaan perangkat, dan pilihan yang sudah diambil
 *   (`chosenId` terisi pada bagian `choices`).
 * - Kiriman ke orang lain selalu berupa kartu `draft` dan tidak pernah keluar tanpa persetujuan:
 *   - `send` hanya dari `draft` atau `failed` ("Coba lagi") → `held`, dengan `heldUntil` = sekarang + {@link HELD_MINUTES}
 *     menit;
 *   - setelah {@link HELD_MINUTES} menit `held` → `sent`, atau `failed` kalau pengiriman gagal;
 *   - `cancel` hanya dari `held` → `cancelled`;
 *   - `discard` hanya dari `draft` → `cancelled` (membuang draf yang belum dikirim);
 *   - `edit` hanya dari `draft`, statusnya tetap `draft`;
 *   - `sent` dan `cancelled` adalah akhir, dan `failed` hanya bisa `send` lagi; aksi dari status yang tidak boleh dibalas
 *     409 `status_draf`.
 *   - Setiap perubahan draf, juga yang berasal dari aksi aplikasi, disiarkan lewat event `draft` ke semua koneksi
 *     pengguna; perubahan karena aksi aplikasi juga dikembalikan di response. Klien membuang duplikatnya (event
 *     `draft` menimpa kartu dengan `draft.id` yang sama).
 *   - Event `draft` dan response `POST /drafts/:id` membawa `rev` pesan yang memuat kartunya (`{ draft, rev }`), yaitu
 *     `rev` baru setelah perubahan itu. Klien membuang pembaruan draf yang `rev`-nya lebih kecil dari `rev` pesan
 *     itu di layar (event yang datang terlambat tidak menimpa keadaan yang lebih baru), dan memajukan `rev` pesan itu
 *     ke `rev` yang diterima. Pembacaan longgar: `rev` yang hilang atau rusak dibaca 0 ("tidak diketahui"): drafnya
 *     tetap dipasang, tanpa mengubah `rev` pesan.
 * - Event `message` membawa semua pesan baru di utas, termasuk pesan pengguna dari WhatsApp (`via: 'whatsapp'`, satu
 *   utas). Aplikasi menggabungkan pesan berdasarkan `id`, jadi pesan yang datang dua kali tidak tampil dua kali.
 * - Event `thinking` membawa `runId`: dua proses yang berjalan bersamaan (aplikasi dan WhatsApp) tidak saling menimpa.
 *   Aplikasi mencatat himpunan `runId` yang aktif; berpikir = himpunan tidak kosong.
 * - WebSocket mengirim `ping` tiap {@link STREAM_PING_SEC} detik. Token yang tidak sah ditutup dengan kode
 *   {@link WS_CLOSE_UNAUTHORIZED}. Kalau koneksi putus, aplikasi menyambung ulang dengan jeda 1, 2, 4, 8, ... paling
 *   lama 30 detik. Setiap kali koneksi terbuka (juga yang pertama), aplikasi mengambil pesan yang terlewat lewat
 *   `GET /messages?changedAfter=<rev terbesar yang dikenal>`, berulang selama `more`.
 * - `GET /messages?before=<seq>` berurutan dari yang terbaru. `before` di response adalah nilai `?before=` untuk
 *   halaman yang lebih lama (seq pesan tertua di halaman itu), atau `null` kalau tidak ada lagi. `before` yang tidak
 *   ada di utas (misalnya setelah memory_forget) dibalas dengan halaman terbaru, bukan error. Tanpa `before`: halaman
 *   terbaru.
 * - `GET /messages?changedAfter=<rev>` (resync) berurutan dari `rev` terkecil: paling banyak `limit` pesan dengan `rev`
 *   lebih besar, dengan `more` = masih ada lagi (ulangi dengan `rev` pesan terakhir di `items`). Pesan lama yang baru
 *   diperbarui (misalnya QRIS menjadi `lunas` saat koneksi putus) ikut, karena `rev`-nya naik. Klien menggabungkan
 *   berdasarkan `id`. `before` dan `changedAfter` tidak boleh dipakai bersamaan. `changedAfter=0` memberi pesan dari
 *   awal.
 * - Kartu `draft` di riwayat selalu membawa keadaan draf yang terbaru.
 * - Pembacaan longgar (aplikasi): bagian pesan, jenis kartu, atau nilai enum yang tidak dikenal (kontrak yang lebih
 *   baru) menjadi bagian `{ type: 'unknown', note }`, bukan menggagalkan seluruh halaman. Server tidak pernah
 *   mengirim bagian `unknown`.
 * - `POST /home/devices/:id` (Fase 3) mengatur perangkat dan menjawab kartu perangkat yang diperbarui. Di Fase 1b boleh
 *   dibalas 501 `belum_tersedia`.
 */
import { z } from 'zod';

export const CONTRACT_VERSION = 1;
export const API_PREFIX = '/app/v1';
/** Nama header versi aplikasi dan versi kontrak, di setiap request HTTP dan jabat tangan WebSocket. */
export const APP_VERSION_HEADER = 'X-App-Version';
export const CONTRACT_VERSION_HEADER = 'X-Contract-Version';
/** Jumlah pesan per halaman `GET /messages` bila `limit` tidak diisi, dan batas atasnya. */
export const MESSAGES_LIMIT = 30;
export const MESSAGES_LIMIT_MAX = 100;
/** Catatan pada bagian `unknown`: tulisan yang ditampilkan untuk bagian yang tidak dikenal. */
export const UNKNOWN_PART_NOTE = 'Pesan ini butuh aplikasi versi terbaru.';
/** Lama kiriman ke orang lain ditahan (bisa dibatalkan) sebelum benar-benar keluar. */
export const HELD_MINUTES = 5;
/** Jeda `ping` dari server di WebSocket. */
export const STREAM_PING_SEC = 25;
/** Kode tutup WebSocket untuk token yang tidak sah: aplikasi menghapus sesi dan tidak menyambung ulang. */
export const WS_CLOSE_UNAUTHORIZED = 4401;
/** Panjang maksimum teks pesan atau draf. */
export const TEXT_MAX = 4096;

// ---- Bagian kecil ----

/** Nomor WhatsApp E.164 tanpa "+", contoh `6281220457781`. */
export const phoneSchema = z.string().regex(/^[1-9]\d{8,14}$/);
/** Waktu ISO 8601 lengkap dengan zona, contoh `2026-10-20T03:42:00.000Z` atau `2026-10-20T10:42:00+07:00`. */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
const idSchema = z.string().min(1);
const textSchema = z.string().trim().min(1).max(TEXT_MAX);

// ---- Masuk ----

export const authStartReqSchema = z.object({ phone: phoneSchema });
/** Kode 6 angka dikirim lewat WhatsApp; `resendInSec` adalah jeda sebelum boleh minta kode lagi. */
export const authStartResSchema = z.object({ resendInSec: z.number().int().nonnegative() });

export const authVerifyReqSchema = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/) });

export const meSchema = z.object({
  id: idSchema,
  name: z.string().nullable(),
  assistantName: z.string().min(1),
  plan: z.object({ name: z.string().min(1), activeUntil: isoDateTimeSchema.nullable() }),
  /** Nomor WhatsApp akun ini (E.164 tanpa "+"), untuk ditampilkan di Akun bila `name` kosong. */
  phone: phoneSchema,
});

export const authVerifyResSchema = z.object({ token: z.string().min(1), user: meSchema });

export const okResSchema = z.object({ ok: z.literal(true) });

// ---- Draf (kiriman ke orang lain) ----

export const draftStatusSchema = z.enum(['draft', 'held', 'sent', 'cancelled', 'failed']);

export const draftSchema = z
  .object({
    id: idSchema,
    /** Nama penerima seperti yang dipakai pengguna, contoh "Pak Budi". */
    to: z.string().min(1),
    channel: z.enum(['whatsapp', 'email']),
    what: z.enum(['balasan', 'pesanan', 'email', 'undangan']),
    text: z.string().min(1),
    status: draftStatusSchema,
    /** Diisi sejak `held`: batas waktu masih bisa dibatalkan (ISO 8601). */
    heldUntil: isoDateTimeSchema.optional(),
  })
  .refine((d) => d.status !== 'held' || d.heldUntil !== undefined, {
    path: ['heldUntil'],
    message: 'heldUntil wajib saat status held',
  });

// ---- Kartu ----

export const draftCardSchema = z.object({ kind: z.literal('draft'), draft: draftSchema });
export const deviceCardSchema = z.object({
  kind: z.literal('device'),
  deviceId: idSchema,
  name: z.string().min(1),
  on: z.boolean(),
  /** Suhu yang diatur (AC), dalam derajat Celsius. */
  temp: z.number().optional(),
  mode: z.string().optional(),
  note: z.string().optional(),
});
export const notesCardSchema = z.object({
  kind: z.literal('notes'),
  title: z.string().min(1),
  /** Tulisan waktu siap tampil, contoh "Senin, 20 Okt · 09.00–09.40". */
  when: z.string().min(1),
  decisions: z.array(z.string()),
  meetingId: idSchema,
});
export const paymentCardSchema = z.object({
  kind: z.literal('payment'),
  title: z.string().min(1),
  amountRp: z.number().int().nonnegative(),
  lines: z.array(z.object({ label: z.string().min(1), value: z.string() })),
  /** Pertanyaan di kaki kartu, contoh "Sudah benar?". */
  ask: z.string().min(1),
});
export const qrisCardSchema = z.object({
  kind: z.literal('qris'),
  amountRp: z.number().int().positive(),
  /** Batas bayar (ISO 8601). */
  until: isoDateTimeSchema,
  /** `menunggu` → `lunas` atau `kedaluwarsa`, lewat upsert pesan (event `message` dengan `id` yang sama). */
  status: z.enum(['menunggu', 'lunas', 'kedaluwarsa']),
  /** Gambar QRIS lewat `GET /media/:id`. */
  mediaId: idSchema,
});

export const cardSchema = z.discriminatedUnion('kind', [
  draftCardSchema,
  deviceCardSchema,
  notesCardSchema,
  paymentCardSchema,
  qrisCardSchema,
]);

// ---- Bagian pesan ----

export const choiceSchema = z.object({ id: idSchema, title: z.string().min(1), description: z.string().optional() });

export const textPartSchema = z.object({ type: z.literal('text'), text: z.string().min(1) });
export const choicesPartSchema = z.object({
  type: z.literal('choices'),
  prompt: z.string().optional(),
  choices: z.array(choiceSchema).min(1),
  /** Terisi (lewat upsert pesan) setelah pilihan diambil. */
  chosenId: idSchema.optional(),
});
export const imagePartSchema = z.object({
  type: z.literal('image'),
  mediaId: idSchema,
  mime: z.string().regex(/^image\//),
  caption: z.string().optional(),
  alt: z.string().optional(),
});
export const documentPartSchema = z.object({
  type: z.literal('document'),
  mediaId: idSchema,
  name: z.string().min(1),
  mime: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
});
export const audioPartSchema = z.object({
  type: z.literal('audio'),
  mediaId: idSchema,
  mime: z.string().regex(/^audio\//),
  transcript: z.string().optional(),
});
export const cardPartSchema = z.object({ type: z.literal('card'), card: cardSchema });

/** Bagian yang tidak dikenal aplikasi. Dibuat aplikasi saat membaca (lihat `lenient.ts`); server tidak mengirimnya. */
export const unknownPartSchema = z.object({ type: z.literal('unknown'), note: z.string() });

export const partSchema = z.discriminatedUnion('type', [
  textPartSchema,
  choicesPartSchema,
  imagePartSchema,
  documentPartSchema,
  audioPartSchema,
  cardPartSchema,
  unknownPartSchema,
]);

// ---- Pesan ----

export const messageSchema = z.object({
  id: idSchema,
  /** Nomor urut di utas: hanya naik, tetap seumur pesan (juga setelah upsert). */
  seq: z.number().int().positive(),
  /** Nomor perubahan per pengguna: naik saat pesan disimpan dan setiap kali diperbarui (lihat aturan `rev`). */
  rev: z.number().int().positive(),
  /** Hanya pada pesan pengguna yang dikirim dari aplikasi: id buatan aplikasi untuk mengganti gelembung "mengirim…". */
  clientId: z.string().optional(),
  at: isoDateTimeSchema,
  from: z.enum(['user', 'assistant']),
  /** Kanal tempat pesan ditulis atau dikirim. Satu utas: pesan WhatsApp ikut tampil dengan tanda "lewat WhatsApp". */
  via: z.enum(['app', 'whatsapp']),
  parts: z.array(partSchema).min(1),
});

export const messagesQuerySchema = z
  .object({
    /** Halaman yang lebih lama dari `seq` ini. */
    before: z.coerce.number().int().positive().optional(),
    /** Pesan yang dibuat atau diperbarui setelah `rev` ini (resync). */
    changedAfter: z.coerce.number().int().nonnegative().optional(),
    limit: z.coerce.number().int().min(1).max(MESSAGES_LIMIT_MAX).default(MESSAGES_LIMIT),
  })
  .refine((q) => q.before === undefined || q.changedAfter === undefined, {
    path: ['changedAfter'],
    message: 'before dan changedAfter tidak boleh bersamaan',
  });

/** Riwayat: berurutan dari yang terbaru. */
export const messagesPageSchema = z.object({
  items: z.array(messageSchema),
  /** Nilai `?before=` untuk halaman yang lebih lama, atau `null` kalau tidak ada lagi. */
  before: z.number().int().positive().nullable(),
});

/** Resync (`?changedAfter=`): berurutan dari `rev` terkecil. */
export const messagesChangedPageSchema = z.object({
  items: z.array(messageSchema),
  /** Masih ada perubahan lagi: ulangi dengan `changedAfter` = `rev` pesan terakhir di `items`. */
  more: z.boolean(),
});

const clientIdSchema = z.string().min(1).max(64);
export const sendTextReqSchema = z.strictObject({
  kind: z.literal('text'),
  clientId: clientIdSchema,
  text: textSchema,
});
/** Judul pilihan diambil server dari pesan `messageId`; aplikasi tidak mengirimnya. */
export const sendChoiceReqSchema = z.strictObject({
  kind: z.literal('choice'),
  clientId: clientIdSchema,
  messageId: idSchema,
  choiceId: idSchema,
});
export const sendMessageReqSchema = z.discriminatedUnion('kind', [sendTextReqSchema, sendChoiceReqSchema]);
export const sendMessageResSchema = z.object({ message: messageSchema });

export const draftActionReqSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('send') }),
  z.object({ action: z.literal('cancel') }),
  z.object({ action: z.literal('discard') }),
  z.object({ action: z.literal('edit'), text: textSchema }),
]);
/**
 * Hasil aksi draf: draf yang baru dan `rev` pesan yang memuat kartunya (sudah dinaikkan karena perubahan ini). Klien
 * membuang pembaruan draf yang `rev`-nya lebih lama dari `rev` pesan di layar.
 */
export const draftActionResSchema = z.object({ draft: draftSchema, rev: z.number().int().positive() });

// ---- Notifikasi ----

export const pushTokenReqSchema = z.object({
  pushToken: z.string().min(1),
  platform: z.enum(['android', 'ios']),
});

// ---- Perangkat rumah (Fase 3; Fase 1b boleh 501 `belum_tersedia`) ----

export const deviceControlReqSchema = z
  .strictObject({
    on: z.boolean().optional(),
    /** Suhu AC, derajat Celsius. */
    temp: z.number().optional(),
    mode: z.string().min(1).optional(),
  })
  .refine((r) => r.on !== undefined || r.temp !== undefined || r.mode !== undefined, {
    message: 'minimal satu pengaturan',
  });
export const deviceControlResSchema = z.object({ card: deviceCardSchema });

// ---- Stream ----

export const streamEventSchema = z.discriminatedUnion('type', [
  /** Pesan baru, atau pembaruan pesan dengan `id` yang sudah dikenal (upsert). */
  z.object({ type: z.literal('message'), message: messageSchema }),
  /**
   * Perubahan draf: menimpa kartu dengan `draft.id` yang sama, kecuali `rev` (nomor perubahan pesan yang memuat kartu,
   * sudah dinaikkan) lebih lama dari `rev` pesan di layar.
   */
  z.object({ type: z.literal('draft'), draft: draftSchema, rev: z.number().int().positive() }),
  z.object({ type: z.literal('thinking'), runId: idSchema, on: z.boolean() }),
  z.object({ type: z.literal('ping') }),
]);

// ---- Error ----

export const apiErrorCodeSchema = z.enum([
  'tidak_valid',
  'kode_salah',
  'tidak_masuk',
  'tidak_ditemukan',
  'status_draf',
  'sudah_dipilih',
  'diblokir',
  'perlu_pembaruan',
  'terlalu_sering',
  'server',
  'belum_tersedia',
]);
export const apiErrorSchema = z.object({
  error: apiErrorCodeSchema,
  /** Hanya pada `terlalu_sering`: berapa detik lagi boleh mencoba. */
  retryInSec: z.number().int().nonnegative().optional(),
});

// ---- Tipe ----

export type AuthStartReq = z.infer<typeof authStartReqSchema>;
export type AuthStartRes = z.infer<typeof authStartResSchema>;
export type AuthVerifyReq = z.infer<typeof authVerifyReqSchema>;
export type AuthVerifyRes = z.infer<typeof authVerifyResSchema>;
export type OkRes = z.infer<typeof okResSchema>;
export type Me = z.infer<typeof meSchema>;
export type DraftStatus = z.infer<typeof draftStatusSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Choice = z.infer<typeof choiceSchema>;
export type Part = z.infer<typeof partSchema>;
export type Message = z.infer<typeof messageSchema>;
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;
export type UnknownPart = z.infer<typeof unknownPartSchema>;
export type MessagesPage = z.infer<typeof messagesPageSchema>;
export type MessagesChangedPage = z.infer<typeof messagesChangedPageSchema>;
export type SendTextReq = z.infer<typeof sendTextReqSchema>;
export type SendChoiceReq = z.infer<typeof sendChoiceReqSchema>;
export type SendMessageReq = z.infer<typeof sendMessageReqSchema>;
export type SendMessageRes = z.infer<typeof sendMessageResSchema>;
export type DraftActionReq = z.infer<typeof draftActionReqSchema>;
export type DraftActionRes = z.infer<typeof draftActionResSchema>;
export type PushTokenReq = z.infer<typeof pushTokenReqSchema>;
export type DeviceCard = z.infer<typeof deviceCardSchema>;
export type DeviceControlReq = z.infer<typeof deviceControlReqSchema>;
export type DeviceControlRes = z.infer<typeof deviceControlResSchema>;
export type StreamEvent = z.infer<typeof streamEventSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
