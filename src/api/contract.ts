/**
 * Kontrak API aplikasi, versi 1. File ini sumber kontrak server.
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
 * | GET  /messages?before=&limit=  | MessagesQuery        | MessagesPage                      |
 * | POST /messages                 | SendMessageReq       | SendMessageRes                    |
 * | POST /drafts/:id               | DraftActionReq       | DraftActionRes                    |
 * | POST /devices                  | DeviceRegisterReq    | OkRes                             |
 * | GET  /media/:id                | -                    | berkasnya (gambar QRIS, dokumen)  |
 * | WS   /stream?token=<token>     | -                    | StreamEvent, satu JSON per pesan  |
 *
 * Error: status 4xx/5xx dengan isi `ApiError` (`{ error: <kode> }`):
 * - 400 `tidak_valid`: isi request tidak sesuai skema;
 * - 400 `kode_salah`: kode masuk salah atau kedaluwarsa;
 * - 401 `tidak_masuk`: token tidak ada, salah, atau sudah keluar. Aplikasi menghapus sesi dan kembali ke layar masuk;
 * - 404 `tidak_ditemukan`: id draf atau media tidak ada (atau milik orang lain);
 * - 409 `status_draf`: aksi draf tidak boleh dari status sekarang (lihat aturan draf);
 * - 429 `terlalu_sering`: `auth/start` diulang sebelum `resendInSec` habis;
 * - 500 `server`: kendala lain.
 *
 * Aturan perilaku server:
 * - `POST /messages` langsung menyimpan pesan pengguna dan mengembalikannya (dengan `clientId` yang sama). Setelah itu
 *   stream mengirim `thinking on`, lalu satu atau beberapa `message` dari asisten, lalu `thinking off`.
 * - `clientId` dibuat aplikasi (unik per pesan). Mengirim ulang `clientId` yang sama tidak membuat pesan baru: server
 *   mengembalikan pesan yang sudah tersimpan, supaya "Coba lagi" dan antrean offline aman diulang.
 * - Pilihan (`choiceId`) disimpan sebagai pesan pengguna berisi satu bagian `text` dengan `choiceTitle`.
 * - Kiriman ke orang lain selalu berupa kartu `draft` dan tidak pernah keluar tanpa persetujuan:
 *   - `send` hanya dari `draft` → `held`, dengan `heldUntil` = sekarang + {@link HELD_MINUTES} menit (jam WIB "HH.MM");
 *   - setelah {@link HELD_MINUTES} menit `held` → `sent`, dan perubahannya dikirim lewat event `draft`;
 *   - `cancel` hanya dari `held` → `cancelled`;
 *   - `edit` hanya dari `draft`, statusnya tetap `draft`;
 *   - aksi dari status lain dibalas 409 `status_draf`. Perubahan karena aksi aplikasi dikembalikan di response; event
 *     `draft` hanya untuk perubahan dari server sendiri.
 * - Event `message` membawa semua pesan baru di utas, termasuk pesan pengguna dari WhatsApp (`via: 'whatsapp'`, satu
 *   utas). Aplikasi menggabungkan pesan berdasarkan `id`, jadi pesan yang datang dua kali tidak tampil dua kali.
 * - WebSocket mengirim `ping` tiap {@link STREAM_PING_SEC} detik. Token yang tidak sah ditutup dengan kode
 *   {@link WS_CLOSE_UNAUTHORIZED}. Kalau koneksi putus, aplikasi menyambung ulang dengan jeda 1, 2, 4, 8, ... paling
 *   lama 30 detik, lalu mengambil pesan yang terlewat lewat `GET /messages`.
 * - `GET /messages` berurutan dari yang terbaru. `before` di response adalah nilai `?before=` untuk halaman yang lebih
 *   lama (id pesan tertua di halaman itu), atau `null` kalau tidak ada lagi. `?before=` dengan id yang tidak ada di utas
 *   dibalas 400 `tidak_valid`.
 * - Kartu `draft` di riwayat selalu membawa keadaan draf yang terbaru, jadi riwayat yang diambil ulang setelah putus
 *   sudah memuat perubahan draf yang terlewat.
 */
import { z } from 'zod';

export const CONTRACT_VERSION = 1;
export const API_PREFIX = '/app/v1';
/** Jumlah pesan per halaman `GET /messages` bila `limit` tidak diisi, dan batas atasnya. */
export const MESSAGES_LIMIT = 30;
export const MESSAGES_LIMIT_MAX = 100;
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
/** Jam WIB "HH.MM", contoh `10.47`. */
export const clockSchema = z.string().regex(/^([01]\d|2[0-3])\.[0-5]\d$/);
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
});

export const authVerifyResSchema = z.object({ token: z.string().min(1), user: meSchema });

export const okResSchema = z.object({ ok: z.literal(true) });

// ---- Draf (kiriman ke orang lain) ----

export const draftStatusSchema = z.enum(['draft', 'held', 'sent', 'cancelled']);

export const draftSchema = z
  .object({
    id: idSchema,
    /** Nama penerima seperti yang dipakai pengguna, contoh "Pak Budi". */
    to: z.string().min(1),
    channel: z.enum(['whatsapp', 'email']),
    what: z.enum(['balasan', 'pesanan', 'email', 'undangan']),
    text: z.string().min(1),
    status: draftStatusSchema,
    /** Diisi sejak `held`: batas waktu masih bisa dibatalkan. */
    heldUntil: clockSchema.optional(),
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
  /** Batas bayar, jam WIB "HH.MM". */
  until: clockSchema,
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

export const partSchema = z.discriminatedUnion('type', [
  textPartSchema,
  choicesPartSchema,
  imagePartSchema,
  documentPartSchema,
  audioPartSchema,
  cardPartSchema,
]);

// ---- Pesan ----

export const messageSchema = z.object({
  id: idSchema,
  /** Hanya pada pesan pengguna yang dikirim dari aplikasi: id buatan aplikasi untuk mengganti gelembung "mengirim…". */
  clientId: z.string().optional(),
  at: isoDateTimeSchema,
  from: z.enum(['user', 'assistant']),
  /** Kanal tempat pesan ditulis atau dikirim. Satu utas: pesan WhatsApp ikut tampil dengan tanda "lewat WhatsApp". */
  via: z.enum(['app', 'whatsapp']),
  parts: z.array(partSchema).min(1),
});

export const messagesQuerySchema = z.object({
  before: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(MESSAGES_LIMIT_MAX).default(MESSAGES_LIMIT),
});

export const messagesPageSchema = z.object({
  /** Berurutan dari yang terbaru. */
  items: z.array(messageSchema),
  before: z.string().nullable(),
});

const clientIdSchema = z.string().min(1).max(64);
export const sendTextReqSchema = z.object({ clientId: clientIdSchema, text: textSchema });
export const sendChoiceReqSchema = z.object({
  clientId: clientIdSchema,
  choiceId: idSchema,
  choiceTitle: z.string().min(1),
});
export const sendMessageReqSchema = z.union([sendTextReqSchema, sendChoiceReqSchema]);
export const sendMessageResSchema = z.object({ message: messageSchema });

export const draftActionReqSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('send') }),
  z.object({ action: z.literal('cancel') }),
  z.object({ action: z.literal('edit'), text: textSchema }),
]);
export const draftActionResSchema = z.object({ draft: draftSchema });

// ---- Perangkat (notifikasi) ----

export const deviceRegisterReqSchema = z.object({
  pushToken: z.string().min(1),
  platform: z.enum(['android', 'ios']),
});

// ---- Stream ----

export const streamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), message: messageSchema }),
  z.object({ type: z.literal('draft'), draft: draftSchema }),
  z.object({ type: z.literal('thinking'), on: z.boolean() }),
  z.object({ type: z.literal('ping') }),
]);

// ---- Error ----

export const apiErrorCodeSchema = z.enum([
  'tidak_valid',
  'kode_salah',
  'tidak_masuk',
  'tidak_ditemukan',
  'status_draf',
  'terlalu_sering',
  'server',
]);
export const apiErrorSchema = z.object({ error: apiErrorCodeSchema });

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
export type MessagesPage = z.infer<typeof messagesPageSchema>;
export type SendTextReq = z.infer<typeof sendTextReqSchema>;
export type SendChoiceReq = z.infer<typeof sendChoiceReqSchema>;
export type SendMessageReq = z.infer<typeof sendMessageReqSchema>;
export type SendMessageRes = z.infer<typeof sendMessageResSchema>;
export type DraftActionReq = z.infer<typeof draftActionReqSchema>;
export type DraftActionRes = z.infer<typeof draftActionResSchema>;
export type DeviceRegisterReq = z.infer<typeof deviceRegisterReqSchema>;
export type StreamEvent = z.infer<typeof streamEventSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
