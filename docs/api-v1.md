# API aplikasi v1 (serah-terima ke server Fase 1b)

Ditulis 20 Okt 2026 untuk pembuat server di milo-ai. Sumber kebenaran sampai Fase 1b adalah
`src/api/contract.ts` di repo ini (skema zod dan komentar kepala berkas). Dokumen ini menguraikannya dalam bahasa
biasa, dengan contoh, aturan perilaku, dan petunjuk memetakannya ke kode milo-ai. Kalau dokumen ini dan
`contract.ts` berbeda, `contract.ts` yang benar; mohon beri tahu supaya dokumen diperbaiki. Perilaku acuan bisa
dilihat di `src/api/fake/FakeTransport.ts` dan `scenario.ts` (server tiruan di memori yang dipakai mode `contoh`).
Catatan reviu yang lebih pendek ada di `docs/catatan-server-fase-1b.md`.

## 1. Gambaran, versi, dan konvensi

- Jalur dasar: `/app/v1` (konstanta `API_PREFIX`). Semua jalur di bawah ditulis relatif terhadapnya.
- Isi request dan response: JSON (`Content-Type: application/json`). POST tanpa isi tetap mengirim `{}` (Fastify
  menolak body JSON kosong, jadi klien tidak pernah mengirim body kosong).
- Otorisasi: `Authorization: Bearer <token>` di setiap jalur kecuali `auth/start` dan `auth/verify`. Token berasal
  dari `auth/verify`.
- Header versi di setiap request HTTP dan di jabat tangan WebSocket:
  - `X-App-Version`: versi aplikasi, contoh `1.0.0`;
  - `X-Contract-Version`: versi kontrak (`CONTRACT_VERSION`, sekarang `1`).
  - Kalau salah satunya di bawah yang didukung server, balas `426 perlu_pembaruan`. Aplikasi lalu menampilkan "Ada
    versi aplikasi yang lebih baru" dan mematikan kolom ketik. Perubahan yang kompatibel (tambahan bagian pesan,
    jenis kartu, atau nilai enum) tidak menaikkan versi: aplikasi membaca longgar (bagian 8).
- Waktu: selalu ISO 8601 dengan zona (`2026-10-20T03:42:00.000Z` atau `2026-10-20T10:42:00+07:00`). Aplikasi yang
  memformatnya ke jam HP. Jangan kirim `HH.MM` tanpa tanggal.
- Nomor telepon: E.164 tanpa "+", pola `^[1-9]\d{8,14}$`, contoh `6281220457781`.
- Id: string tak kosong, tak transparan bagi klien (boleh angka dalam bentuk string).
- Teks pesan atau draf: dipotong spasi, 1 sampai 4096 karakter (`TEXT_MAX`).
- Bentuk error: status 4xx/5xx dengan `{ "error": "<kode>" }`, `retryInSec` hanya pada `terlalu_sering`, dan `waNumber`
  hanya pada `belum_terdaftar`. Pasang
  error handler dan not-found handler Fastify sendiri supaya bentuk bawaan Fastify tidak bocor. Aplikasi tidak
  menampilkan kode error ke pengguna; ia menerjemahkannya ke kalimat biasa.

### Kode error

| Status | `error` | Arti |
|---|---|---|
| 400 | `tidak_valid` | Isi tidak sesuai skema, atau `choiceId` bukan pilihan di pesan itu |
| 400 | `kode_salah` | Kode masuk salah, kedaluwarsa, habis percobaan, atau belum diminta |
| 401 | `tidak_masuk` | Token tidak ada, salah, kedaluwarsa, atau sudah keluar. Aplikasi menghapus sesi |
| 403 | `diblokir` | Akun dinonaktifkan atau diblokir di admin. Sesi tidak dihapus |
| 403 | `pin_salah` | PIN (atau PIN lama) tidak cocok. Bukan `diblokir`: sesi dan akun tidak terpengaruh |
| 404 | `tidak_ditemukan` | Draf, pesan, atau media tidak ada atau milik orang lain (jangan bedakan) |
| 404 | `belum_terdaftar` | Dari `auth/start` (dan `auth/verify`): nomor belum punya akun. Bawa `waNumber` |
| 409 | `status_draf` | Aksi draf tidak boleh dari status sekarang |
| 409 | `sudah_dipilih` | Pilihan di pesan itu sudah diambil |
| 426 | `perlu_pembaruan` | Versi aplikasi atau kontrak terlalu lama |
| 429 | `terlalu_sering` | Terlalu sering; bawa `retryInSec` |
| 500 | `server` | Kendala lain |
| 501 | `belum_tersedia` | Jalur ada di kontrak tapi belum diisi (kendali perangkat sebelum Fase 3) |

Urutan pemeriksaan yang disarankan di setiap jalur terlindungi: versi (426) → token (401) → akun diblokir (403) →
validasi isi (400) → aturan jalur. Jalur `GET /me` harus membalas 401, 403, dan 426 dengan benar juga untuk akun
yang ditolak; alasannya ada di bagian 5 (pemeriksaan jabat tangan).

## 2. Endpoint

### 2.1 `POST /auth/start`

Meminta kode masuk 6 angka yang dikirim lewat WhatsApp. Tanpa token.

Request:

```json
{ "phone": "6281220457781" }
```

Response 200 (`resendInSec`: jeda sebelum boleh meminta lagi):

```json
{ "resendInSec": 60 }
```

Error: 400 `tidak_valid` (nomor jelek), 403 `diblokir`, **404 `belum_terdaftar`**, 426, 429 `terlalu_sering` (dengan
`retryInSec`).

`belum_terdaftar` (keputusan founder: aplikasi adalah add-on, akun dan masa coba hanya lewat WhatsApp): nomor yang belum
punya akun dibalas SEBELUM kode dikirim, dengan nomor WhatsApp Sekretaris AI (E.164 tanpa "+") supaya aplikasi bisa
mengarahkan pengguna memulai di sana:

```json
{ "error": "belum_terdaftar", "waNumber": "6281100002222" }
```

`waNumber` boleh dihilangkan; aplikasi lalu memakai nomor cadangan dari konfigurasinya (`EXPO_PUBLIC_WA_NUMBER`) atau,
bila tidak ada juga, hanya menampilkan kalimat tanpa tombol. Aplikasi menampilkan "Nomor ini belum memakai Sekretaris
AI. Mulai dulu lewat WhatsApp ya." dan tombol "Mulai lewat WhatsApp" yang membuka `https://wa.me/<waNumber>?text=Halo%2C%20saya%20mau%20coba%20Sekretaris%20AI.`
Karena itu respons tidak lagi sama untuk nomor terdaftar dan belum: batasi laju per IP dan per nomor (bagian 4) supaya
jalur ini tidak dipakai untuk menebak pelanggan.

Aturan lain: lihat bagian 4 (masa berlaku kode, batas percobaan, batas per nomor dan IP, template WABA).

### 2.2 `POST /auth/verify`

Request:

```json
{ "phone": "6281220457781", "code": "482915" }
```

Response 200 (`token` dipakai di `Authorization`; `user` sama dengan `GET /me`):

```json
{
  "token": "q3V0...panjang-acak",
  "user": {
    "id": "123",
    "name": "Pak Budi",
    "assistantName": "Nadia",
    "plan": { "name": "Percobaan 7 hari", "activeUntil": "2026-10-27T10:00:00.000Z" },
    "phone": "6281220457781"
  }
}
```

Error: 400 `tidak_valid` (kode bukan 6 angka), 400 `kode_salah`, 403 `diblokir`, 404 `belum_terdaftar` (nomor yang
tidak punya akun tidak pernah dibuatkan akun di sini; sama bentuknya dengan 2.1), 426, 429.

### 2.3 `POST /auth/logout`

Request `{}`. Response `{ "ok": true }`. Mencabut token yang dipakai beserta token push sesi itu (bagian 4). Aplikasi
sudah menghapus sesinya di HP lebih dulu dan memanggil jalur ini di belakang layar; gagal pun HP sudah keluar. Token
yang sudah dicabut dibalas 401 (aplikasi mengabaikannya).

### 2.4 `GET /me`

Response 200:

```json
{
  "id": "123",
  "name": null,
  "assistantName": "Nadia",
  "plan": { "name": "Percobaan 7 hari", "activeUntil": "2026-10-27T10:00:00.000Z" },
  "phone": "6281220457781"
}
```

- `name`: boleh `null` (pengguna baru yang belum menyebut namanya); Akun lalu menampilkan `phone`.
- `assistantName`: nama asisten yang dipilih pengguna (default "Nadia"; di milo-ai ada `assistantNameOf(user)`).
- `plan.name` wajib terisi; `activeUntil` boleh `null` untuk paket tanpa batas.
- Dipanggil juga sebagai pemeriksaan penyebab setelah soket gagal terbuka 3 kali berturut-turut (bagian 5): harus
  membalas 403 `diblokir` / 426 / 401 dengan benar.

### 2.5 `GET /messages`

Dua mode, tidak boleh dipakai bersamaan (campuran dibalas 400 `tidak_valid`). `limit`: 1 sampai 100, bawaan 30.

**Riwayat (terbaru dulu): `GET /messages?limit=30&before=<seq>`**

```json
{
  "items": [
    {
      "id": "812", "seq": 812, "rev": 1405, "at": "2026-10-20T03:42:00.000Z",
      "from": "assistant", "via": "app",
      "parts": [{ "type": "text", "text": "Sudah saya catat ya, Pak." }]
    }
  ],
  "before": 790
}
```

- `items` berurutan dari yang terbaru ke yang lebih lama.
- `before` di response = nilai `?before=` untuk halaman berikutnya (seq pesan tertua di halaman itu), atau `null`
  kalau tidak ada yang lebih lama.
- Tanpa `before`: halaman terbaru.
- `before` yang tidak ada di utas (misalnya setelah `memory_forget` menghapus pesan) dibalas dengan halaman terbaru,
  bukan error. Begitu pula `before` yang lebih besar dari semua seq.
- Kartu `draft` di riwayat selalu membawa keadaan draf yang terbaru, bukan keadaan saat pesan dibuat.

**Resync (terlama dulu menurut `rev`): `GET /messages?limit=100&changedAfter=<rev>`**

```json
{ "items": [ { "id": "790", "seq": 790, "rev": 1406, "...": "..." } ], "more": true }
```

- Mengembalikan paling banyak `limit` pesan dengan `rev` LEBIH BESAR dari `changedAfter`, berurutan dari `rev`
  terkecil. Pesan lama yang baru diperbarui (QRIS jadi `lunas`, draf `held` jadi `sent`, `chosenId` terisi) ikut
  karena `rev`-nya naik, walaupun `seq`-nya lama.
- `more: true` berarti masih ada: klien mengulang dengan `changedAfter` = `rev` pesan terakhir di `items`.
- `changedAfter=0` memberi pesan dari awal. `changedAfter` yang lebih besar dari semua `rev` memberi `items: []`,
  `more: false` (bukan error).
- Klien menggabungkan berdasarkan `id`, jadi mengirim pesan yang sudah dikenal aman.

`seq` dan `rev` (aturan penting):

- `seq`: nomor urut pesan di utas. Hanya naik, tetap seumur pesan (upsert tidak mengubahnya). Dipakai untuk urutan
  dan `before`.
- `rev`: nomor perubahan per pengguna, hanya naik. Diberi nilai baru (lebih besar dari semua `rev` yang pernah ada
  milik pengguna itu) pada setiap INSERT pesan dan setiap UPDATE pesan, termasuk saat draf di dalam kartunya
  berubah. Pesan yang tidak berubah tidak berubah `rev`-nya. Dipakai untuk resync, bukan untuk urutan tampil.
- Keduanya integer positif.

### 2.6 `POST /messages`

Dua bentuk, objek ketat (kunci tak dikenal atau campuran dibalas 400 `tidak_valid`).

Teks:

```json
{ "kind": "text", "clientId": "c-7f3a", "text": "Tolong ingatkan saya rapat jam 3." }
```

Pilihan (untuk bagian `choices` di pesan asisten; aplikasi TIDAK mengirim judulnya):

```json
{ "kind": "choice", "clientId": "c-7f3b", "messageId": "812", "choiceId": "ya" }
```

Response 200 (pesan pengguna yang tersimpan, lengkap dengan `clientId` yang sama):

```json
{
  "message": {
    "id": "813", "seq": 813, "rev": 1407, "clientId": "c-7f3a",
    "at": "2026-10-20T03:43:00.000Z", "from": "user", "via": "app",
    "parts": [{ "type": "text", "text": "Tolong ingatkan saya rapat jam 3." }]
  }
}
```

Aturan:

- `clientId` (1 sampai 64 karakter) dibuat aplikasi, unik per pasangan (pengguna, `clientId`). Mengirim ulang
  `clientId` yang sama TIDAK membuat pesan baru: kembalikan pesan yang sudah tersimpan (200, walaupun isi request
  berbeda). Ini yang membuat "Coba lagi" dan antrean offline aman diulang. Simpan `clientId` di kolom/ indeks unik
  supaya dua request serentak tidak membuat dua pesan.
- Pesan pengguna langsung disimpan dan dikembalikan sebelum agen berjalan. Sesudah itu stream mengirim: event
  `message` pesan pengguna itu (ikut dengan `clientId`), `thinking on` dengan `runId`, satu atau beberapa `message`
  dari asisten, lalu `thinking off` dengan `runId` yang sama. `thinking off` harus selalu terkirim (juga saat agen
  gagal), kalau tidak aplikasi menampilkan "sedang berpikir" selamanya.
- `choice`: server mencari pesan `messageId` milik pengguna itu (404 `tidak_ditemukan` kalau tidak ada atau milik
  orang lain), mencari bagian `choices` yang memuat `choiceId` (400 `tidak_valid` kalau tidak ada), dan mengambil
  JUDUL dari pilihan tersimpan itu. Pesan pengguna yang disimpan berisi satu bagian `text` dengan judul itu, lalu
  diteruskan ke pipeline seperti tombol WhatsApp (`inbound: { kind: 'button', id, title }`).
- Pilihan hanya boleh diambil sekali: setelah `chosenId` terisi, `choice` lain untuk pesan itu dibalas 409
  `sudah_dipilih`. Pengulangan dengan `clientId` yang sama tetap mengembalikan pesan asli (idempoten dulu, baru
  periksa `sudah_dipilih`). Saat pilihan diambil, pesan asisten diperbarui (upsert) dengan `chosenId` terisi, `rev`
  naik, dan event `message` disiarkan.
- Error: 400, 401, 403, 404 (choice), 409 `sudah_dipilih`, 426, 429, 500.
- Unggah media dari pengguna belum ada di v1 (tombol lampiran di aplikasi hanya menampilkan toast).

### 2.7 `POST /drafts/:id`

Aksi terhadap kartu `draft` (kiriman ke orang lain yang menunggu persetujuan). `:id` adalah `draft.id`.

Request, salah satu:

```json
{ "action": "send" }
{ "action": "cancel" }
{ "action": "discard" }
{ "action": "edit", "text": "Baik Pak, saya konfirmasi hadir jam 10." }
```

Response 200 (keadaan draf sesudah aksi, dan `rev` pesan yang memuat kartunya setelah dinaikkan oleh aksi ini):

```json
{
  "draft": {
    "id": "d-17", "to": "Pak Budi", "channel": "whatsapp", "what": "balasan",
    "text": "Baik Pak, saya konfirmasi hadir jam 10.",
    "status": "held", "heldUntil": "2026-10-20T03:48:00.000Z"
  },
  "rev": 1408
}
```

Mesin status (`draft.status`: `draft`, `held`, `sent`, `cancelled`, `failed`):

| Aksi | Boleh dari | Hasil |
|---|---|---|
| `send` | `draft`, `failed` | `held` dengan `heldUntil` = sekarang + 5 menit (`HELD_MINUTES`) |
| `cancel` | `held` | `cancelled` |
| `discard` | `draft` | `cancelled` |
| `edit` | `draft` | tetap `draft`, `text` diganti |
| (otomatis) | `held` setelah 5 menit | `sent`, atau `failed` kalau pengiriman gagal |

- `send` dari `failed` adalah "Coba lagi": kembali ke `held` dengan masa tahan baru 5 menit.
- `sent` dan `cancelled` adalah akhir. Aksi dari status yang tidak diizinkan dibalas 409 `status_draf`.
- `heldUntil` wajib ada sejak `held`; boleh dibuang di status lain. Skema menolak `held` tanpa `heldUntil`.
- Pengiriman otomatis setelah 5 menit dijalankan penjadwal yang tahan restart (job di database yang dibaca
  berkala), bukan `setTimeout` di memori. Peralihan `held` → `sent` dan `cancel` HARUS memakai update bersyarat
  (`UPDATE ... SET status = 'sent' WHERE id = $1 AND status = 'held' RETURNING ...`); yang menang adalah yang
  barisnya terupdate. Kalau `cancel` kalah, balas 409 `status_draf`.
- Setiap perubahan draf (juga yang berasal dari aksi aplikasi atau penjadwal) disiarkan lewat event `draft` ke
  SEMUA soket pengguna itu dan menaikkan `rev` pesan pembawa kartunya. Perubahan karena aksi aplikasi juga
  dikembalikan di response; klien membuang duplikatnya (event `draft` menimpa kartu dengan `draft.id` yang sama).
- Response dan event `draft` membawa `rev` = `rev` BARU pesan pembawa kartu (nilai yang sama dengan `rev` pesan itu
  di `GET /messages` sesudahnya). Klien membuang pembaruan draf yang `rev`-nya lebih kecil dari `rev` pesan di
  layarnya (misalnya response `held` yang datang sesudah event `sent`), dan memajukan `rev` pesan itu ke `rev` yang
  diterima. `rev` yang hilang dibaca 0 oleh aplikasi: drafnya tetap dipasang, tanpa memajukan `rev` pesan.
- Aplikasi mengunci tombol kartu selagi aksinya berjalan. 409 `status_draf` (misalnya `cancel` setelah `sent`) membuat
  aplikasi memberi tahu pengguna dan mengambil keadaan terbaru lewat `GET /messages?changedAfter=`.
- Kiriman ke orang lain tidak pernah keluar tanpa persetujuan pengguna (`send`). Server tidak boleh mengirim
  sendiri walaupun agen "yakin".
- 404 `tidak_ditemukan` kalau draf tidak ada atau milik orang lain.

### 2.8 `POST /push-tokens` dan `DELETE /push-tokens`

Request:

```json
{ "pushToken": "ExponentPushToken[...] atau token FCM", "platform": "android" }
```

Response `{ "ok": true }`. `platform`: `android` atau `ios`.

- Simpan per sesi (token → `app_sessions`), upsert: token yang sama dari sesi lain memindahkan kepemilikannya
  (satu perangkat fisik = satu pemilik pada satu waktu). Aplikasi mengirim ulang setiap kali dibuka dari keadaan
  mati (satu kali per proses) dan saat token berubah, jadi pendaftaran yang hilang pulih sendiri.
- Logout menghapus token push sesi itu. Token yang ditolak FCM (`UNREGISTERED`) dihapus server.
- Jenis token yang dikirim aplikasi bergantung pada pembangunan push (Expo push atau token FCM native); putuskan
  bersama saat mengisi `push.ts`, lihat pertanyaan terbuka di bagian 10.

`DELETE /push-tokens` (mencabut token):

```json
{ "pushToken": "token FCM yang tadi didaftarkan" }
```

Response `{ "ok": true }`.

- **Tanpa `Authorization`**: dipanggil setelah pengguna keluar, dan keluar di HP tidak menunggu server. Token FCM
  panjang dan acak, jadi tokennya sendiri yang menjadi bukti kepemilikan. Kalau `Authorization` ikut dikirim, tidak
  dipakai.
- Idempoten: token yang tidak dikenal (sudah dihapus oleh `auth/logout` atau FCM) tetap `{ "ok": true }`. 400
  `tidak_valid` kalau `pushToken` kosong atau bukan string.
- Alasannya: `auth/logout` di latar belakang bisa tidak pernah sampai (mode pesawat). Aplikasi menyimpan token yang
  belum dicabut dan mengulang `DELETE` tiap aplikasi dibuka atau kembali aktif sampai berhasil.

**Isi push yang dikirim server (FCM):**
- Setiap push wajib membawa `data.kind`: `"pesan"` (pesan chat dari asisten) atau `"pengingat"` (pengingat, alarm,
  kabar penting).
- Pakai saluran Android yang sesuai, `channelId: "pesan"` atau `"pengingat"`.
- Aplikasi meredam push `pesan` saat layar chat sedang terbuka, tetapi **tidak pernah** meredam `pengingat`. Push
  tanpa `data.kind` diperlakukan menurut salurannya, dan saluran bawaan aplikasi adalah `pesan`. Jadi pengingat tanpa
  `kind` bisa ikut teredam.
- `data.route` boleh diisi salah satu rute yang diizinkan: `/chat` (bawaan), `/agenda`, `/riwayat`, `/akun`,
  `/terhubung`, atau `/perangkat`. Rute lain diabaikan, dan aplikasi membuka chat.
- Isi notifikasi tampil di layar kunci sebagai privat (saluran `pesan`). Jangan menaruh isi sensitif di judul.

### 2.9 `POST /home/devices/:id` (Fase 3)

Request (objek ketat, minimal satu kunci; kalau kosong 400):

```json
{ "on": true, "temp": 24, "mode": "cool" }
```

Response 200: `{ "card": { "kind": "device", "deviceId": "ac-1", "name": "AC Kamar", "on": true, "temp": 24 } }`.
Di Fase 1b balas `501 { "error": "belum_tersedia" }` saja; aplikasi menampilkan "Kendali perangkat dari chat
segera hadir". Pembuatan kartu `device` oleh server juga menunggu Fase 3.

### 2.10 `GET /media/:id`

Mengirim berkasnya: gambar QRIS, gambar, dokumen, suara. Dirujuk dari `mediaId` di bagian `image`, `document`,
`audio`, dan kartu `qris`.

Persyaratan:

- Kepemilikan dicek: media milik pengguna lain (atau tidak ada) dibalas 404 `tidak_ditemukan`.
- `Content-Type` yang benar (sama dengan `mime` di bagian pesan) dan `Content-Disposition`: `inline` untuk gambar
  dan audio, `attachment; filename="<name>"` (dengan `filename*` UTF-8) untuk dokumen.
- Dukungan `Range` (`206 Partial Content`, `Accept-Ranges: bytes`) supaya audio bisa diputar dan dilompati.
- `Cache-Control: private, max-age=...` (jangan `public`). `ETag` boleh.
- Media dari WhatsApp harus disalin ke penyimpanan server saat pesan masuk (URL Fonnte kedaluwarsa). Gambar QRIS
  dari modul pembayaran disimpan dengan cara yang sama. Pesan yang menunjuk media yang sudah dihapus: 404, dan
  aplikasi menampilkan kendala biasa.
- Otorisasi lewat `Authorization: Bearer`, sama dengan jalur lain.

**Dokumen dibuka lewat unduhan biasa (diputuskan founder, tanpa URL bertanda tangan).** Aplikasi mengunduh dokumen
sendiri dengan header `Authorization: Bearer` ke cache HP (`GET /media/:id` apa adanya), lalu:

- **Buka**: dibuka di aplikasi bawaan HP. Android: `ACTION_VIEW` dengan alamat `content://` dan izin baca
  (`FLAG_GRANT_READ_URI_PERMISSION`); tanpa aplikasi yang bisa membukanya, jatuh ke lembar bagikan.
- **Bagikan**: lembar bagikan sistem.
- Selama mengunduh, kedua tombol sibuk ("Mengunduh…"). Gagal: "Berkasnya belum bisa diunduh. Coba lagi sebentar ya."
  atau, bila tidak ada aplikasi pembuka dan lembar bagikan tidak tersedia, "Tidak ada aplikasi di HP ini yang bisa
  membuka berkas ini."

Karena itu server TIDAK perlu `POST /media/:id/link` atau `?sig=`; yang dibutuhkan hanya `Content-Type`,
`Content-Disposition` dan `Content-Length` yang benar di atas (nama berkas dan jenisnya sudah ada di bagian `document`).
Dokumen dibuang dari cache oleh sistem Android saat ruang HP sempit. Aplikasi mode contoh membuat berkas teks kecil
sebagai contoh.

### 2.11 `GET/PUT /account/security`, `POST /account/pin`, `POST /account/pin/verify`

PIN opsional (keputusan founder): **bawaan mati**. Kalau pemilik menghidupkannya (Akun > PIN), aksi yang dijaga di
Perangkat (mematikan kamera, mematikan alarm rumah, membuka kunci pintu) meminta PIN 6 angka; kalau mati, aksi itu
langsung jalan. Pembayaran tidak pernah memakai PIN. Semua jalur ini memakai token.

`GET /account/security` dan `PUT /account/security` membalas keadaan:

```json
{ "pinEnabled": false, "hasPin": false }
```

- `PUT` mengirim `{ "pinEnabled": true }` (objek ketat). `pinEnabled: true` tanpa PIN dibalas 400 `tidak_valid`: PIN
  dibuat dulu lewat `POST /account/pin`. Mematikan tidak menghapus PIN-nya (`hasPin` tetap `true`). Aplikasi meminta
  PIN lebih dulu sebelum mematikan (lewat `verify`); server boleh menambah aturannya sendiri.
- `POST /account/pin` membuat atau mengganti PIN, membalas keadaan yang sama:
  `{ "pin": "123456" }` (belum ada PIN) atau `{ "pin": "654321", "currentPin": "123456" }` (ganti). PIN harus 6 angka
  (`^\d{6}$`, kalau tidak 400 `tidak_valid`). Sudah ada PIN tapi `currentPin` hilang: 400 `tidak_valid`; `currentPin`
  salah: 403 `pin_salah`. Membuat PIN tidak menghidupkan permintaan PIN; aplikasi memanggil `PUT` sesudahnya.
- `POST /account/pin/verify` dengan `{ "pin": "123456" }` membalas `{ "ok": true }`, atau 403 `pin_salah`. Aplikasi
  memanggilnya sebelum mematikan kamera dan sejenisnya, dan sebelum mengganti PIN. Beri batas percobaan salah dengan
  429 `terlalu_sering` (`retryInSec`).
- Disimpan sebagai hash (memakai `home_pins` yang sudah ada); PIN tidak masuk log.
- "Lupa PIN" (mengatur ulang tanpa PIN lama) belum ada di kontrak; aplikasi memberi tahu bahwa fiturnya segera hadir.

## 3. Bentuk pesan, bagian, dan kartu

Pesan:

```json
{
  "id": "812", "seq": 812, "rev": 1405,
  "clientId": "c-7f3a",
  "at": "2026-10-20T03:42:00.000Z",
  "from": "assistant",
  "via": "app",
  "parts": [ { "type": "text", "text": "..." } ]
}
```

- `from`: `user` atau `assistant`. `via`: `app` atau `whatsapp` (kanal tempat pesan ditulis atau dikirim). Satu utas:
  pesan WhatsApp pengguna tampil di aplikasi dengan tanda "lewat WhatsApp".
- `clientId` hanya ada pada pesan pengguna yang dikirim dari aplikasi.
- `parts`: minimal satu bagian. Jenisnya:

| `type` | Isi |
|---|---|
| `text` | `text` |
| `choices` | `prompt?`, `choices: [{ id, title, description? }]` (minimal 1), `chosenId?` (terisi setelah dipilih) |
| `image` | `mediaId`, `mime` (`image/*`), `caption?`, `alt?` |
| `document` | `mediaId`, `name`, `mime`, `sizeBytes` |
| `audio` | `mediaId`, `mime` (`audio/*`), `transcript?` |
| `card` | `card` (lihat di bawah) |

Server tidak pernah mengirim bagian `unknown` (itu dibuat aplikasi saat membaca bagian yang tidak dikenal).

Kartu (`card.kind`):

| `kind` | Isi |
|---|---|
| `draft` | `draft` (bagian 2.7) |
| `device` | `deviceId`, `name`, `on`, `temp?`, `mode?`, `note?` (Fase 3) |
| `notes` | `title`, `when` (teks siap tampil), `decisions: string[]`, `meetingId` |
| `payment` | `title`, `amountRp` (bilangan bulat Rupiah), `lines: [{ label, value }]`, `ask` ("Sudah benar?") |
| `qris` | `amountRp` (>0), `until` (ISO), `status`, `mediaId` |

Status QRIS: `menunggu` → `lunas` atau `kedaluwarsa`. Perubahannya lewat upsert pesan (bagian 6), dan `rev` naik.
`lunas` dan `kedaluwarsa` adalah akhir. `until` adalah batas bayar; server yang menetapkan `kedaluwarsa` saat lewat
(jangan mengandalkan jam HP).

Contoh pesan dengan kartu QRIS:

```json
{
  "id": "820", "seq": 820, "rev": 1420, "at": "2026-10-20T04:00:00.000Z",
  "from": "assistant", "via": "app",
  "parts": [
    { "type": "text", "text": "Silakan bayar lewat QRIS ini ya." },
    { "type": "card", "card": { "kind": "qris", "amountRp": 150000, "until": "2026-10-20T04:15:00.000Z",
      "status": "menunggu", "mediaId": "m-55" } }
  ]
}
```

## 4. Masuk, sesi, dan akun

Alur: pengguna memasukkan nomor → `auth/start` → server mengirim kode 6 angka lewat WhatsApp → pengguna memasukkan
kode → `auth/verify` → token.

Aturan kode:

- 6 angka acak (CSPRNG), disimpan sebagai hash (bukan teks), masa berlaku pendek (usul 10 menit), sekali pakai.
- Batas percobaan salah per kode (usul 5); sesudahnya kode dibatalkan dan pengguna harus meminta lagi (balas 400
  `kode_salah`, sama dengan kode salah biasa supaya tidak jadi petunjuk).
- Batas laju: per nomor (usul: satu kode per `resendInSec` = 60 detik, maksimal 5 per jam) dan per IP (usul 20 per
  jam). Terlampaui: `429 terlalu_sering` dengan `retryInSec` yang benar. Meminta kode baru membatalkan kode lama.
- Nomor yang belum punya akun dibalas 404 `belum_terdaftar` (dengan `waNumber`) tanpa mengirim kode; lihat akun baru di
  bawah. Konsekuensinya jalur ini membuka petunjuk siapa yang sudah menjadi pelanggan, jadi batas laju per IP dan per
  nomor dipegang ketat.
- Pengiriman lewat kanal WhatsApp yang ada. Di WABA (nomor resmi), kode untuk nomor di luar jendela 24 jam butuh
  template kategori **autentikasi** (berbayar per pesan); di Fonnte cukup teks. Isi otomatis satu ketuk di
  Android (Autofill/SMS Retriever) butuh nama paket dan hash tanda tangan aplikasi, yang baru ada di Fase 7.
- Kode tidak boleh masuk ke tabel `messages` utas (jangan tampil di riwayat chat), dan jangan dicatat di log.

Token:

- Acak minimal 128 bit (disarankan 256 bit, base64url) dari CSPRNG; yang disimpan di `app_sessions` hanya hash-nya
  (SHA-256 cukup, token berentropi tinggi). Simpan `user_id`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at`,
  `app_version`, `platform`.
- Masa berlaku jelas (usul geser: 90 hari sejak pemakaian terakhir). Kedaluwarsa dan dicabut sama-sama 401
  `tidak_masuk`.
- `auth/logout` mencabut token itu dan menghapus token push yang terkait. Mencabut semua sesi pengguna (dari admin
  atau saat akun diblokir) sebaiknya menutup soketnya dengan kode 4401.
- Akun yang `diblokir`/dinonaktifkan di admin: semua jalur terlindungi, termasuk `auth/verify` dan jabat tangan
  WebSocket, dibalas 403 `diblokir`. Sesi tidak dihapus (aplikasi menampilkan "Akun ini sedang tidak aktif").

Akun baru dan percobaan 7 hari (KEPUTUSAN FOUNDER, sudah diputuskan): aplikasi adalah add-on, jadi akun dan masa coba
7 hari hanya dibuat lewat WhatsApp (percakapan pertama dari nomor baru di milo-ai). `auth/start` (dan `auth/verify`)
tidak pernah membuat akun: nomor yang belum punya akun dibalas 404 `belum_terdaftar` dengan `waNumber`, dan aplikasi
mengarahkan pengguna memulai lewat WhatsApp (bagian 2.1). Aturan "sekali seumur nomor" tetap di tabel percobaan yang
sama dan tidak tersentuh aplikasi.

## 5. WebSocket `GET /stream`

Alamat: `wss://<host>/app/v1/stream`. Satu JSON per pesan teks, bentuknya `StreamEvent`.

Jabat tangan:

- Header yang dikirim aplikasi: `Authorization: Bearer <token>`, `X-App-Version`, `X-Contract-Version`. Token TIDAK
  lewat query string (tercatat di log Nginx Proxy Manager).
- Token tidak sah: terima jabat tangan lalu langsung tutup dengan kode **4401**, atau tolak dengan 401. Aplikasi
  yang mendapat 4401 menghapus sesi dan tidak menyambung ulang. (Kalau soket dipakai sampai ditutup lebih dulu,
  4401 lebih jelas bagi klien.)
- Akun diblokir (403) dan versi terlalu lama (426) boleh ditolak pada jabat tangan HTTP. React Native
  melaporkan penolakan jabat tangan sebagai tutup biasa (1006), sama dengan jaringan putus. Karena itu, setelah 3
  kali gagal terbuka berturut-turut, aplikasi memanggil `GET /me` untuk tahu penyebabnya: 401 menghapus sesi, 403
  `diblokir` dan 426 menghentikan penyambungan ulang dengan status yang bisa ditampilkan, jawaban lain melanjutkan
  jeda bertingkat. Maka `GET /me` wajib membalas 401/403/426 yang benar.

Event dari server:

```json
{ "type": "message", "message": { "id": "813", "seq": 813, "rev": 1407, "...": "..." } }
{ "type": "draft", "draft": { "id": "d-17", "status": "sent", "...": "..." }, "rev": 1409 }
{ "type": "thinking", "runId": "r-91", "on": true }
{ "type": "ping" }
```

- `message`: pesan baru ATAU pembaruan pesan dengan `id` yang sudah dikenal (upsert, menggantikan versi
  sebelumnya, tempat di utas tetap). Membawa semua pesan baru di utas, termasuk pesan pengguna dari WhatsApp
  (`via: 'whatsapp'`) dan pesan pengguna dari aplikasi lain milik akun yang sama. Aplikasi menggabungkan berdasarkan
  `id`.
- `draft`: perubahan draf; menimpa kartu `draft` dengan `draft.id` yang sama, dengan `rev` baru pesan pembawa kartu
  (wajib; lihat bagian 2.7). Event `message` untuk pesan itu tidak wajib: `draft` saja sudah cukup bagi tampilan.
- `thinking`: `runId` unik per proses agen; `on: true` saat mulai, `on: false` saat selesai. Dua proses
  bersamaan (aplikasi dan WhatsApp) tidak saling menimpa; aplikasi menyimpan himpunan `runId` aktif.
- `ping`: setiap 25 detik (`STREAM_PING_SEC`). Aplikasi menganggap koneksi mati bila 60 detik tanpa pesan apa pun.

Urutan untuk satu `POST /messages`: event `message` pesan pengguna → `thinking on` → `message` asisten (satu atau
lebih) → `thinking off`.

Penyambungan ulang dan resync:

- Putus: aplikasi menyambung ulang dengan jeda 1, 2, 4, 8, ... detik, paling lama 30 (dengan goyangan acak).
- Setiap kali koneksi terbuka, juga yang pertama, aplikasi mengambil yang terlewat lewat
  `GET /messages?changedAfter=<rev terbesar yang dikenal>` berulang selama `more` (bagian 2.5). Server tidak perlu
  memutar ulang event yang terlewat atau menyimpan antrean per soket.
- Satu pengguna boleh punya beberapa soket sekaligus (beberapa HP, atau HP dan tablet); siarkan setiap event ke
  semuanya.
- Server menjalankan heartbeat sendiri (kirim `ping`, dan buang soket yang tidak merespons `pong` protokol) agar
  soket setengah mati tidak menumpuk.
- Nginx Proxy Manager: nyalakan "Websockets Support" pada proxy host, dan pasang `proxy_read_timeout` /
  `proxy_send_timeout` jauh di atas 25 detik (usul 3600 detik). Jangan menyaring header `Authorization`.

## 6. Aturan upsert

Event `message` dengan `id` yang sudah dikenal MENGGANTIKAN versi sebelumnya; `seq` tetap, `rev` baru. Dipakai untuk:

- QRIS menjadi `lunas` atau `kedaluwarsa`;
- keadaan perangkat berubah (kartu `device`);
- pilihan yang sudah diambil (`chosenId` terisi);
- (secara tidak langsung) draf pada kartu `draft` berubah.

Konsekuensinya bagi server: pesan dengan kartu harus disimpan sebagai satu baris yang bisa diperbarui, bukan
dilampirkan sebagai baris baru. Itu sebabnya resync memakai `rev`.

## 7. Idempotensi dan konsistensi ringkas

| Hal | Aturan |
|---|---|
| `POST /messages` | unik (pengguna, `clientId`); ulang = pesan asli |
| `POST /drafts/:id` | aksi dari status tidak sah = 409 `status_draf`; `held`→`sent` dan `cancel` update bersyarat |
| Pilihan | sekali; kedua = 409 `sudah_dipilih` |
| `seq` | naik, tetap seumur pesan |
| `rev` | naik setiap simpan/perbarui, per pengguna |
| Resync | `changedAfter`; ulangi selama `more` |

## 8. Cara aplikasi membaca (untuk tahu apa yang boleh ditambah)

`src/api/lenient.ts`: bagian pesan yang `type`-nya tidak dikenal, jenis kartu yang tidak dikenal, atau nilai enum
yang tidak dikenal (misalnya `from`, `status`) tidak menggagalkan halaman; ia menjadi bagian
`{ "type": "unknown", "note": "Pesan ini butuh aplikasi versi terbaru." }`. Event stream yang bentuknya tidak
dikenal dilewati. Ini berarti server boleh menambah jenis bagian/kartu baru tanpa menaikkan `CONTRACT_VERSION`,
selama aplikasi lama bisa hidup tanpa itu. Yang MENGUBAH arti kolom yang sudah ada atau menghapusnya butuh versi
kontrak baru dan `426` untuk aplikasi lama.

## 9. Pemetaan ke milo-ai

Ini usul susunan; milo-ai tetap yang memutuskan. Bacaan acuan: `src/app.ts` (route Fastify, `new WebChatChannel`
di sekitar baris 160, `new Outbox(wa)`), `src/wa/client.ts` (interface `WhatsApp`), `src/wa/outbox.ts`,
`src/testchat/{channel,routes}.ts`, `src/actions/pending.ts`, `src/db/schema.ts`.

### 9.1 Modul baru `src/appapi/`

- `contract.ts`: berkas `src/api/contract.ts` dari repo ini dipindah APA ADANYA (hanya bergantung pada zod; tidak
  boleh mengimpor apa pun dari aplikasi). Mulai saat itu milo-ai sumber kebenaran; aplikasi menyalinnya balik lewat
  `npm run sync:contract`. Ubah kontrak hanya di sana, bersama tesnya.
- `routes.ts` (plugin Fastify `appApiRoutes`, prefix `/app/v1`): semua jalur bagian 2. Daftarkan di `src/app.ts`
  seperti `adminRoutes`. Pasang `setErrorHandler`/`setNotFoundHandler` di dalam plugin (terenkapsulasi) yang
  mengeluarkan `ApiError`. Validasi memakai skema zod dari `contract.ts` (`safeParse`), jangan menulis ulang.
- `auth.ts`: `auth/start`, `auth/verify`, `auth/logout`, pembuatan/pencabutan token, batas laju.
- `stream.ts`: WebSocket (`@fastify/websocket`), daftar soket per pengguna, `ping`, siaran.
- `channel.ts`: `AppChannel`.
- `store.ts`: baca/tulis pesan app (bagian 9.4), `seq`/`rev`, upsert.
- `drafts.ts`: mesin status draf, job masa tahan.
- `push.ts`: pengiriman push (FCM HTTP v1) dan aturan "push dulu, WhatsApp cadangan".

### 9.2 Masuk (inbound): lewat `ingest()` yang sama

`POST /messages` bekerja seperti `POST /api/rooms/:room/messages` di test chat (`src/testchat/routes.ts`, sekitar
baris 175): simpan, lalu panggil `ingest([{ wamid, from, profileName?, timestamp, inbound }])` dengan
`inbound` `{ kind: 'text', text }` atau `{ kind: 'button', id, title }`. Penanda `wamid` diawali `app.` (misalnya
`app.<uuid>`) seperti `web.` pada test chat. Agen, memori, tool, dan riwayat tidak perlu diubah. `from` memakai
`waId` pengguna yang sebenarnya (bukan `web-...`), jadi satu pengguna = satu utas lintas WhatsApp dan aplikasi.
`ingest` yang menjalankan agen harus mengeluarkan `thinking on/off` di sekitarnya (pasang di sekitar pemanggilan,
bukan di dalam agen).

### 9.3 Keluar (outbound): `AppChannel` membungkus kanal yang ada

`AppChannel implements WhatsApp` dan membungkus kanal yang ada, persis cara `WebChatChannel` di `src/app.ts`
(`const wa = new WebChatChannel(deps.wa); const outbox = new Outbox(wa);`). Tambahkan lapisan baru di antaranya
(`new Outbox(new AppChannel(new WebChatChannel(deps.wa), ...))`). Alasannya: seluruh kode yang ada mengirim lewat
`Outbox`, yang mencatat ke `messages` dan memanggil `wa.sendText/sendButtons/sendList/sendImage/sendDocument/sendAudio`,
jadi pesan-pesan itu otomatis sampai ke aplikasi tanpa mengubah pemanggil.

Pemetaan:

| Panggilan `WhatsApp` | Bagian kontrak |
|---|---|
| `sendText` | `text` |
| `sendButtons(body, buttons)` | `text`(body) + `choices` (id/title tombol). `supportsButtons` untuk penerima aplikasi `true` |
| `sendList(body, label, rows)` | `choices` dengan `prompt`=body dan `description` dari baris |
| `sendImage(png, caption, ..., mime)` | `image` (`mediaId` dari media yang disimpan, `mime`, `caption`) |
| `sendDocument(data, filename, mime, caption)` | `document` (`name`, `mime`, `sizeBytes`) |
| `sendAudio(audio, mime, fallbackText)` | `audio` (`mediaId`, `mime`, `transcript`=fallbackText) |
| `sendTemplate` | tidak dipakai untuk aplikasi (jendela 24 jam tidak berlaku) |

Catatan:

- `supportsButtons` dan `serviceWindow` sekarang milik satu kanal penuh; untuk pengguna aplikasi, pipeline perlu
  membaca kemampuan per pengguna (sudah tercatat sebagai risiko di ROADMAP Fase 1).
- Penerima ditentukan dari `to` (`waId`). `AppChannel` memutuskan apakah pesan ke pengguna ini ke aplikasi, ke
  WhatsApp, atau keduanya (aturan 9.6). Pesan yang dikirim ke aplikasi disimpan di `messages` seperti biasa oleh
  `Outbox`; `AppChannel` menambahkan pemetaan ke bagian kontrak, media, dan menyiarkan event.
- Media WhatsApp masuk (`downloadMedia`) harus disalin ke penyimpanan server (bagian 2.10).
- Pesan keluar yang berasal dari `pending_actions`/relay berbentuk kartu (9.5), bukan teks.

### 9.4 Tabel dan strategi `seq`/`rev`

Tabel `messages` sekarang: `id bigserial`, `user_id`, `wamid unique`, `direction`, `kind`, `body`, `payload jsonb`,
`processed`, `created_at`. Itu cukup untuk WhatsApp; aplikasi butuh bagian terstruktur, `rev`, dan `clientId`.
Dua pilihan, putuskan di awal Fase 1b:

1. **Tabel baru `app_messages`** (disarankan): `id bigserial`, `user_id`, `seq` (bigserial, global tetapi hanya
   naik; atau `seq` per pengguna), `rev bigint` (dari sequence global `app_rev_seq`, `nextval` pada INSERT dan UPDATE;
   global memenuhi syarat "hanya naik per pengguna"), `client_id text` (unik dengan `user_id` bila tidak null),
   `from`, `via`, `parts jsonb`, `source_message_id bigint null references messages(id)`, `created_at`. Setiap
   baris `messages` (masuk dan keluar) disalin/dipetakan ke `app_messages` oleh `AppChannel` dan oleh hook pasca-`ingest`
   untuk pesan WhatsApp pengguna (`via: 'whatsapp'`). Kelebihan: `messages` tidak diubah, penghapusan lewat
   `memory_forget` tinggal menghapus baris di dua tempat.
2. **Kolom baru di `messages`**: `parts jsonb`, `rev bigint`, `client_id text`, `via text`. Satu sumber, tapi
   menyentuh tabel yang dipakai seluruh sistem.

Apa pun pilihannya: indeks `(user_id, seq desc)` untuk riwayat dan `(user_id, rev)` untuk resync, serta unik
`(user_id, client_id)`. Kolom `rev` diberi nilai baru dengan `nextval` pada INSERT dan pada setiap UPDATE yang
mengubah tampilan (QRIS, draf, `chosenId`); jangan menaikkan `rev` untuk pembaruan yang tidak terlihat.

Tabel lain:

- `app_sessions`: `id`, `user_id`, `token_hash unique`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at`,
  `app_version`, `platform`.
- `app_push_tokens`: `id`, `session_id`, `user_id`, `push_token unique`, `platform`, `updated_at`.
- `app_login_codes`: `phone`, `code_hash`, `expires_at`, `attempts`, `created_at`, `ip` (atau pakai Redis/memori
  untuk batas laju bila tidak ingin tabel).
- `app_media`: `id`, `user_id`, `mime`, `name`, `size_bytes`, `path`, `created_at` (atau pakai direktori media
  yang ada di `testchat/channel.ts` dengan pemetaan kepemilikan).
- `app_jobs` atau tabel `draft_release` untuk penjadwal masa tahan (jam `held_until`, status).

Catatan: `ROADMAP` lama menyebut `app_devices`; gunakan `app_push_tokens` (dipisah dari perangkat rumah).

### 9.5 `pending_actions`/relay → kartu `draft`; pembayaran → kartu `qris`

`pending_actions` (id bigserial, `kind`, `payload`, `status`, `expires_at` 15 menit) adalah persetujuan yang
sekarang dijawab pengguna dengan tombol/kata di WhatsApp. `ActionKind` di `src/actions/pending.ts` yang berupa
kiriman ke orang lain: `gmail_send`, `outlook_send`, `calendar_invite`, `outlook_invite`, `github_comment`,
`github_issue`; di relay juga draf pesan WhatsApp ke orang lain (`relay_messages`). Untuk pengguna aplikasi, tiap
persetujuan semacam itu muncul sebagai pesan asisten dengan satu bagian `card` jenis `draft`:

| Contoh sumber | `draft.channel` | `draft.what` |
|---|---|---|
| balasan relay ke seseorang di WhatsApp | `whatsapp` | `balasan` |
| `order_place` ke penjual | `whatsapp` | `pesanan` |
| `gmail_send`, `outlook_send` | `email` | `email` |
| `calendar_invite`, `outlook_invite` | `email` | `undangan` |

`draft.id` memetakan ke id `pending_actions`/relay; `to` nama penerima; `text` isi. `POST /drafts/:id` `send` =
persetujuan (memanggil `claimAction` lalu menahan 5 menit sebelum eksekusi yang sebenarnya). Perhatikan: aturan tahan
5 menit di kontrak adalah keputusan #5 ROADMAP (aslinya dijadwalkan di Fase 5 untuk relay); untuk draf aplikasi ia
berlaku sejak Fase 1b. Tindakan yang BUKAN kiriman ke orang lain (`bill_pay`, `ticket_buy`, `home_control`,
`memory_forget`, `server_run`, `mcp_call`) tidak memakai kartu `draft`: sampaikan sebagai `choices` (Ya/Tidak) atau
kartu `payment`, sama dengan tombol WhatsApp hari ini.

Pembayaran:

- kartu `payment` untuk rincian sebelum bayar ("Sudah benar?"), dengan pilihan Ya/Tidak lewat `choices` di pesan
  yang sama atau berikutnya;
- QRIS dari modul pembayaran (`sendImage` QRIS di WhatsApp) menjadi pesan dengan kartu `qris` (`mediaId` gambar
  QRIS, `until`, `status: 'menunggu'`). Saat webhook pembayaran (`/pay/webhook`, `/bills/webhook`, dan sejenisnya)
  menandai lunas atau kedaluwarsa, perbarui baris pesan itu (`status`, `rev` baru) dan siarkan event `message`.

### 9.6 Aturan kanal

- **Balasan** dikirim ke kanal tempat pengguna terakhir menulis (aplikasi atau WhatsApp). Simpan `last_channel` per
  pengguna dan perbarui di `ingest()`/`POST /messages`.
- **Proaktif** (sapaan pagi, pengingat, kabar rumah, notifikasi pembayaran): coba aplikasi dulu. Jika ada soket
  terbuka, siarkan event `message`; jika tidak, kirim push (FCM) dengan teks ringkas. Jika pengguna tidak punya
  token push, atau aplikasinya tidak dibuka 3 hari (keputusan bawaan #4), kirim lewat WhatsApp seperti sekarang.
- Pesan yang sudah tampil di aplikasi tidak dikirim ganda ke WhatsApp, kecuali fallback di atas.
- Semua tetap tercatat di `messages`/`app_messages` supaya utas lengkap.
- Push: judul dari nama asisten, isi ringkas teks; data berisi hanya `messageId` (tanpa isi sensitif). Mengetuk
  notifikasi membuka `/chat`.

### 9.7 Hal lain

- Catat satu sumber untuk `via`: pesan masuk dari webhook WhatsApp = `whatsapp`; dari `POST /messages` = `app`.
- Cabut/ubah status akun (admin) harus berlaku langsung ke token (403) dan menutup soket.
- Waktu `held` dihitung di server; aplikasi tidak menghitung batas waktu.
- Jangan lupa `memory_forget` dan HAPUS akun: hapus baris aplikasi (pesan, sesi, token push, media).

## 10. Pertanyaan terbuka untuk founder

1. ~~Akun baru dari aplikasi~~ **Diputuskan:** aplikasi add-on; akun dan trial hanya lewat WhatsApp. `auth/start`
   membalas 404 `belum_terdaftar` dengan `waNumber` (bagian 2.1 dan 4).
2. ~~URL dokumen~~ **Diputuskan:** dokumen dibuka lewat unduhan biasa dengan header token ke cache HP, lalu penampil
   bawaan atau lembar bagikan (bagian 2.10). Tidak ada URL bertanda tangan.
3. Jenis token push: token Expo atau token FCM native? Mempengaruhi `push.ts` dan apakah proyek Firebase wajib sejak
   awal. (Aplikasi sekarang memakai `expo-notifications`; `google-services.json` dari Firebase masih persiapan
   founder.)
4. Kebijakan keluar: `auth/logout` hanya mencabut sesi ini atau semua sesi? Bawaan usulan: sesi ini saja.
5. Masa berlaku sesi (usulan 90 hari geser) dan batas laju kode (usulan di bagian 4): setuju?
6. Pilihan penyimpanan pesan aplikasi (9.4): tabel baru `app_messages` atau kolom di `messages`?
7. Template WABA autentikasi untuk kode masuk: perlu diajukan di Meta sebelum nomor resmi dipakai (pengguna Fonnte
   tidak butuh).

## 11. Daftar tes server yang perlu ditulis

Gunakan `node --test` dengan Postgres lokal seperti tes milo-ai lainnya. Bentuk respons divalidasi dengan skema zod
dari `contract.ts` (tes kontrak: setiap response lolos `safeParse`).

Header dan error:
- tanpa/ salah `Authorization` → 401 `tidak_masuk` di semua jalur terlindungi; `auth/*` tanpa token berhasil;
- `X-Contract-Version`/`X-App-Version` terlalu lama → 426 `perlu_pembaruan`; versi benar lolos;
- akun diblokir → 403 `diblokir` di `GET /me`, `POST /messages`, `auth/verify`, dan jabat tangan WebSocket;
- error handler: JSON tak valid, jalur tak dikenal, dan galat tak terduga semua mengeluarkan `ApiError`;
- body `{}` untuk POST tanpa isi diterima.

Masuk:
- kode: masa berlaku, sekali pakai, batas percobaan, kode lama batal saat kode baru diminta;
- `auth/start` dua kali sebelum `resendInSec` → 429 dengan `retryInSec`; batas per IP;
- respons nomor terdaftar dan tidak terdaftar sama;
- `auth/verify` salah → 400 `kode_salah`; benar → token yang valid untuk `GET /me`;
- hash token tersimpan (bukan token); token kedaluwarsa dan token dicabut → 401;
- logout mencabut token dan token push sesi itu;
- akun baru + percobaan 7 hari sesuai keputusan founder, dan hanya sekali.

Pesan:
- `POST /messages` text menyimpan dan mengembalikan pesan dengan `clientId`; `ingest` terpanggil sekali;
- `clientId` diulang (juga bersamaan) → pesan yang sama, satu baris;
- `clientId` sama dengan isi berbeda → pesan asli;
- `choice`: judul dari pilihan tersimpan (bukan dari klien), `choiceId` salah → 400, `messageId` orang lain →
  404, pilihan kedua → 409 `sudah_dipilih`, `chosenId` terisi dan `rev` naik;
- bentuk campuran/kunci tambahan → 400;
- `GET /messages`: urutan terbaru dulu, `before` halaman berikutnya dan `null` di ujung, `before` tak dikenal →
  halaman terbaru, `limit` di luar batas → 400, `before` + `changedAfter` bersamaan → 400;
- `changedAfter`: terlama dulu menurut `rev`, `more` benar, `changedAfter=0` dari awal, pesan lama yang diperbarui
  (QRIS lunas) ikut, tidak ada duplikat saat diulang sampai `more:false`;
- `seq` tetap dan `rev` naik setelah upsert; `rev` tidak naik pada pesan yang tidak berubah;
- pesan pengguna dari WhatsApp muncul di utas dengan `via: 'whatsapp'`.

Draf:
- tabel transisi lengkap: tiap aksi dari tiap status (sah dan 409 `status_draf`), termasuk `send` dari `failed`;
- `send` → `held` dengan `heldUntil` +5 menit; `cancel` sebelum 5 menit → `cancelled` dan tidak pernah terkirim;
- setelah 5 menit penjadwal → `sent`; gagal kirim → `failed`; penjadwal tahan restart (mulai ulang proses di
  tengah masa tahan, draf tetap terkirim sekali);
- lomba `cancel` vs pengiriman di menit kelima: tepat satu yang menang, tidak ada kirim ganda;
- `edit` hanya dari `draft`; `discard` hanya dari `draft`;
- draf milik pengguna lain → 404; event `draft` disiarkan ke semua soket dan kartu di riwayat membawa keadaan
  terbaru.

WebSocket:
- header `Authorization` diterima; token buruk → ditutup 4401; tanpa token ditolak;
- urutan event: pesan pengguna → `thinking on` → pesan asisten → `thinking off` dengan `runId` yang sama, juga
  ketika agen melempar error (`thinking off` tetap terkirim);
- dua `runId` bersamaan (aplikasi dan WhatsApp);
- `ping` tiap 25 detik (pakai jam palsu); banyak soket per pengguna menerima semua event; soket pengguna lain tidak
  menerima; akun yang diblokir/dicabut menutup soket;
- `GET /me` membalas 403/426/401 untuk jabat tangan yang ditolak.

Media dan push:
- `GET /media/:id`: `Content-Type`, `Content-Disposition`, `Range` (206), cache privat, milik orang lain → 404;
- (bila diputuskan) URL bertanda tangan: sah, kedaluwarsa, salah pengguna, tanda tangan diubah;
- `POST /push-tokens`: upsert, pemindahan kepemilikan token, dihapus saat logout, token ditolak FCM dihapus;
- `DELETE /push-tokens`: tanpa `Authorization` berhasil, token tidak dikenal tetap `ok`, `pushToken` kosong 400;
- `501 belum_tersedia` untuk `POST /home/devices/:id`.

Kanal:
- pemetaan Outbox: `text`, `buttons`, `list`, `image`, `document`, `audio` → bagian kontrak yang benar;
- balasan mengikuti kanal terakhir; proaktif: aplikasi terhubung → siaran, tidak terhubung dan punya token → push,
  tidak ada token atau 3 hari tidak dibuka → WhatsApp;
- pending action/relay → kartu `draft`; QRIS lunas/kedaluwarsa memperbarui pesan (upsert) dan menaikkan `rev`;
- kontrak: `src/appapi/contract.ts` identik dengan `src/api/contract.ts` setelah `npm run sync:contract`.
