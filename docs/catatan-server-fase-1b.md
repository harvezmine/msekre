# Catatan untuk pembangun server Fase 1b

Dikumpulkan dari review kontrak API v1 pada 20 Okt 2026. Sebagian sudah dimasukkan ke kontrak di revisi berikutnya;
sisanya adalah aturan implementasi server. Kontrak lengkapnya ada di `src/api/contract.ts`, dan uraiannya di
`docs/api-v1.md` (Tugas 5 Fase 1a).

## Kontrak (dimasukkan ke revisi kontrak sebelum Tugas 3)

- **Waktu:** semua waktu memakai ISO 8601, termasuk `heldUntil` dan `until` pada QRIS. Aplikasi yang memformatnya
  sesuai zona waktu HP. Format `HH.MM` tanpa tanggal ambigu kalau melewati tengah malam, dan salah untuk pengguna WITA
  atau WIT.
- **Draf:**
  - ada status `failed` untuk kiriman yang gagal setelah masa tahan; `send` dari `failed` mengulang pengiriman (kembali
    ke `held`), itulah "Coba lagi" di kartu;
  - aksi `discard` membuang draf yang belum dikirim;
  - `cancel` dari status `held` berakhir di `cancelled`.
- **Pembaruan kartu:** event `message` dengan `id` yang sudah dikenal menggantikan versi sebelumnya (upsert). Ini
  dipakai untuk QRIS lunas atau kedaluwarsa, keadaan perangkat, dan pilihan yang sudah diambil. QRIS punya status
  `menunggu | lunas | kedaluwarsa`.
- **Pilihan:**
  - aplikasi mengirim `{ kind: 'choice', clientId, messageId, choiceId }` (teks: `{ kind: 'text', clientId, text }`;
    objek ketat, tidak boleh campuran);
  - server mengambil judulnya dari pilihan yang tersimpan, tidak percaya judul dari klien;
  - bagian `choices` membawa `chosenId` setelah dipilih.
- **Urutan dan resync:**
  - setiap pesan punya `seq`, nomor urut yang hanya naik (bigserial);
  - riwayat memakai `?before=<seq>`;
  - setiap pesan juga punya `rev`, nomor perubahan per pengguna yang hanya naik (satu sequence per pengguna, atau global
    bigserial). `rev` dinaikkan (`rev = nextval(...)`) pada INSERT dan pada setiap UPDATE pesan, termasuk saat draf di
    kartu berubah. Upsert tetap membawa `seq` lamanya, jadi resync TIDAK bisa memakai `seq`: QRIS yang lunas saat HP
    offline tidak akan terambil. Resync memakai `GET /messages?changedAfter=<rev>&limit=100` (terlama dulu menurut
    `rev`, `{ items, more }`; ulangi dengan `rev` pesan terakhir selama `more`);
  - `Me` membawa `phone` (E.164 tanpa +), supaya Akun menampilkan nomor tanpa nama;
  - jabat tangan WebSocket yang ditolak (403 `diblokir`, 426 `perlu_pembaruan`, 429) dilihat React Native sebagai tutup
    1006. Karena itu `GET /me` harus membalas 403 / 426 / 401 dengan benar juga untuk akun yang ditolak: klien
    memanggilnya setelah 3 kali gagal terbuka untuk tahu penyebabnya;
  - `before` yang tidak ada lagi (misalnya setelah memory_forget) dibalas dengan halaman terbaru, bukan 400.
- **Error:**
  - `403 diblokir` untuk akun yang dinonaktifkan atau diblokir di admin;
  - `429 terlalu_sering` dengan `retryInSec`;
  - `426 perlu_pembaruan` untuk versi aplikasi yang terlalu lama;
  - aplikasi mengirim header `X-App-Version` dan `X-Contract-Version`.
- **Penamaan:** `POST /devices` diganti `POST /push-tokens`, supaya tidak tertukar dengan perangkat rumah.
- **Perangkat rumah:** kartu perangkat butuh endpoint kendali, `POST /home/devices/:id` dengan `{ on?, temp?, mode? }`.
  Endpoint ini menjawab dengan kartu yang diperbarui. Implementasi penuh di Fase 3; di Fase 1b boleh dibalas
  `501 belum_tersedia`.
- **Tanda berpikir:** event `thinking` membawa `runId`, supaya dua proses yang berjalan bersamaan (aplikasi dan
  WhatsApp) tidak saling menimpa.

## Implementasi server (aturan, bukan bagian kontrak)

- **Kode masuk:**
  - Punya masa berlaku, batas percobaan (setelah habis, kodenya dibatalkan), dan batas per nomor serta per IP.
  - Jangan membocorkan apakah sebuah nomor sudah terdaftar.
  - Di WABA, kode untuk nomor di luar jendela 24 jam butuh template **autentikasi**.
  - Isi otomatis satu ketuk di Android butuh nama paket dan hash tanda tangan aplikasi.
  - Tentukan hubungan `auth/start` untuk nomor baru dengan pembuatan akun dan trial 7 hari, yang hanya berlaku sekali
    seumur akun.
- **Token:** acak, minimal 128 bit, disimpan dalam bentuk hash, dengan masa berlaku yang jelas. `auth/logout` mencabut
  token itu beserta token push sesi tersebut.
- **Masa tahan 5 menit:**
  - dijalankan oleh penjadwal yang tahan restart (job di database), bukan `setTimeout`;
  - pakai update bersyarat (`WHERE status = 'held'`), supaya `cancel` dan pengiriman tidak bisa sama-sama menang di
    menit kelima;
  - setiap perubahan draf disiarkan ke semua koneksi pengguna; klien membuang duplikatnya;
  - event `draft` dan response `POST /drafts/:id` membawa `rev` baru pesan pembawa kartu (`{ draft, rev }`), diambil
    dari `UPDATE ... RETURNING rev` yang sama dengan kenaikan `rev` pesan. Klien membuang pembaruan yang `rev`-nya lebih
    lama dari yang ada di layar, jadi urutan response dan event tidak lagi menentukan hasil.
- **WebSocket:**
  - Token dikirim lewat header `Authorization`, bukan query string, karena query string tercatat di log Nginx Proxy
    Manager.
  - Token yang buruk ditutup dengan kode 4401.
  - Di Nginx Proxy Manager, nyalakan "Websockets support" dan pasang batas waktu baca lebih lama dari ping 25 detik.
  - Satu pengguna boleh punya beberapa soket.
  - Heartbeat juga dijalankan di sisi server.
  - Urutan event: echo pesan pengguna, `thinking on`, pesan asisten, lalu `thinking off`.
- **Media:**
  - Media dari WhatsApp disimpan di server, karena URL Fonnte kedaluwarsa.
  - `/media/:id` disajikan dengan `Content-Type` dan `Content-Disposition` yang benar, dukungan Range, dan cache
    privat.
  - Kepemilikan dicek: media milik orang lain dibalas 404.
- **`clientId`:** unik per pasangan (pengguna, clientId). Mengirim ulang mengembalikan pesan aslinya, walaupun isinya
  berbeda.
- **Fastify:**
  - Pasang error handler dan not-found handler sendiri yang mengembalikan kode `ApiError`; bentuk bawaan Fastify tidak
    dipakai.
  - Klien selalu mengirim `{}` untuk POST tanpa isi. Fastify menolak body JSON kosong, jadi aturan ini dipertahankan.
- **Unggah media dari pengguna:** belum ada di kontrak v1. Tombol lampiran di aplikasi masih memunculkan toast; jalurnya
  menyusul.

## Beranda (Fase 2a, Tugas 1)

Kontrak ditambah (aditif, `CONTRACT_VERSION` tetap 1); uraian lengkap di `docs/api-v1.md` bagian 2.12.

- `GET /home` → `Home`; `PUT /places/current { place }` → `Home`; event stream `home` (`{ type: 'home', home }`,
  upsert menurut `rev`).
- `Draft` mendapat bidang opsional `ask` (kalimat kartu persetujuan); hanya diisi pada `Home.approvals`.
- Aturan server:
  - `approvals` = draf berstatus `draft`, tertua dulu; `agendaToday` paling banyak 3 baris tanpa tugas;
    `ring.nodes` dari layanan tersambung dan perangkat yang punya simpul cincin; `business` untuk tempat terpilih
    (atau `null` bila tidak punya usaha).
  - `rev` Beranda per pengguna, naik hanya bila isinya berubah; siarkan `home` ke semua koneksi pengguna, gabungkan
    perubahan yang berdekatan (satu event per giliran sudah cukup).
  - Sakelar AC di Beranda memanggil `POST /home/devices/:id` (Fase 3). Sebelum itu balas 501 dan aplikasi menampilkan
    kalimat ramah; Beranda tetap bisa dibaca penuh.
  - `PUT /places/current` menolak tempat yang bukan milik pengguna (400 `tidak_valid`).
- Server tiruan (`FakeTransport`) kini memegang data contoh (`fake.sample`); Beranda dihitung dari data itu dengan
  penyeleksi yang sama seperti layar 0b, sehingga perubahan dari layar mana pun ikut menyiarkan event `home`.

## Agenda dan alarm lokal (Fase 2a, Tugas 2)

Kontrak ditambah (aditif, `CONTRACT_VERSION` tetap 1); uraian lengkap di `docs/api-v1.md` bagian 2.13.

- Jalur: `GET /agenda?from=&to=`, `GET /agenda/:id`, `POST /agenda/parse`, `POST /agenda`, `PATCH /agenda/:id`,
  `POST /agenda/leftover`, `POST /agenda/:id/alarm-ack`; event stream `agenda`.
- Aturan server:
  - **Server yang mengurai kalimat** (`/agenda/parse`): tanggal relatif ("besok", "lusa", "tanggal 25"), jam dengan
    pagi/siang/sore/malam, `kind` (ada "ingatkan" = `reminder`, selain itu `task`), `way: alarm` untuk pengingat.
    `guessedTime` true kalau jam tidak disebut. Pratinjau tidak disimpan; `POST /agenda` menyimpan item yang sama.
  - **Waktu:** `date`/`time` = jam dinding zona pengguna, `at` = ISO 8601. `today`/`now` di `GET /agenda` dari zona
    pengguna. Bawaan tanpa `from`/`to`: Senin pekan ini sampai Minggu pekan depan.
  - **Tanda terima alarm (`alarm-ack`)**: begitu ada untuk pasangan (id, `scheduledFor`), JANGAN kirim pengingat yang sama
    lewat WhatsApp pada `scheduledFor`. Tanpa tanda terima, kirim seperti biasa (cadangan). Tanda terima gugur kalau
    `at`/`snoozedUntil` berubah. Cuma pengingat `way: alarm`, `reminder`/`recurring`, 7 hari ke depan yang dikabarkan
    aplikasi.
  - **Tunda:** `PATCH snoozeUntil` mengganti saat pengingat berikutnya; kirim event `agenda` dengan itemnya supaya HP
    menjadwalkan ulang alarm lokal.
  - **Event `agenda`**: upsert per `id`, `removed`, `leftover`, `rev` naik per pengguna; kirim ke semua HP pengguna.
    Perubahan agenda juga mengubah `Home.agendaToday` (event `home`).
  - `leftover`: tugas kemarin yang belum selesai; dengan `today` jadi tugas hari ini (jam bawaan 17.00), `drop`
    melepasnya. Tidak ada lagi: 404.
- Server tiruan: `FakeTransport` memegang agenda di penyimpanan contoh bersama; pengurai contoh pindah ke
  `src/api/fake/parseAgenda.ts`. Tanda terima dicatat di `FakeTransport.alarmAcks`.

## Perangkat (Fase 2a, Tugas 3; server Fase 3)

Kontrak: `docs/api-v1.md` bagian 2.9 dan 2.14. Aplikasi sudah memakainya penuh lewat server tiruan.

- Peta ke milo-ai: penyedia perangkat di `src/home/` (8 merek) menghasilkan `Device`; `kind` dan `status` dibuat server.
  Perangkat IR (lewat Kotak) berisi `via: 'ir'` dan hanya perintah terakhir yang diketahui.
- PIN memakai tabel `home_pins` yang ada. Perangkat `sensitive` = kamera, alarm rumah, kunci pintu. Bila `pinEnabled`
  dan aksinya `on: false` tanpa `pin`: 428 `pin_diperlukan`; `pin` salah: 403 `pin_salah` (beri batas percobaan,
  429 `terlalu_sering`). Chat/WhatsApp tidak pernah membuka kunci; hanya kendali langsung dari aplikasi.
- Naikkan `rev` perangkat setiap perangkat atau Kotak berubah (juga karena chat atau WhatsApp) dan siarkan event
  `device` berisi perangkat yang berubah. Gabungkan perubahan yang berdekatan.
- Layar suhu AC mengirim satu perintah per derajat saat memutar; server boleh menggabungkan atau membatasi laju
  perintah IR.
- `POST /routines/:id/run` mengembalikan hanya perangkat yang berubah; `PUT /box` mengatur mikrofon Kotak.


## Usaha (Fase 2a, Tugas 4; server menyusul)

Kontrak: `docs/api-v1.md` bagian 2.15. Aplikasi sudah memakainya penuh lewat server tiruan.

Peta ke milo-ai (di sana belum ada satu "layanan Usaha"; `GET /business` adalah penyusun dari beberapa sumber):

- **Uang masuk** (`moneyIn`, sumber `moota`): `src/moota/` (`client.ts`, `service.ts`; alat agen `bank_accounts`,
  `bank_mutations`, `bank_alerts`). Mutasi kredit terbaru menjadi baris `moneyIn`; webhook Moota yang sudah ada bisa
  menaikkan `rev` Usaha. Sumber `moota` `connected` = pengguna punya akun Moota tersambung.
- **Stok menipis** (`lowStock`): `src/stock/store.ts` (alat `stock_item`, `stock_record`, `stock_status`, `stock_report`).
  `isLow()` (qty <= minQty) memilih barangnya; `left` dan `unit` dari `StockItem`. `supplier` perlu kolom pemasok pada
  barang (nama + nomor WhatsApp); tanpa itu barang tidak bisa dipesan lewat aplikasi, tetap tampil.
- **Penjualan, grafik, cabang** (`sales`, `series`, `branches`): dari laporan penjualan stok (`stock_report`, penjualan
  per hari) untuk pengguna warkop/toko, atau dari kasir (Moka, self-service OAuth, lihat riset ERP) bila tersambung.
  Satu tempat = satu usaha; `Semua` = jumlahnya. Pembanding (`compareLabel`) dihitung server dari rentang yang sama.
- **Pesanan** (`orders`): TikTok Shop ("Tokopedia & Shop", rencana sudah dipilih) bila tersambung; saluran lain
  (Shopee, Lazada) menyusul dengan `channel` baru tanpa mengubah aplikasi. Tanpa integrasi: `orders: []`.
- **Laporan** (`report`): berkas Excel dari `stock_report` (mode excel) lewat jalur dokumen yang ada (`src/files/`),
  disimpan sebagai media pengguna; `mediaId` dipakai `GET /media/:id`.
- **Sumber** (`sources`): daftar dari tabel koneksi yang sama dengan Terhubung. `connected: false` untuk yang tersedia
  tapi belum disambung supaya aplikasi bisa menawarkannya.
- **Pesan lagi** (`POST /business/reorder`): memakai jalur draf yang sudah ada (`pending_actions`/relay menjadi kartu
  `draft`, bagian 9.5): buat draf pesan WhatsApp ke pemasok (isi: nama barang dan jumlah standar), simpan sebagai pesan
  asisten, kembalikan id draf dan id pesan. Tidak ada pengiriman tanpa persetujuan; tidak ada tindak lanjut otomatis.
  Idempoten: simpan keterkaitan `stockId` -> draf terbuka dan kembalikan yang sama selama statusnya `draft`.
- `rev`: satu penghitung per pengguna; naik saat mutasi baru masuk, stok berubah, pesanan berubah, laporan baru, atau
  `reorderDraftId` berubah (draf dibuat/dikirim/dibuang). Siarkan `business` untuk pasangan `place`+`period` yang
  berubah; gabungkan perubahan yang berdekatan.
- Pengguna tanpa sumber tersambung: jawab data kosong (bukan 404) dengan `sources` yang bisa disambung.

## Perbaikan setelah tinjauan Fase 2a-6a (F1)

Semua aditif atau memperketat aturan yang belum pernah dipakai server asli; `CONTRACT_VERSION` tetap 1. Uraian lengkap di
`docs/api-v1.md`; yang perlu dikerjakan server:

- **Tanda terima alarm milik sesi.** Simpan per sesi (`app_sessions`), bukan per akun. Gugurkan saat `auth/logout`,
  saat `DELETE /push-tokens` mencabut token sesi itu, dan saat ganti akun. Server hanya menahan pengingat WhatsApp kalau
  HP pemilik tanda terima itu terlihat dalam 12 jam terakhir (stream tersambung atau request apa pun dengan token
  sesinya); selain itu kirim lewat WhatsApp seperti biasa. Tanda terima juga menahan push `pengingat` untuk pengingat yang
  sama. Aplikasi tidak mengirim penghapusan tanda terima sendiri: ia mengandalkan pencabutan sesi dan token push.
- **Kejadian berulang.** Tiap kejadian punya `id` sendiri `<seriesId>:<YYYY-MM-DD>` dan `seriesId`. Selesai, tunda, dan
  tanda terima per kejadian; `PATCH` dan `alarm-ack` memakai id kejadian.
- **`way` kosong = `notif`.** Hanya `way: "alarm"` yang dijanjikan aplikasi sebagai alarm di HP.
- **Tunda** `snoozeUntil` = maks(`snoozedUntil` ?? `at`, sekarang) + 10 menit dari aplikasi. Server tidak perlu menghitung
  ulang, tapi boleh menolak (400) tundaan yang jauh di masa lalu. `PATCH` yang sama bisa datang berulang dan terlambat
  (aplikasi mengulangnya sampai berhasil): jadikan idempoten.
- **`GET /agenda`** menambah `tzOffsetMinutes` (menit dari UTC; WIB 420). `POST /agenda/parse` membalas 422 `tidak_paham`
  untuk kalimat yang tidak terbaca (bukan 400).
- **`GET /home`** menambah `places` (tempat nyata pengguna tanpa `Semua`). `PUT /places/current` yang menolak tempat
  tetap 400.
- **PIN.** `PUT /account/security { pinEnabled: false }` WAJIB membawa `pin` yang benar (403 `pin_salah` bila hilang atau
  salah). `POST /account/pin` menerima `enable: true` (PIN tersimpan dan permintaan PIN hidup dalam satu transaksi).
- **`rev` tidak pernah turun di aplikasi.** Server tidak boleh menurunkan `rev` per pengguna (termasuk setelah restart).
  Aplikasi membuang jawaban muat yang `rev`-nya lebih kecil dari yang dipegang.


## Terhubung (Fase 2a, Tugas 5; server menyusul)

Kontrak: `docs/api-v1.md` bagian 2.16. Aplikasi sudah memakainya penuh lewat server tiruan.

Peta ke milo-ai. Di sana tiap integrasi punya modul `connect.ts` sendiri (halaman web bertanda tangan yang dikirim lewat
WhatsApp); aplikasi memakai satu pintu untuk semuanya, jadi `GET /connections` adalah penyusun dari tabel koneksi yang
sudah ada, dan `start` membungkus `beginAuth`/`connectUrlFor` tiap modul:

| `id` di aplikasi | Modul milo-ai | Catatan |
|---|---|---|
| `gcal`, `gmail`, `gdrive` | `src/google/` (`connect.ts`, `client.ts`, `calendar.ts`, `gmail.ts`, `drive.ts`) | satu OAuth Google, tiga layanan (`parseServices`, `enabledServices`); izin `baca_tulis` = scope tulis |
| `m365` | `src/microsoft/` (`outlook_*`) | menunggu aplikasi Entra + publisher verification |
| `notion` | `src/notion/` | |
| `plaud`, `rapat` | `src/plaud/` (DCR + OAuth per pengguna), `src/meetings/` | Recall untuk rapat; `plaud_disconnect` sudah ada |
| `bca` (Moota) | `src/moota/` (`bank_*`) | nama tampil "Mutasi rekening"; akun = rekening |
| `moka`, `accurate` | belum ada (riset ERP: OAuth self-service) | tampil di katalog, `start` baru jalan setelah integrasinya ada |
| `tiktok` | belum ada (rencana "Tokopedia & Shop") | |
| `github` | `src/github/` (GitHub App) | pengguna memilih repo di halaman GitHub; `account` = login |
| `smartthings`, `homeassistant`, `imou`, `kotak` | `src/home/providers/` (`smartthings.ts`, `ha.ts`, `imou.ts`, ...), `src/home/connect.ts` | Kotak disambungkan lewat Tambah perangkat, bukan `start` (400 `tidak_valid`) |
| `shopee`, `instagram` | belum ada | `status: soon` |

- **`connected`/`formerly`**: baris koneksi per pengguna dan layanan; diputus = tandai `revoked_at` (jangan hapus baris)
  supaya masuk `formerly` dan `since` terjaga. `lastUsed` dari pemakaian alat agen terakhir yang memakai koneksi itu
  (`activity/log`); `account` dari profil OAuth (email, nama toko).
- **`ring`**: layanan punya simpul bila ia bagian dari yang digambar di cincin (aturan yang sama dengan `home.ring`);
  setelah tersambung server menaikkan `home.rev` dan menyiarkan `home` dengan simpul baru di ujung.
- **`needsAttention`**: token kedaluwarsa/dicabut (refresh gagal dengan `invalid_grant`), perangkat tidak terjangkau
  (Imou/CCTV), atau webhook mati (Moota). Kalimat siap tampil: "Perlu disambungkan ulang" untuk yang pertama.
- **`forget`**: memakai `src/privacy/forget.ts` (`planForget` + `runForget`) untuk sumber layanan itu (`FORGET_SOURCES`:
  `google`/`gmail`/`calendar`/`drive`, `notion`, `outlook`, `moota`, `github`, `plaud`, `meetings`, `rumah`); jumlah =
  `ForgetPlan` yang dihitung (pesan, catatan, ringkasan yang terhapus). Aplikasi sudah menampilkan layar konfirmasi
  sendiri, jadi `POST /connections/:id/forget` langsung menjalankan (tanpa kartu `memory_forget` di WhatsApp) dan mencatat
  riwayatnya di Riwayat. Layanan baru yang menambah ingatan harus ditambahkan ke `SPECS` di `forget.ts`, atau tombolnya
  tidak menghapus apa-apa (jawab `forgotten: 0`).
- **`DELETE`**: cabut token di sisi penyedia bila ada endpoint pencabutan (Google `revoke`, GitHub hapus grant), hapus
  kredensial tersimpan, tandai diputus. Tidak menyentuh ingatan.
- **`start`/callback**: `state` sekali pakai terikat pengguna + layanan (tabel `connect_states`, TTL 10 menit), PKCE bila
  didukung, redirect URI terdaftar = `PUBLIC_BASE_URL/connect/<layanan>/callback` (host `PUBLIC_BASE_URL`, ingat
  kasus domain ganda). Akhir callback: redirect ke `sekretarisai://terhubung/tersambung?id=<id>&ok=1` (atau `ok=0&reason=`),
  bukan halaman web "sudah tersambung" seperti di alur WhatsApp. Alur WhatsApp lama (tautan bertanda tangan) tetap jalan
  dan memakai penyimpanan yang sama, jadi sambungan dari WhatsApp muncul di aplikasi lewat event `connection`.
- `rev`: satu penghitung per pengguna; naik saat layanan tersambung, diputus, atau `needsAttention` berubah.
- **Izin**: `baca`/`baca_tulis` disimpan per koneksi dan DIPAKSA di alat agen (alat tulis ditolak untuk koneksi `baca`;
  registri `WRITE_TOOLS` sudah ada). Mengubah izin menaikkan `rev` dan menyiarkan `connection`.

## Riwayat (Fase 2a, Tugas 6; server menyusul)

Kontrak: `docs/api-v1.md` bagian 2.17. Aplikasi sudah memakainya penuh lewat server tiruan.

Peta ke milo-ai:

- **`GET /history`** menyusun satu aliran dari yang sudah ada, bukan tabel baru: `activity_log` (`src/activity/log.ts`,
  `recordActivity`: tulisan langsung ke layanan pengguna, kolom `tool`, `service`, `summary`, `created_at`) digabung dengan
  yang dibaca `src/activity/` dari tabelnya sendiri (pesan ke orang lain/relay, tanya jasa, tagihan, kurir, aksi
  menunggu `pending_actions`). `id` entri = awalan sumber + id baris (`log-123`, `pa-45`), supaya stabil dan unik.
  Penanda halaman `before` = `(created_at, id)` yang dikodekan; urutan terbaru dulu.
- **`kind`**: `kirim` (relay, `gmail_send`, `outlook_send`, `order_place`, undangan), `rumah` (`src/home/`), `agenda`
  (pengingat, tugas), `usaha` (stok, pesanan, laporan), `bayar` (pembelian dan tagihan), `sambung` (menyambung atau memutus
  layanan, ubah izin), `lainnya` (sisanya, termasuk `memory_forget`).
- **`title` / `detail`**: kalimat dari `summary`/`what` yang sama dengan jawaban "kamu sudah ngapain aja?" di WhatsApp, tanpa
  jam (jam dari `at`). `channel`: `app` untuk tindakan dari aplikasi, `whatsapp` untuk pesan dari WhatsApp, `chat` untuk
  perintah di percakapan atau suara.
- **`status` dan `undoable`** dari draf: `held` -> `menunggu` dengan `undoable { draftId, until: heldUntil }`, `sent` ->
  `terkirim`, `cancelled` -> `dibatalkan`, `failed` -> `gagal`. `draftId` = id draf kartu yang sama dengan `POST /drafts/:id`
  (Batalkan tidak punya jalur baru). Entri kiriman dibuat saat draf disetujui (`send`), bukan saat draf dibuat.
- **`link`**: kiriman -> `{ route: '/chat' }`; perangkat -> `{ route: '/perangkat/[id]', params: { id } }`; layanan ->
  `/terhubung/[id]`; selain itu kosong.
- **Event `history`**: siarkan saat entri dibuat atau `status`-nya berubah (termasuk lewat tugas masa tahan yang sama dengan
  event `draft`). `rev` = penghitung per pengguna (sequence), naik sekali per putaran perubahan.
- `now` di jawaban: jam server, untuk hitung mundur Batalkan.

## Akun (Fase 2a, Tugas 6; server menyusul)

Kontrak: `docs/api-v1.md` bagian 2.18. Aplikasi sudah memakainya penuh lewat server tiruan.

Peta ke milo-ai:

| Bagian `Account` | Sumber di milo-ai | Catatan |
|---|---|---|
| `me`, `assistant.name` | `users.assistant_name` (lewat `src/profile/names.ts` untuk membersihkan nama) | `PUT /account/assistant` menulis kolom yang sama, jadi nama juga berubah di WhatsApp. 400 `nama_tidak_valid` bila bukan 2-20 huruf; jangan menebak seperti `names.ts` ("Ya boleh ibnu saja" bukan nama). |
| `assistant.style` | `src/profile/style.ts` / `users.persona` (`src/persona/catalog.ts`) | `singkat`/`ramah`/`formal` dipetakan ke gaya jawaban di prompt (panjang jawaban dan sapaan); persona dan karakter foto tidak ikut berubah. |
| `plan` | `users.plan`, `trial_ends_at`, `period_ends_at`, `trial_claims` (`src/onboarding/trial.ts`) | `trial` bila `trial_ends_at` belum lewat dan belum bayar (7 hari, sekali seumur nomor); `aktif` bila `period_ends_at` di depan; selain itu `berakhir`. `until` = `trial_ends_at` atau `period_ends_at`. `price` dari katalog paket. |
| `greeting` | rutinitas pagi di `profile.routines` (`src/routines/routines.ts`), `profile.initiative` | `daily: false` mematikan rutinitas sapaan seperti jawaban "stop sapa saya" (tingkat `none` di `src/profile/initiative.ts` mematikan sapaan sekalian); pengingat buatan pengguna tidak disentuh. `time` = `routineTime` sapaan pagi. Bila `initiative.level` `none`, `daily` dibaca `false`. |
| `notifications` | kolom baru di profil (`profile.push`) | Menyaring push saja; WhatsApp cadangan dan alarm lokal tidak terpengaruh. Pilihan `pengingat: false` hanya menekan push-nya, bukan pengingat itu sendiri. |
| `security` | PIN akun (bagian 2.11) | Sama dengan `GET /account/security`. |
| `phones` | `app_sessions` (+ `app_push_tokens`) | Satu baris per sesi hidup: `name` dari model HP yang dikirim saat `auth/verify`, `platform`, `lastSeen` = `last_seen_at`, `current` = sesi pemanggil. `DELETE /account/phones/:id` = `revoked_at` pada sesi itu, hapus token push-nya, tutup soket stream-nya dengan 4401. Sesi pemanggil: 400. |
| `privacy.services` | `src/privacy/forget.ts` (`planForget`) per sumber `FORGET_SOURCES` | `memoryCount` = hitungan rencana lupakan layanan itu, sama dengan `memoryCount` di detail Terhubung. Hanya layanan tersambung yang punya ingatan. |

- **Hapus akun dan pembayaran tetap di WhatsApp.** `src/privacy/erase.ts` (hapus akun) dan alur QRIS tidak punya jalur di
  API ini; aplikasi hanya membuka WhatsApp dengan kalimat awal. Jangan menambah `forget-all`.
- **Event `account`**: siarkan Akun lengkap setelah setiap perubahan di atas, juga yang berasal dari WhatsApp (ganti nama
  lewat percakapan, langganan dibayar, masa coba habis, "stop sapa saya"). `rev` = penghitung per pengguna.
- `PUT /account/*` dan `DELETE /account/phones/:id` membalas `Account` terbaru (bukan `OkRes`), supaya aplikasi tidak perlu
  `GET` lagi.
- Nama saluran notifikasi Android ("Pesan dari {nama}") mengikuti `me.assistantName`; aplikasi memperbaruinya sendiri begitu
  nama diubah.
