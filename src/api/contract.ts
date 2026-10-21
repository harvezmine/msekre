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
 * | DELETE /push-tokens (tanpa token masuk) | PushTokenDeleteReq | OkRes                   |
 * | GET  /account/security         | -                    | SecurityRes                       |
 * | PUT  /account/security         | SecurityUpdateReq    | SecurityRes                       |
 * | POST /account/pin              | PinSetReq            | SecurityRes                       |
 * | POST /account/pin/verify       | PinVerifyReq         | OkRes (salah: 403 `pin_salah`)    |
 * | POST /account/pin/reset/start  | -                    | AuthStartRes (kode ke WhatsApp)   |
 * | POST /account/pin/reset/verify | PinResetVerifyReq    | SecurityRes (PIN baru tersimpan)  |
 * | GET  /home                     | -                    | Home (Beranda)                    |
 * | PUT  /places/current           | PlaceReq             | Home                              |
 * | GET  /agenda?from=&to=         | -                    | AgendaRes                         |
 * | GET  /agenda/:id               | -                    | AgendaItemRes                     |
 * | POST /agenda/parse             | AgendaParseReq       | AgendaParseRes                    |
 * | POST /agenda                   | AgendaAddReq         | AgendaItemRes                     |
 * | PATCH /agenda/:id              | AgendaPatchReq       | AgendaItemRes                     |
 * | POST /agenda/leftover          | AgendaLeftoverReq    | AgendaLeftoverRes                 |
 * | POST /agenda/:id/alarm-ack     | AlarmAckReq          | OkRes (milik sesi)                |
 * | GET  /devices?place=           | -                    | DevicesRes (Perangkat)            |
 * | POST /home/devices/:id         | DeviceControlReq     | DeviceControlRes                  |
 * | POST /routines/:id/run         | RoutineRunReq        | RoutineRunRes                     |
 * | PUT  /box                      | BoxReq               | BoxRes                            |
 * | GET  /business?place=&period=  | -                    | Business (Usaha)                  |
 * | POST /business/reorder         | BusinessReorderReq   | BusinessReorderRes                |
 * | GET  /connections              | -                    | Connections (Terhubung)           |
 * | GET  /connections/:id          | -                    | ConnectionDetail                  |
 * | PUT  /connections/:id/permission | ConnectionPermissionReq | ConnectionDetail             |
 * | POST /connections/:id/forget   | -                    | ConnectionForgetRes               |
 * | DELETE /connections/:id        | -                    | OkRes (diputus, pindah ke `formerly`) |
 * | POST /connections/:id/start    | -                    | ConnectionStartRes (halaman masuk resmi) |
 * | GET  /history?kind=&before=&limit= | HistoryQuery    | HistoryPage (Riwayat, terbaru dulu) |
 * | GET  /account                  | -                    | Account                           |
 * | PUT  /account/assistant        | AssistantUpdateReq   | Account                           |
 * | PUT  /account/greeting         | GreetingUpdateReq    | Account                           |
 * | PUT  /account/notifications    | NotificationsUpdateReq | Account                         |
 * | DELETE /account/phones/:id     | -                    | Account (HP itu keluar; `current`: 400) |
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
 * - 403 `pin_salah`: PIN (atau PIN lama, atau PIN untuk mematikan permintaan PIN) tidak cocok atau hilang. Berbeda dari `diblokir`: sesi tidak dihapus, akun tetap aktif;
 * - 428 `pin_diperlukan`: aksi perangkat yang dijaga (matikan kamera/alarm, buka kunci) butuh `pin` di isi request,
 *   karena pemilik menghidupkan PIN. Aplikasi lalu meminta PIN dan mengulang dengan `pin`;
 * - 404 `tidak_ditemukan`: id draf, pesan, atau media tidak ada (atau milik orang lain);
 * - 404 `belum_terdaftar`: dari `auth/start`, nomor itu belum punya akun. Aplikasi ini add-on: akun dan masa coba
 *   hanya dibuat lewat WhatsApp. Isinya membawa `waNumber` (nomor WhatsApp Sekretaris AI, E.164 tanpa "+") supaya
 *   aplikasi bisa mengarahkan pengguna memulai lewat WhatsApp. Tidak ada kode yang dikirim;
 * - 422 `tidak_paham`: dari `POST /agenda/parse`, kalimatnya tidak berisi waktu atau isi yang bisa dibaca. Aplikasi menampilkan
 *   teks ramah dengan contoh kalimat;
 * - 409 `status_draf`: aksi draf tidak boleh dari status sekarang (lihat aturan draf);
 * - 409 `sudah_dipilih`: pilihan di pesan itu sudah diambil;
 * - 426 `perlu_pembaruan`: versi aplikasi terlalu lama (dari `X-App-Version` / `X-Contract-Version`);
 * - 429 `terlalu_sering`: terlalu banyak permintaan, misalnya `auth/start` diulang sebelum `resendInSec` habis. Isinya
 *   membawa `retryInSec`;
 * - 500 `server`: kendala lain;
 * - 501 `belum_tersedia`: jalur ada di kontrak tapi belum diisi server (kendali perangkat sebelum Fase 3);
 * - 400 `nama_tidak_valid`: dari `PUT /account/assistant`, nama bukan 2 sampai 20 huruf. Aplikasi menampilkan teks ramah.
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
 * - `POST /home/devices/:id` mengatur perangkat dan menjawab perangkat serta kartu perangkat yang diperbarui. Di
 *   Fase 1b boleh dibalas 501 `belum_tersedia`.
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
/** Kode tutup soket suara yang diam terlalu lama. */
export const WS_CLOSE_IDLE = 4408;
/** Kode tutup soket suara: Mode Suara belum tersedia untuk akun ini (`belum_tersedia`). Aplikasi menampilkan catatan "segera hadir". */
export const WS_CLOSE_VOICE_UNAVAILABLE = 4501;
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

/** Nomor WhatsApp Sekretaris AI (E.164 tanpa "+") untuk mengarahkan pengguna yang belum terdaftar. */
export const waNumberSchema = z.string().regex(/^[1-9]\d{6,14}$/);

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
  /**
   * Fitur yang boleh dipakai akun ini. `voice`: Mode Suara. Hilang = belum (mode server); mode contoh selalu menyalakannya.
   * Aplikasi membaca ini dengan longgar: bentuk yang salah dianggap tidak ada.
   */
  features: z.object({ voice: z.boolean().optional() }).optional().catch(undefined),
});

export const authVerifyResSchema = z.object({ token: z.string().min(1), user: meSchema });

export const okResSchema = z.object({ ok: z.literal(true) });

// ---- Keamanan (PIN opsional) ----

/** Panjang PIN: 6 angka. */
export const PIN_DIGITS = 6;
const pinSchema = z.string().regex(/^\d{6}$/);

/**
 * `pinEnabled`: PIN diminta untuk kamera, alarm rumah, dan kunci pintu (bawaan mati). `hasPin`: PIN sudah dibuat.
 * Pembayaran tidak pernah memakai PIN.
 */
export const securityResSchema = z.object({ pinEnabled: z.boolean(), hasPin: z.boolean() });
/**
 * `pinEnabled: true` tanpa PIN dibalas 400 `tidak_valid`: buat PIN dulu. `pinEnabled: false` WAJIB membawa `pin` (PIN
 * yang sekarang): hilang atau salah dibalas 403 `pin_salah`, jadi permintaan PIN tidak bisa dimatikan tanpa PIN walau
 * memakai token yang sah.
 */
export const securityUpdateReqSchema = z.strictObject({ pinEnabled: z.boolean(), pin: pinSchema.optional() });
/**
 * Buat PIN (belum ada) atau ganti PIN (`currentPin` wajib; salah: 403 `pin_salah`). `enable: true` sekalian menghidupkan
 * permintaan PIN dalam satu langkah (atomik: PIN tersimpan dan permintaan PIN hidup, atau tidak ada yang berubah), supaya
 * pengguna tidak tertinggal dengan PIN yang sudah dibuat tapi belum dihidupkan.
 */
export const pinSetReqSchema = z.strictObject({
  pin: pinSchema,
  currentPin: pinSchema.optional(),
  enable: z.boolean().optional(),
});
export const pinVerifyReqSchema = z.strictObject({ pin: pinSchema });
/**
 * Lupa PIN: `POST /account/pin/reset/start` mengirim kode 6 angka ke WhatsApp pemilik (jawabannya sama dengan
 * `auth/start`: `{ resendInSec }`; terlalu sering: 429 `terlalu_sering`). `POST /account/pin/reset/verify` dengan
 * `{ code, pin }`: kode cocok (dan belum kedaluwarsa, sekali pakai) menyimpan `pin` sebagai PIN baru dan membalas
 * `SecurityRes`; kode salah atau kedaluwarsa: 400 `kode_salah`. Permintaan PIN tidak berubah (hidup tetap hidup).
 */
export const pinResetVerifyReqSchema = z.strictObject({ code: z.string().regex(/^\d{6}$/), pin: pinSchema });

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
    /** Hanya di `Home.approvals`: kalimat kartu "Butuh persetujuan Anda". Kosong = aplikasi menyusun kalimat sendiri. */
    ask: z.string().min(1).optional(),
  })
  .refine((d) => d.status !== 'held' || d.heldUntil !== undefined, {
    path: ['heldUntil'],
    message: 'heldUntil wajib saat status held',
  });

// ---- Kartu ----

export const draftCardSchema = z.object({ kind: z.literal('draft'), draft: draftSchema });
/** Jenis perangkat; yang belum dikenal aplikasi dibaca `other`. */
export const deviceKindSchema = z.enum(['lamp', 'ac', 'camera', 'lock', 'plug', 'tv', 'sensor', 'box', 'other']);
export const deviceCardSchema = z.object({
  kind: z.literal('device'),
  deviceId: idSchema,
  name: z.string().min(1),
  on: z.boolean(),
  /**
   * Jenis perangkat (`kind` sudah dipakai pembeda kartu). Tidak ada (server lama): kartu dengan `temp` dibaca AC,
   * selain itu perangkat biasa. Jenis yang belum dikenal dibaca `other`: tanpa ikon dan pengatur suhu.
   */
  deviceKind: deviceKindSchema.catch('other').optional(),
  /**
   * Perangkat yang dijaga (kunci, kamera, alarm). **Server tidak pernah mengirim kartu yang bisa dikendalikan untuk
   * perangkat `sensitive`**; kalau terkirim, aplikasi hanya menampilkan keadaannya dengan "Buka di Perangkat", tanpa
   * sakelar atau pengatur suhu.
   */
  sensitive: z.boolean().optional(),
  /** Sakelar nyala-mati boleh tampil. Tidak ada: boleh untuk lampu, AC, colokan, dan TV. Jenis lain butuh `true`. */
  switchable: z.boolean().optional(),
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
  /** Pesan ini lahir dari Mode Suara (ucapan pengguna atau balasan lisan asisten). Teksnya tetap ada di utas. */
  voice: z.boolean().optional(),
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

/** `DELETE /push-tokens`: dicabut lewat tokennya sendiri, tanpa token masuk (HP bisa sudah keluar dari akun). */
export const pushTokenDeleteReqSchema = z.object({ pushToken: z.string().min(1) });

// ---- Perangkat ----

export const acSettingsSchema = z.object({ temp: z.number(), mode: z.string().min(1), fan: z.string().min(1) });

/**
 * Satu perangkat. `status` adalah tulisan keadaan yang sudah jadi dari server ("Nyala · 80%", "Terkunci", "Merekam",
 * "Tidak terjangkau sejak 10.12"); aplikasi menampilkannya apa adanya. `on`: lampu, AC, colokan, TV nyala; kunci
 * terkunci; kamera merekam. `sensitive`: mematikan (kamera, alarm) atau membuka (kunci) butuh PIN bila pemilik
 * menghidupkannya. Jenis yang belum dikenal aplikasi dibaca `other`.
 */
export const deviceSchema = z.object({
  id: idSchema,
  /** Tempat nyata (bukan `Semua`). */
  place: z.string().min(1),
  room: z.string().min(1),
  name: z.string().min(1),
  /** Nama pendek untuk kartu Rumah, contoh "Kamera". */
  short: z.string().min(1).optional(),
  /** Nama ikon; yang tidak dikenal aplikasi diganti ikon bawaan. */
  icon: z.string().min(1),
  kind: deviceKindSchema.catch('other'),
  on: z.boolean(),
  reachable: z.boolean(),
  /** Jam tampil ("10.12") saat perangkat berhenti terjangkau. */
  unreachableSince: z.string().min(1).optional(),
  /** Terang lampu, persen. */
  level: z.number().int().min(0).max(100).optional(),
  /** Hanya AC: perintah terakhir. */
  ac: acSettingsSchema.optional(),
  /** Suhu ruangan yang terbaca. */
  roomTemp: z.number().optional(),
  brand: z.string().min(1).optional(),
  /** `ir`: lewat inframerah dari Kotak (hanya perintah terakhir yang diketahui); `cloud`: lewat aplikasi mereknya. */
  via: z.enum(['ir', 'cloud']).optional().catch(undefined),
  sensitive: z.boolean().optional(),
  status: z.string(),
});

/** Ruangan di satu tempat. */
export const roomSchema = z.object({ place: z.string().min(1), name: z.string().min(1) });

/** Kotak Sekretaris AI di rumah. */
export const boxSchema = z.object({
  deviceId: idSchema,
  online: z.boolean(),
  micOn: z.boolean(),
  speaker: z.string().min(1),
  roomTemp: z.number(),
  humidity: z.number(),
});

/** Rutinitas. `places`: tempat yang disentuhnya (kedai untuk "Tutup kedai"); layar mengirim tempat terpilih saat menjalankan. */
export const routineSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  icon: z.string().min(1),
  summary: z.string().min(1),
  places: z.array(z.string().min(1)),
});

/**
 * `GET /devices?place=`. `place`: tempat yang dijawab (`Semua` atau salah satu tempat; tanpa `?place=`, tempat terpilih
 * pengguna). `places`: semua tempat nyata. `rooms`: ruangan di `place` (Rumah punya ruangan tetap walau kosong).
 * `box`: kotak di Rumah, atau `null`. `rev`: nomor perubahan perangkat per pengguna.
 */
export const devicesResSchema = z.object({
  place: z.string().min(1),
  places: z.array(z.string().min(1)),
  rooms: z.array(roomSchema),
  devices: z.array(deviceSchema),
  box: boxSchema.nullable(),
  routines: z.array(routineSchema),
  rev: z.number().int().positive(),
});
export const devicesQuerySchema = z.object({ place: z.string().min(1).optional() });

export const deviceControlReqSchema = z
  .strictObject({
    on: z.boolean().optional(),
    /** Suhu AC, derajat Celsius. */
    temp: z.number().optional(),
    mode: z.string().min(1).optional(),
    /** Kecepatan kipas AC. */
    fan: z.string().min(1).optional(),
    /** Terang lampu, persen. */
    level: z.number().int().min(0).max(100).optional(),
    /** PIN pemilik, untuk aksi yang dijaga bila PIN dihidupkan. */
    pin: pinSchema.optional(),
  })
  .refine(
    (r) =>
      r.on !== undefined ||
      r.temp !== undefined ||
      r.mode !== undefined ||
      r.fan !== undefined ||
      r.level !== undefined,
    { message: 'minimal satu pengaturan' },
  );
/**
 * `rev`: nomor perubahan perangkat setelah perintah ini (sama dengan `rev` event `device` yang menyusul). Aplikasi
 * membuang event `device` yang lebih lama dari `rev` ini untuk perangkat yang sama. Hilang atau rusak dibaca 0.
 */
export const deviceControlResSchema = z.object({
  device: deviceSchema,
  card: deviceCardSchema,
  rev: z.number().int().nonnegative(),
});

/** `place` kosong = tempat terpilih pengguna. Tutup kedai menyentuh kedai itu; di Semua atau Rumah, semua kedai. */
export const routineRunReqSchema = z.strictObject({ place: z.string().min(1).optional() });
/** `devices`: perangkat yang berubah; `summary`: kalimat hasil siap tampil. */
export const routineRunResSchema = z.object({
  devices: z.array(deviceSchema),
  summary: z.string().min(1),
  rev: z.number().int().nonnegative(),
});

export const boxReqSchema = z.strictObject({ micOn: z.boolean() });
export const boxResSchema = z.object({ box: boxSchema, rev: z.number().int().nonnegative() });

// ---- Beranda ----

/** Satu baris "Agenda hari ini" di Beranda. Tugas tidak ikut (ada di layar Agenda). */
export const HOME_AGENDA_MAX = 3;
export const agendaSummarySchema = z.object({
  id: idSchema,
  /** Jam tampil, "HH.MM". */
  time: z.string().min(1),
  title: z.string().min(1),
  /** `reminder`, `meeting`, `recurring`; jenis yang belum dikenal tetap ditampilkan sebagai baris biasa. */
  kind: z.string().min(1),
});

/** Satu baris kartu Rumah. `on` ada kalau barisnya punya sakelar (AC); `switchable` = sakelarnya boleh diketuk. */
export const houseLineSchema = z.object({
  deviceId: idSchema,
  /** Nama ikon; yang tidak dikenal aplikasi diganti ikon bawaan. */
  icon: z.string().min(1),
  text: z.string().min(1),
  /** Nama perangkat untuk pembaca layar pada sakelar ("AC kamar"). Kosong = memakai `text`. */
  label: z.string().min(1).optional(),
  on: z.boolean().optional(),
  switchable: z.boolean(),
  /** Perangkat yang dijaga (kunci, kamera, alarm): sakelar tidak tampil di Beranda walau `switchable`. */
  sensitive: z.boolean().optional(),
});

/** Ringkasan usaha untuk tempat terpilih. Teks sudah jadi (mata uang dan keterangan perubahan). */
export const businessSummarySchema = z.object({
  source: z.string().min(1),
  sales: z.string().min(1),
  change: z.string().min(1),
  /** Penjualan turun: keterangan perubahan diberi warna peringatan. */
  down: z.boolean(),
  alert: z.string().min(1).nullable(),
});

export const ringNodeSchema = z.object({
  key: idSchema,
  icon: z.string().min(1),
  label: z.string().min(1),
  /** Layanan atau perangkat sumbernya tidak terjangkau. */
  reachable: z.boolean(),
});

export const homeSchema = z.object({
  /** Tempat terpilih: `Semua` atau salah satu tempat pengguna. */
  place: z.string().min(1),
  /** Semua tempat nyata milik pengguna (tanpa `Semua`), untuk pemilih tempat. Kosong = hanya `Semua`. */
  places: z.array(z.string().min(1)),
  /** Nama untuk sapaan, atau `null` (sapaan netral). */
  greetingName: z.string().min(1).nullable(),
  summary: z.string(),
  /** Draf berstatus `draft` yang menunggu persetujuan, yang tertua dulu. */
  approvals: z.array(draftSchema),
  agendaToday: z.array(agendaSummarySchema).max(HOME_AGENDA_MAX),
  house: z.object({ lines: z.array(houseLineSchema) }),
  /** Usaha untuk tempat terpilih; `null` kalau pengguna tidak punya usaha. */
  business: businessSummarySchema.nullable(),
  ring: z.object({ nodes: z.array(ringNodeSchema) }),
  /** Nomor perubahan Beranda per pengguna. Naik setiap isinya berubah; klien membuang yang lebih lama. */
  rev: z.number().int().positive(),
});

export const placeReqSchema = z.strictObject({ place: z.string().min(1) });

// ---- Agenda ----

/** Tanggal "YYYY-MM-DD" menurut zona waktu pengguna di server. */
export const dateSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
/** Jam tampil "HH.MM" (24 jam) menurut zona waktu pengguna di server. */
export const clockSchema = z.string().regex(/^([01]\d|2[0-3])\.[0-5]\d$/);
export const agendaKindSchema = z.enum(['reminder', 'task', 'meeting', 'recurring']);
/** Cara pengingat sampai: bunyi alarm di HP, telepon, atau notifikasi biasa. */
export const agendaWaySchema = z.enum(['alarm', 'call', 'notif']);

/** Isi agenda yang dikirim aplikasi saat menambah: sama dengan {@link agendaItemSchema} tanpa bidang milik server. */
export const agendaNewSchema = z.object({
  /** Tanggal dan jam dinding (zona pengguna), untuk dikelompokkan per hari dan ditampilkan. */
  date: dateSchema,
  time: clockSchema,
  /** Sepanjang hari: `time` diabaikan (isi `00.00`) dan tidak ada pengingat berbunyi. */
  allDay: z.boolean().optional(),
  /** Saat yang sebenarnya (ISO 8601 dengan zona). Alarm di HP dijadwalkan dari sini. */
  at: isoDateTimeSchema,
  title: z.string().trim().min(1).max(300),
  kind: agendaKindSchema,
  /** Tanpa `way`, pengingat dibaca `notif` (notifikasi biasa): hanya `alarm` yang membunyikan alarm di HP. */
  way: agendaWaySchema.optional(),
  /** Keterangan berulang yang sudah jadi, contoh "Tiap Senin". */
  repeat: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});

export const agendaItemSchema = agendaNewSchema.extend({
  /**
   * Id kejadian. Item berulang punya id sendiri per kejadian, `<seriesId>:<YYYY-MM-DD>` (tanggal kejadian itu); tunda,
   * selesai, dan tanda terima alarm berlaku per kejadian.
   */
  id: idSchema,
  /** Id deret untuk item berulang (kejadian yang sama deret punya `seriesId` sama); kosong untuk item sekali. */
  seriesId: idSchema.optional(),
  /** Tugas atau pengingat yang sudah selesai. */
  done: z.boolean().optional(),
  /** Ditunda: alarm dan pengingat berikutnya berbunyi pada saat ini, bukan pada `at`. */
  snoozedUntil: isoDateTimeSchema.optional(),
  /** Rapat yang notulennya sudah dikirim ke chat: id pesan notulen. */
  notesMessageId: idSchema.optional(),
});

/**
 * Jawaban `GET /agenda`: item dalam rentang, sisa tugas kemarin, dan "hari ini" menurut server. `from`/`to` adalah
 * rentang yang sebenarnya dijawab (tanggal, kedua ujung termasuk); tanpa `from`/`to` di request, rentangnya Senin pekan
 * ini sampai Minggu pekan depan.
 */
export const agendaResSchema = z.object({
  items: z.array(agendaItemSchema),
  /** Tugas hari kemarin yang belum selesai ("Kemarin belum selesai"), atau `null`. */
  leftover: agendaItemSchema.nullable(),
  from: dateSchema,
  to: dateSchema,
  /** "Hari ini" dan jam sekarang menurut zona pengguna di server; aplikasi memakainya untuk garis "sekarang". */
  today: dateSchema,
  now: clockSchema,
  /**
   * Selisih zona waktu pengguna dari UTC dalam menit (WIB 420, WITA 480, WIT 540). Jam yang berasal dari waktu ISO (misalnya
   * "Ditunda sampai") ditampilkan dengan selisih ini, bukan zona HP, supaya sama dengan `time`.
   */
  tzOffsetMinutes: z.number().int().min(-720).max(840),
  /** Nomor perubahan agenda per pengguna. Naik setiap agenda berubah. */
  rev: z.number().int().positive(),
});
export const agendaQuerySchema = z.object({ from: dateSchema.optional(), to: dateSchema.optional() });
export const agendaItemResSchema = z.object({ item: agendaItemSchema });

export const agendaParseReqSchema = z.strictObject({ text: z.string().trim().min(1).max(TEXT_MAX) });
/** Pratinjau dari kalimat bebas. `guessedTime`: jam tidak disebut, server menebak (aplikasi memberi catatan). */
export const agendaParseResSchema = z.object({
  preview: z.object({ item: agendaNewSchema, guessedTime: z.boolean() }),
});
export const agendaAddReqSchema = z.strictObject({ item: agendaNewSchema });
/**
 * Ubah agenda. `done` menandai tugas selesai atau belum; `snoozeUntil` menunda sampai saat itu (ISO 8601). Minimal satu.
 */
export const agendaPatchReqSchema = z
  .strictObject({ done: z.boolean().optional(), snoozeUntil: isoDateTimeSchema.optional() })
  .refine((r) => r.done !== undefined || r.snoozeUntil !== undefined, { message: 'minimal satu perubahan' });
export const agendaLeftoverReqSchema = z.strictObject({ choice: z.enum(['today', 'drop']) });
/** `today`: tugas dibuat di agenda hari ini (`item`); `drop`: dilepas (`item` `null`). */
export const agendaLeftoverResSchema = z.object({ item: agendaItemSchema.nullable() });
/**
 * HP sudah menjadwalkan alarm lokal yang AKAN TERDENGAR untuk item itu pada `scheduledFor` (ISO 8601). Tanda terima milik
 * sesi yang mengirimnya (token): gugur saat sesi itu keluar, saat `DELETE /push-tokens` mencabut HP itu, dan saat ganti
 * akun. Server hanya menahan pengingat WhatsApp kalau HP itu terlihat dalam 12 jam terakhir (stream tersambung atau
 * request apa pun).
 */
export const alarmAckReqSchema = z.strictObject({ scheduledFor: isoDateTimeSchema });

// ---- Usaha ----

/** Rentang Usaha: `hari` = hari ini, `minggu` = pekan ini, `bulan` = bulan ini. */
export const businessPeriodSchema = z.enum(['hari', 'minggu', 'bulan']);

/**
 * Penjualan satu rentang, dalam Rupiah utuh. `change`: persen perubahan tanpa tanda (12 = 12%), `down`: turun
 * (selain itu naik). `compareLabel`: pembandingnya dalam kata, misalnya "Senin lalu", "pekan lalu", "bulan lalu".
 */
export const businessSalesSchema = z.object({
  total: z.number().int().nonnegative(),
  change: z.number().nonnegative(),
  down: z.boolean(),
  compareLabel: z.string(),
});

/** Satu titik grafik: `label` sumbu (hari, pekan, bulan), `value` Rupiah. Titik terakhir = rentang sekarang. */
export const businessPointSchema = z.object({ label: z.string().min(1), value: z.number().nonnegative() });

/** Penjualan satu kedai (hanya pada tampilan `Semua`). `status`: keterangan bebas, misalnya "belum buka". */
export const businessBranchSchema = z.object({
  place: z.string().min(1),
  name: z.string().min(1),
  total: z.number().int().nonnegative(),
  change: z.number().nonnegative(),
  down: z.boolean(),
  status: z.string().optional(),
});

/** Uang masuk (rekening, QRIS). `source`: dari mana/siapa, dalam kata yang siap tampil. */
export const businessMoneyInSchema = z.object({
  id: idSchema,
  source: z.string().min(1),
  amount: z.number().int().nonnegative(),
  at: isoDateTimeSchema,
  note: z.string().optional(),
});

/**
 * Stok menipis. `left` dan `unit` ("6", "karton"). `supplier`: pemasok yang dikenal (tanpa itu tidak bisa dipesan
 * lewat aplikasi). `reorderDraftId`: ada selama draf pesanan ke pemasok masih menunggu persetujuan.
 */
export const businessStockSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  left: z.number().nonnegative(),
  unit: z.string(),
  supplier: z.object({ name: z.string().min(1), phone: z.string().min(1).optional() }).optional(),
  reorderDraftId: idSchema.optional(),
});

/** Pesanan marketplace. `channel` dan `status` bebas: kunci yang belum dikenal aplikasi ditampilkan apa adanya. */
export const businessOrderSchema = z.object({
  id: idSchema,
  channel: z.string().min(1),
  summary: z.string().min(1),
  amount: z.number().int().nonnegative(),
  status: z.string().min(1),
  at: isoDateTimeSchema,
});

/** Laporan terakhir (berkas di `GET /media/:id`). `size` byte. `period` siap tampil, misalnya "14-20 Okt". */
export const businessReportSchema = z.object({
  mediaId: idSchema,
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
  period: z.string(),
});

/**
 * Asal data. `key` bebas (`moka`, `moota`, `tiktok_shop`, ...); `connected` false = belum tersambung. `service`: id
 * layanannya di Terhubung (`GET /connections`), supaya "Sambungkan {sumber}" membuka layanan yang tepat.
 */
export const businessSourceSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  connected: z.boolean(),
  service: z.string().min(1).optional(),
  /**
   * Bagian Usaha yang bersumber dari sini: `sales` (penjualan), `stock` (stok), `moneyIn` (uang masuk), `orders`
   * (pesanan). Keterangan "dari {label}" pada kartu memakai sumber tersambung yang menyebut bagiannya; kuncinya bebas.
   */
  provides: z.array(z.string().min(1)).optional(),
});

/**
 * `GET /business?place=&period=`. Tanpa `place`: tempat terpilih; tanpa `period`: `hari`. `branches` terisi hanya
 * pada tampilan `Semua` kalau pengguna punya beberapa kedai. Pengguna tanpa data usaha mendapat jawaban kosong
 * (total 0, daftar kosong, `report` null). `rev`: nomor perubahan Usaha per pengguna.
 */
export const businessSchema = z.object({
  place: z.string().min(1),
  period: businessPeriodSchema,
  sales: businessSalesSchema,
  series: z.array(businessPointSchema),
  branches: z.array(businessBranchSchema),
  moneyIn: z.array(businessMoneyInSchema),
  lowStock: z.array(businessStockSchema),
  orders: z.array(businessOrderSchema),
  report: businessReportSchema.nullable(),
  sources: z.array(businessSourceSchema),
  /** Zona waktu pengguna (menit dari UTC, WIB 420) untuk jam uang masuk dan pesanan, seperti `AgendaRes.tzOffsetMinutes`. */
  tzOffsetMinutes: z.number().int().min(-720).max(840),
  rev: z.number().int().positive(),
});
export const businessQuerySchema = z.object({
  place: z.string().min(1).optional(),
  period: businessPeriodSchema.optional(),
});

/** `POST /business/reorder`: buat draf pesanan ke pemasok barang `stockId`. Tidak ada yang terkirim tanpa persetujuan. */
export const businessReorderReqSchema = z.strictObject({ stockId: idSchema });
/** `draftId`: draf di chat; `messageId`: pesan asisten yang memuat kartunya. */
export const businessReorderResSchema = z.object({ draftId: idSchema, messageId: idSchema });

// ---- Terhubung ----

/** Kelompok layanan di katalog Terhubung. Kelompok yang belum dikenal aplikasi dibaca `lainnya`. */
export const serviceCategorySchema = z.enum(['kerja', 'usaha', 'rumah', 'catatan', 'lainnya']);
/**
 * Keadaan layanan bagi pengguna: `connected` (tersambung), `available` (bisa disambungkan), `formerly` (pernah tersambung,
 * sudah diputus), `soon` (segera hadir, belum bisa disambungkan). Yang belum dikenal aplikasi dibaca `available`.
 */
export const serviceStatusSchema = z.enum(['connected', 'available', 'formerly', 'soon']);

/**
 * Satu layanan. `icon`: nama ikon (yang tak dikenal diganti ikon bawaan). `account`: akun yang tersambung dalam kata siap
 * tampil (alamat email, nama toko). `since`: kapan disambungkan; `lastUsed`: terakhir dipakai Nadia. `ring`: layanan ini
 * punya simpul di cincin Beranda. `attention`: perlu perhatian (layanan tetap `connected`); `text` = kalimat siap tampil
 * ("Perlu disambungkan ulang", "Tidak terjangkau sejak 10.12"), `action` = `reconnect` kalau menyambungkan ulang lewat
 * halaman masuk resmi menyelesaikannya, `none` kalau tidak ada yang bisa dilakukan pengguna dari sini. Yang belum
 * dikenal dibaca `none`.
 */
export const serviceAttentionSchema = z.object({
  text: z.string().min(1),
  action: z.enum(['reconnect', 'none']).catch('none'),
});

export const serviceSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  icon: z.string().min(1),
  category: serviceCategorySchema.catch('lainnya'),
  status: serviceStatusSchema.catch('available'),
  account: z.string().min(1).optional(),
  since: isoDateTimeSchema.optional(),
  lastUsed: isoDateTimeSchema.optional(),
  ring: z.boolean(),
  attention: serviceAttentionSchema.optional(),
});

/**
 * `GET /connections`. `connected`: tersambung (terbaru terakhir); `catalog`: yang bisa disambungkan dan yang `soon`;
 * `formerly`: pernah tersambung dan sudah diputus. `rev`: nomor perubahan Terhubung per pengguna.
 */
export const connectionsSchema = z.object({
  connected: z.array(serviceSchema),
  catalog: z.array(serviceSchema),
  formerly: z.array(serviceSchema),
  rev: z.number().int().positive(),
});

/** Izin satu layanan: `baca` = hanya membaca, `baca_tulis` = boleh bertindak (selalu dengan persetujuan pengguna). */
export const connectionPermissionSchema = z.enum(['baca', 'baca_tulis']);
/** Satu kemampuan yang bisa dimatikan sendiri. `label` siap tampil. */
export const connectionCapabilitySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  enabled: z.boolean(),
});

/**
 * `GET /connections/:id`, juga untuk layanan yang belum tersambung (untuk layar "Masuk": apa yang akan bisa Nadia
 * lakukan). `what`: daftar kalimat biasa tentang yang bisa Nadia lakukan. `memoryCount`: berapa hal yang Nadia ingat
 * dari layanan ini (untuk "Hapus yang Nadia tahu"), tanpa itu tidak diketahui.
 */
export const connectionDetailSchema = z.object({
  service: serviceSchema,
  capabilities: z.array(connectionCapabilitySchema),
  permission: connectionPermissionSchema.catch('baca'),
  what: z.array(z.string().min(1)),
  memoryCount: z.number().int().nonnegative().optional(),
});

/** `PUT /connections/:id/permission`. `capabilities`: hanya yang diubah. Mengembalikan detail terbaru. */
export const connectionPermissionReqSchema = z.strictObject({
  permission: connectionPermissionSchema,
  capabilities: z.array(z.object({ key: z.string().min(1), enabled: z.boolean() })).optional(),
});

/** `POST /connections/:id/forget`: lupakan yang dipelajari dari layanan itu (memory_forget); sambungannya tetap. */
export const connectionForgetResSchema = z.object({ ok: z.literal(true), forgotten: z.number().int().nonnegative() });

/**
 * `POST /connections/:id/start`: alamat halaman masuk resmi layanan; harus `https:`. `callbackScheme` boleh ada tetapi
 * diabaikan: aplikasi memakai skemanya sendiri (`sekretarisai`) dan menunggu kembali ke
 * `sekretarisai://terhubung/tersambung`.
 */
export const connectionStartResSchema = z.object({
  url: z.url({ protocol: /^https$/ }),
  callbackScheme: z.string().optional(),
});

// ---- Riwayat ----

export const HISTORY_LIMIT = 20;
export const HISTORY_LIMIT_MAX = 50;

/** Jenis entri Riwayat (untuk saringan dan ikon). Yang belum dikenal aplikasi dibaca `lainnya`. */
export const historyKindSchema = z.enum(['kirim', 'rumah', 'agenda', 'usaha', 'bayar', 'sambung', 'lainnya']);
/** Dari mana tindakan itu diminta. Yang belum dikenal dibuang (entri tetap tampil). */
export const historyChannelSchema = z.enum(['app', 'whatsapp', 'chat']);
/** Keadaan kiriman: `menunggu` (ditahan, masih bisa dibatalkan), `terkirim`, `dibatalkan`, `gagal`. */
export const historyStatusSchema = z.enum(['menunggu', 'terkirim', 'dibatalkan', 'gagal']);

/**
 * Layar yang boleh dibuka dari satu entri. `route` = jalur layar aplikasi (contoh `/chat`, `/perangkat/[id]`), `params`
 * mengisi bagian dinamisnya. Hanya layar yang dikenal aplikasi yang dibuka; selain itu entri tidak bisa diketuk.
 */
export const historyLinkSchema = z.object({
  route: z.string().min(1),
  params: z.record(z.string(), z.string()).optional(),
});

/**
 * Satu hal yang sudah dikerjakan asisten. `icon`: nama ikon (yang tak dikenal diganti ikon bawaan). `title` dan `detail`
 * siap tampil (aplikasi menambahkan jam dari `at`, jadi `detail` tidak perlu memuat jam). `undoable`: kiriman yang masih
 * ditahan; Batalkan = `POST /drafts/:draftId` `cancel`, boleh sampai `until`.
 */
export const historyEntrySchema = z.object({
  id: idSchema,
  at: isoDateTimeSchema,
  kind: historyKindSchema.catch('lainnya'),
  icon: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1).optional(),
  channel: historyChannelSchema.optional(),
  status: historyStatusSchema.optional(),
  undoable: z.object({ draftId: idSchema, until: isoDateTimeSchema }).optional(),
  link: historyLinkSchema.optional(),
});

export const historyQuerySchema = z.object({
  kind: historyKindSchema.optional(),
  /** Penanda halaman dari `before` jawaban sebelumnya (buram bagi aplikasi). */
  before: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(HISTORY_LIMIT_MAX).default(HISTORY_LIMIT),
});

/**
 * `GET /history`: dari yang terbaru. `before`: penanda halaman yang lebih lama, atau `null`. `rev`: nomor perubahan Riwayat
 * per pengguna. `now`: jam server (ISO), supaya hitung mundur Batalkan tidak bergantung pada jam HP; tanpa itu aplikasi
 * memakai jam HP.
 */
export const historyPageSchema = z.object({
  items: z.array(historyEntrySchema),
  before: z.string().min(1).nullable(),
  rev: z.number().int().positive(),
  now: isoDateTimeSchema.optional(),
});

// ---- Akun ----

/** Nama asisten: 2 sampai 20 huruf (tanpa angka, spasi, atau tanda). Salah: 400 `nama_tidak_valid`. */
export const ASSISTANT_NAME_MIN = 2;
export const ASSISTANT_NAME_MAX = 20;
export const assistantNameSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\p{L}{${ASSISTANT_NAME_MIN},${ASSISTANT_NAME_MAX}}$`, 'u'));
export const assistantStyleSchema = z.enum(['singkat', 'ramah', 'formal']);
export const planStatusSchema = z.enum(['trial', 'aktif', 'berakhir']);

export const accountPlanSchema = z.object({
  name: z.string().min(1),
  status: planStatusSchema.catch('aktif'),
  /** `trial`: akhir masa coba; `aktif`: akhir langganan. */
  until: isoDateTimeSchema.optional(),
  /** Harga per bulan dalam Rupiah. */
  price: z.number().int().nonnegative().optional(),
});

export const accountPhoneSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  platform: z.string().min(1),
  lastSeen: isoDateTimeSchema,
  /** HP yang sedang memakai aplikasi ini. Tidak bisa dikeluarkan dari sini (pakai Keluar). */
  current: z.boolean(),
});

export const accountNotificationsSchema = z.object({
  pesan: z.boolean(),
  pengingat: z.boolean(),
  ringkasanHarian: z.boolean(),
  rumah: z.boolean(),
  usaha: z.boolean(),
});

/**
 * `GET /account`. `privacy.services`: layanan tersambung yang ada ingatannya (untuk "Hapus yang Nadia tahu"); jumlah 0
 * boleh dihilangkan. `rev`: nomor perubahan akun per pengguna.
 */
export const accountSchema = z.object({
  me: meSchema,
  plan: accountPlanSchema,
  assistant: z.object({ name: z.string().min(1), style: assistantStyleSchema.catch('ramah') }),
  greeting: z.object({ daily: z.boolean(), time: clockSchema.optional() }),
  notifications: accountNotificationsSchema,
  security: securityResSchema,
  phones: z.array(accountPhoneSchema),
  privacy: z.object({
    services: z.array(z.object({ id: idSchema, name: z.string().min(1), memoryCount: z.number().int().nonnegative() })),
  }),
  rev: z.number().int().positive(),
});

/** `PUT /account/assistant`: salah satu atau keduanya. Nama tidak sah: 400 `nama_tidak_valid`. */
export const assistantUpdateReqSchema = z
  .strictObject({ name: z.string().optional(), style: assistantStyleSchema.optional() })
  .refine((r) => r.name !== undefined || r.style !== undefined, { message: 'name atau style wajib' });
/** `PUT /account/greeting`: sapaan harian hidup atau mati, dan jamnya (hanya berarti saat hidup). */
export const greetingUpdateReqSchema = z.strictObject({ daily: z.boolean(), time: clockSchema.optional() });
/** `PUT /account/notifications`: hanya yang diubah. */
export const notificationsUpdateReqSchema = accountNotificationsSchema
  .partial()
  .strict()
  .refine((r) => Object.keys(r).length > 0, { message: 'minimal satu jenis' });

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
  /** Beranda berubah: menggantikan `Home` di layar, kecuali `home.rev` lebih lama (upsert). */
  z.object({ type: z.literal('home'), home: homeSchema }),
  /**
   * Agenda berubah: `items` menggantikan (atau menambah) item dengan `id` yang sama, `removed` membuang, `leftover`
   * (kalau ada) menggantikan sisa tugas kemarin. Event dengan `rev` lebih kecil dari yang dipegang aplikasi dibuang.
   */
  z.object({
    type: z.literal('agenda'),
    items: z.array(agendaItemSchema).optional(),
    removed: z.array(idSchema).optional(),
    leftover: agendaItemSchema.nullable().optional(),
    rev: z.number().int().positive(),
  }),
  /** Perangkat berubah: `devices` menggantikan (atau menambah) perangkat dengan `id` yang sama, `box` menggantikan kotak. */
  z.object({
    type: z.literal('device'),
    devices: z.array(deviceSchema).optional(),
    box: boxSchema.optional(),
    rev: z.number().int().positive(),
  }),
  /** Usaha berubah: menggantikan Usaha dengan `place` dan `period` yang sama, kecuali `business.rev` lebih lama (upsert). */
  z.object({ type: z.literal('business'), business: businessSchema }),
  /**
   * Satu layanan berubah (tersambung, diputus, perlu perhatian): menggantikan layanan dengan `id` yang sama menurut
   * `service.status` (`connected`, `formerly`, atau katalog), kecuali `rev` lebih lama dari yang sudah ada (upsert).
   * `removed`: layanan itu hilang dari semua daftar.
   */
  z.object({
    type: z.literal('connection'),
    service: serviceSchema,
    removed: z.boolean().optional(),
    rev: z.number().int().positive(),
  }),
  /** Satu entri Riwayat baru atau berubah (misalnya kiriman yang ditahan menjadi terkirim): upsert menurut `entry.id`. */
  z.object({ type: z.literal('history'), entry: historyEntrySchema, rev: z.number().int().positive() }),
  /** Akun berubah (dari layar lain, WhatsApp, atau langganan): menggantikan Akun, kecuali `account.rev` lebih lama. */
  z.object({ type: z.literal('account'), account: accountSchema }),
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
  'pin_salah',
  'pin_diperlukan',
  'belum_terdaftar',
  'tidak_paham',
  'perlu_pembaruan',
  'terlalu_sering',
  'server',
  'belum_tersedia',
  'nama_tidak_valid',
]);
export const apiErrorSchema = z.object({
  error: apiErrorCodeSchema,
  /** Hanya pada `terlalu_sering`: berapa detik lagi boleh mencoba. */
  retryInSec: z.number().int().nonnegative().optional(),
  /** Hanya pada `belum_terdaftar`: nomor WhatsApp Sekretaris AI untuk memulai. */
  waNumber: waNumberSchema.optional(),
});

// ---- Tipe ----

export type AuthStartReq = z.infer<typeof authStartReqSchema>;
export type AuthStartRes = z.infer<typeof authStartResSchema>;
export type AuthVerifyReq = z.infer<typeof authVerifyReqSchema>;
export type AuthVerifyRes = z.infer<typeof authVerifyResSchema>;
export type SecurityRes = z.infer<typeof securityResSchema>;
export type SecurityUpdateReq = z.infer<typeof securityUpdateReqSchema>;
export type PinSetReq = z.infer<typeof pinSetReqSchema>;
export type PinVerifyReq = z.infer<typeof pinVerifyReqSchema>;
export type PinResetVerifyReq = z.infer<typeof pinResetVerifyReqSchema>;
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
export type PushTokenDeleteReq = z.infer<typeof pushTokenDeleteReqSchema>;
export type AgendaSummary = z.infer<typeof agendaSummarySchema>;
export type HouseLine = z.infer<typeof houseLineSchema>;
export type BusinessSummary = z.infer<typeof businessSummarySchema>;
export type RingNodeSummary = z.infer<typeof ringNodeSchema>;
export type Home = z.infer<typeof homeSchema>;
export type PlaceReq = z.infer<typeof placeReqSchema>;
export type AgendaKind = z.infer<typeof agendaKindSchema>;
export type AgendaWay = z.infer<typeof agendaWaySchema>;
export type AgendaNew = z.infer<typeof agendaNewSchema>;
export type AgendaItem = z.infer<typeof agendaItemSchema>;
export type AgendaRes = z.infer<typeof agendaResSchema>;
export type AgendaItemRes = z.infer<typeof agendaItemResSchema>;
export type AgendaParseReq = z.infer<typeof agendaParseReqSchema>;
export type AgendaParseRes = z.infer<typeof agendaParseResSchema>;
export type AgendaAddReq = z.infer<typeof agendaAddReqSchema>;
export type AgendaPatchReq = z.infer<typeof agendaPatchReqSchema>;
export type AgendaLeftoverReq = z.infer<typeof agendaLeftoverReqSchema>;
export type AgendaLeftoverRes = z.infer<typeof agendaLeftoverResSchema>;
export type AlarmAckReq = z.infer<typeof alarmAckReqSchema>;
export type DeviceKind = z.infer<typeof deviceKindSchema>;
export type AcSettings = z.infer<typeof acSettingsSchema>;
export type Device = z.infer<typeof deviceSchema>;
/** Nama tempat: `Semua` atau salah satu tempat pengguna. */
export type Place = string;
export type Room = z.infer<typeof roomSchema>;
export type Box = z.infer<typeof boxSchema>;
export type Routine = z.infer<typeof routineSchema>;
export type DevicesRes = z.infer<typeof devicesResSchema>;
export type RoutineRunReq = z.infer<typeof routineRunReqSchema>;
export type RoutineRunRes = z.infer<typeof routineRunResSchema>;
export type BoxReq = z.infer<typeof boxReqSchema>;
export type BoxRes = z.infer<typeof boxResSchema>;
export type DeviceCard = z.infer<typeof deviceCardSchema>;
export type DeviceControlReq = z.infer<typeof deviceControlReqSchema>;
export type DeviceControlRes = z.infer<typeof deviceControlResSchema>;
export type BusinessPeriod = z.infer<typeof businessPeriodSchema>;
export type BusinessSales = z.infer<typeof businessSalesSchema>;
export type BusinessPoint = z.infer<typeof businessPointSchema>;
export type BusinessBranch = z.infer<typeof businessBranchSchema>;
export type BusinessMoneyIn = z.infer<typeof businessMoneyInSchema>;
export type BusinessStock = z.infer<typeof businessStockSchema>;
export type BusinessOrder = z.infer<typeof businessOrderSchema>;
export type BusinessReport = z.infer<typeof businessReportSchema>;
export type BusinessSource = z.infer<typeof businessSourceSchema>;
export type Business = z.infer<typeof businessSchema>;
export type BusinessReorderReq = z.infer<typeof businessReorderReqSchema>;
export type BusinessReorderRes = z.infer<typeof businessReorderResSchema>;
export type ServiceCategory = z.infer<typeof serviceCategorySchema>;
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type Connections = z.infer<typeof connectionsSchema>;
export type ConnectionPermission = z.infer<typeof connectionPermissionSchema>;
export type ConnectionCapability = z.infer<typeof connectionCapabilitySchema>;
export type ConnectionDetail = z.infer<typeof connectionDetailSchema>;
export type ConnectionPermissionReq = z.infer<typeof connectionPermissionReqSchema>;
export type ConnectionForgetRes = z.infer<typeof connectionForgetResSchema>;
export type ConnectionStartRes = z.infer<typeof connectionStartResSchema>;
export type HistoryKind = z.infer<typeof historyKindSchema>;
export type HistoryChannel = z.infer<typeof historyChannelSchema>;
export type HistoryStatus = z.infer<typeof historyStatusSchema>;
export type HistoryLink = z.infer<typeof historyLinkSchema>;
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type HistoryPage = z.infer<typeof historyPageSchema>;
export type AssistantStyle = z.infer<typeof assistantStyleSchema>;
export type PlanStatus = z.infer<typeof planStatusSchema>;
export type AccountPlan = z.infer<typeof accountPlanSchema>;
export type AccountPhone = z.infer<typeof accountPhoneSchema>;
export type AccountNotifications = z.infer<typeof accountNotificationsSchema>;
export type Account = z.infer<typeof accountSchema>;
export type AssistantUpdateReq = z.infer<typeof assistantUpdateReqSchema>;
export type GreetingUpdateReq = z.infer<typeof greetingUpdateReqSchema>;
export type NotificationsUpdateReq = z.infer<typeof notificationsUpdateReqSchema>;
export type StreamEvent = z.infer<typeof streamEventSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

// ---- Mode Suara (`GET /voice`, soket terpisah dari `/stream`) ----

/** Ucapan terpanjang (detik). Aplikasi berhenti merekam di sini dan mengirim `stop`. */
export const VOICE_MAX_UTTERANCE_SEC = 30;

/** Format audio yang dikirim aplikasi: PCM 16-bit little-endian, 16 kHz, mono. */
export const voiceFormatSchema = z.object({
  codec: z.literal('pcm16'),
  sampleRate: z.literal(16000),
  channels: z.literal(1),
});

export const voiceClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), lang: z.literal('id'), clientId: clientIdSchema, format: voiceFormatSchema }),
  /** Potongan audio mikrofon (`data` base64), `seq` naik dari 0 dalam satu ucapan. */
  z.object({ type: z.literal('audio'), seq: z.number().int().nonnegative(), data: z.string().min(1) }),
  /** Pengguna selesai bicara: server mengubah ucapan jadi teks lalu menjawab. */
  z.object({ type: z.literal('stop') }),
  /** Buang ucapan ini tanpa menjawab (atau hentikan balasan yang sedang diucapkan). */
  z.object({ type: z.literal('cancel') }),
  /** Pindah ke ketik di dalam Mode Suara: kalimat ini diperlakukan seperti hasil ucapan yang final. */
  z.object({ type: z.literal('text'), text: textSchema, clientId: clientIdSchema.optional() }),
]);

/**
 * `turn` = `clientId` dari `start` (atau `text`) yang dijawab event ini. Server mengisinya di SETIAP event; aplikasi
 * membuang event dari giliran yang sudah dibatalkan. Event tanpa `turn` tetap diterima (bacaan longgar).
 */
const turnField = { turn: clientIdSchema.optional() };

export const voiceEventSchema = z.discriminatedUnion('type', [
  /** Teks ucapan; `final: false` sementara (bisa berubah), `final: true` dipakai untuk menjawab. */
  z.object({ type: z.literal('transcript'), text: z.string(), final: z.boolean(), ...turnField }),
  z.object({ type: z.literal('thinking'), on: z.boolean(), ...turnField }),
  /**
   * Teks balasan. `messageId` = pesan asisten yang sama di utas chat (bertanda `voice`); boleh hilang. Satu `audio`/`speech`
   * per `reply`; kalimat pengisi ("sebentar ya") adalah `reply` tersendiri yang diputar berurutan.
   */
  z.object({ type: z.literal('reply'), text: z.string().min(1), messageId: idSchema.optional(), ...turnField }),
  /** Potongan audio balasan (`data` base64); `final: true` di potongan terakhir. */
  z.object({
    type: z.literal('audio'),
    seq: z.number().int().nonnegative(),
    data: z.string(),
    mime: z.string().regex(/^audio\//),
    final: z.boolean().optional(),
    ...turnField,
  }),
  /** Balasan lisan sebagai satu berkas: `mediaId` lewat `GET /media/:id`. */
  z.object({ type: z.literal('speech'), mediaId: idSchema, mime: z.string().regex(/^audio\//), ...turnField }),
  /**
   * Pembayaran, pesan ke orang lain, dan aksi keamanan tidak pernah dijalankan lewat suara saja: server mengirim kartunya
   * (sama dengan kartu di chat) dan menunggu ketukan. `messageId` = pesan di utas yang memuat kartu (dan pilihannya).
   */
  z.object({ type: z.literal('confirm'), card: cardSchema, messageId: idSchema.optional(), ...turnField }),
  /**
   * Sesi selesai (soket ditutup), kecuali `reason: 'cancelled'`: itu hanya pengakuan atas `cancel` (dengan `turn`) dan
   * soket tetap terbuka. Kirim `end` sesungguhnya hanya setelah audio terakhir terkirim; aplikasi membiarkan suara yang
   * sedang diputar selesai.
   */
  z.object({ type: z.literal('end'), reason: z.string().optional(), ...turnField }),
  /** Setiap giliran diakhiri `transcript` final lalu `reply` atau `error`. Kode `tidak_terdengar` = tidak ada ucapan yang terbaca. */
  z.object({ type: z.literal('error'), code: z.string(), ...turnField }),
  z.object({ type: z.literal('ping') }),
]);

export type VoiceClientMessage = z.infer<typeof voiceClientMessageSchema>;
export type VoiceEvent = z.infer<typeof voiceEventSchema>;
