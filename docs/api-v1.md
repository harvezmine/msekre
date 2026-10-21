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
| 400 | `nama_tidak_valid` | Dari `PUT /account/assistant`: nama asisten bukan 2 sampai 20 huruf |
| 400 | `kode_salah` | Kode masuk salah, kedaluwarsa, habis percobaan, atau belum diminta |
| 401 | `tidak_masuk` | Token tidak ada, salah, kedaluwarsa, atau sudah keluar. Aplikasi menghapus sesi |
| 403 | `diblokir` | Akun dinonaktifkan atau diblokir di admin. Sesi tidak dihapus |
| 403 | `pin_salah` | PIN (atau PIN lama, atau PIN untuk mematikan permintaan PIN) tidak cocok atau hilang. Bukan `diblokir`: sesi dan akun tidak terpengaruh |
| 404 | `tidak_ditemukan` | Draf, pesan, atau media tidak ada atau milik orang lain (jangan bedakan) |
| 404 | `belum_terdaftar` | Dari `auth/start` (dan `auth/verify`): nomor belum punya akun. Bawa `waNumber` |
| 422 | `tidak_paham` | Dari `POST /agenda/parse`: kalimatnya tidak berisi isi atau waktu yang bisa dibaca. Aplikasi menampilkan petunjuk ramah dengan contoh kalimat |
| 409 | `status_draf` | Aksi draf tidak boleh dari status sekarang |
| 409 | `sudah_dipilih` | Pilihan di pesan itu sudah diambil |
| 426 | `perlu_pembaruan` | Versi aplikasi atau kontrak terlalu lama |
| 429 | `terlalu_sering` | Terlalu sering; bawa `retryInSec` |
| 500 | `server` | Kendala lain |
| 428 | `pin_diperlukan` | Aksi perangkat yang dijaga butuh `pin` (PIN dihidupkan pemilik) |
| 501 | `belum_tersedia` | Jalur ada di kontrak tapi belum diisi server |

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
- Mencabut token juga **menggugurkan semua tanda terima alarm** (`alarm-ack`, bagian 2.13) milik sesi/HP pemilik token itu,
  sama seperti `auth/logout`. Itulah cara tanda terima tidak tertinggal saat HP keluar tanpa sempat memberi tahu.

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

### 2.9 `POST /home/devices/:id` (sudah dipakai aplikasi; lihat juga bagian "Perangkat" di 2.14)

Request (objek ketat, minimal satu dari `on`, `temp`, `mode`, `fan`, `level`; `pin` saja tidak cukup):

```json
{ "on": false, "pin": "123456" }
{ "temp": 24, "mode": "Dingin", "fan": "Pelan" }
{ "on": true, "level": 40 }
```

Response 200: `{ "device": Device, "card": DeviceCard, "rev": 12 }`, contoh `card`:
`{ "kind": "device", "deviceId": "ac-1", "name": "AC kamar", "on": true, "deviceKind": "ac", "switchable": true, "temp": 24 }`.
`device` adalah keadaan sesudah perintah (layar Perangkat memakainya), `card` untuk kartu di chat, `rev` = nomor
perubahan perangkat sesudah perintah ini (sama dengan `rev` event `device` yang menyusul; hilang atau rusak dibaca 0).
Aplikasi membuang event `device` yang `rev`-nya lebih lama dari `rev` jawaban untuk perangkat yang sama, dan hanya
jawaban perintah terakhir per perangkat yang menimpa layar. Jawaban perintah (`POST /home/devices/:id`,
`POST /routines/:id/run`, `PUT /box`) dibaca longgar: kartu atau kalimat yang rusak diganti bawaan, bukan menggagalkan
perintah yang sudah berhasil. Perangkat tidak
terjangkau tidak berubah; jawabannya keadaan sebenarnya. `temp`/`mode`/`fan` hanya untuk AC dan `level` hanya untuk
lampu; selain itu 400 `tidak_valid`.

PIN (bawaan mati): bila pemilik menghidupkannya dan perangkat `sensitive`, aksi **mematikan** (kamera, alarm rumah)
atau **membuka** (kunci pintu), yaitu `on: false`, butuh `pin`:

- tanpa `pin`: **428 `pin_diperlukan`**; aplikasi meminta PIN lalu mengulang dengan `pin`;
- `pin` salah: **403 `pin_salah`**;
- PIN mati, atau aksinya menyalakan/mengunci: langsung jalan.

Pembayaran tidak pernah memakai PIN. Server tidak pernah membuka kunci lewat chat; kendali langsung dari aplikasi
boleh.

**Alur mematikan kamera / membuka kunci (PIN diperiksa server, tanpa `verify` dari aplikasi).** Aplikasi bertanya
`GET /account/security` (gagal bertanya dianggap PIN hidup). PIN hidup: lembar PIN meminta 6 angka, lalu perintahnya
dikirim **bersama `pin`** dan **server** yang memeriksa (salah: 403 `pin_salah`, titik dikosongkan; benar: jalan).
Aplikasi tidak memanggil `POST /account/pin/verify` untuk ini. Kalau server membalas 428 `pin_diperlukan` untuk
perintah dari jalur mana pun (layar Perangkat, Beranda, kartu di chat), aplikasi membuka lembar PIN (`/pin?id=`),
bukan toast. PIN mati: mematikan kamera langsung jalan; **membuka kunci** lebih dulu bertanya "Buka kunci {nama}?" di
aplikasi (Buka / Batal, bukan PIN), lalu mengirim `{ "on": false }` tanpa `pin`.

**Kartu perangkat di chat.** Kartu membawa `deviceKind` (jenis perangkat; `kind` sudah dipakai pembeda kartu),
`sensitive`, dan `switchable` (semuanya opsional). Aturan: **server tidak pernah mengirim kartu yang bisa
dikendalikan untuk perangkat `sensitive`** (kunci, kamera, alarm). Kalau terkirim, aplikasi hanya menampilkan keadaannya
dengan "Buka di Perangkat" (membuka layar Perangkat), tanpa sakelar atau pengatur suhu. Jenis yang belum dikenal
dibaca `other`: tanpa ikon salju dan pengatur suhu, dan sakelar nyala-mati hanya bila `switchable: true` (bila
`switchable` tidak ada: boleh untuk `lamp`, `ac`, `plug`, `tv`). Pengatur suhu hanya untuk `deviceKind: "ac"` yang
tidak `sensitive`. Server lama tanpa `deviceKind`: kartu dengan `temp` dibaca AC.

### 2.14 Perangkat: `GET /devices`, `POST /routines/:id/run`, `PUT /box`, dan event `device`

`Device`:

```json
{ "id": "ac-kamar", "place": "Rumah", "room": "Kamar", "name": "AC kamar", "icon": "snow", "kind": "ac",
  "on": true, "reachable": true, "ac": { "temp": 24, "mode": "Dingin", "fan": "Otomatis" }, "roomTemp": 27,
  "brand": "LG", "via": "ir", "status": "Nyala · 24°" }
```

- `kind`: `lamp`, `ac`, `camera`, `lock`, `plug`, `tv`, `sensor`, `box`, `other` (yang belum dikenal dibaca `other`).
- `on`: lampu/AC/colokan nyala, kunci terkunci, kamera merekam. `level` (lampu, persen), `ac` (AC), `roomTemp`, `brand`.
- `via`: `ir` (lewat inframerah dari Kotak, hanya perintah terakhir yang diketahui) atau `cloud`.
- `sensitive`: butuh PIN saat dimatikan/dibuka kalau PIN dihidupkan. Beranda tidak menampilkan sakelar untuk baris
  rumah yang `sensitive`, walau `switchable` (lihat `house.lines[].sensitive`).
- `reachable: false` + `unreachableSince` ("10.12"). `status` dibuat server, ditampilkan apa adanya.

`GET /devices?place=` → `{ place, places, rooms, devices, box, routines, rev }`. `place` kosong = tempat terpilih;
`Semua` atau satu tempat; tempat tak dikenal 400. `rooms`: `{ place, name }` (Rumah punya ruangan tetap walau
kosong). `box`: `{ deviceId, online, micOn, speaker, roomTemp, humidity }` atau `null` (hanya Rumah/Semua).
**`box.deviceId` = `id` sebuah perangkat berjenis `box` di `devices`**; kartu Kotak digambar di ruangan (dan tempat)
perangkat itu, dan perangkat `box` tidak digambar sebagai ubin. Tanpa perangkat itu di daftar, kartu ditaruh di
ruangan pertama. Di "Semua", kartu ada di bagian tempat perangkatnya.
`routines`: `{ id, name, icon, summary, places }`. `rev` naik setiap perangkat/kotak pengguna berubah.

`POST /routines/:id/run` dengan `{ "place"?: string }` → `{ devices, summary, rev }` (perangkat yang berubah, kalimat
hasil, dan `rev` seperti di 2.9). "Tutup kedai": kedai terpilih saja; di Semua atau Rumah, semua kedai. Rutinitas tak ada: 404.

**Aturan rutinitas:** rutinitas tidak pernah berisi membuka kunci, mematikan kamera, atau mematikan alarm (aksi yang
dijaga). Server memeriksanya saat rutinitas dibuat atau diubah dan menolaknya; menjalankan rutinitas dari WhatsApp
atau chat juga tidak pernah mengubah perangkat yang dijaga. Mengunci dan menghidupkan kamera tidak dijaga dan boleh.
Bila rutinitas tersimpan ternyata memuat aksi yang dijaga, aksi itu dilewati saat dijalankan dan `summary` menyebut
perangkat yang tidak disentuh ("Pintu depan tidak disentuh karena dijaga PIN."). Server tiruan berlaku sama.

`PUT /box` dengan `{ "micOn": boolean }` → `{ "box": Box, "rev": number }`.

Stream: `{ "type": "device", "devices": [Device], "box": Box, "rev": 12 }` (`devices`, `box` opsional). Upsert menurut
`id`; event dengan `rev` lebih kecil dari data di layar dibuang. Setelah koneksi terbuka, aplikasi memuat ulang
`GET /devices` untuk tempat yang ia pegang.

### 2.15 Usaha: `GET /business`, `POST /business/reorder`, dan event `business`

`GET /business?place=&period=` → `Business`:

```json
{ "place": "Semua", "period": "hari",
  "sales": { "total": 4250000, "change": 12, "down": false, "compareLabel": "Senin lalu" },
  "series": [{ "label": "Sel", "value": 3100000 }, "...", { "label": "Sen", "value": 4250000 }],
  "branches": [{ "place": "Kedai Dago", "name": "Kedai Dago", "total": 2610000, "change": 9, "down": false }],
  "moneyIn": [{ "id": "mi-1", "source": "Transfer dari PT Sumber Susu", "amount": 2400000,
                "at": "2026-10-21T03:12:00Z", "note": "BCA" }],
  "lowStock": [{ "id": "stok-susu-uht", "name": "Susu UHT", "left": 6, "unit": "karton",
                 "supplier": { "name": "PT Sumber Susu", "phone": "6281234500011" }, "reorderDraftId": "d-31" }],
  "orders": [{ "id": "tt-101", "channel": "tiktok_shop", "summary": "Biji kopi Gayo 250 g x 2", "amount": 178000,
              "status": "perlu_dikirim", "at": "2026-10-21T02:12:00Z" }],
  "report": { "mediaId": "rep-77", "name": "Laporan penjualan 14-20 Okt.xlsx", "size": 36864, "period": "14-20 Okt" },
  "sources": [{ "key": "moka", "label": "Moka", "connected": true, "service": "moka", "provides": ["sales", "stock"] },
              { "key": "shopee", "label": "Shopee", "connected": false, "service": "shopee", "provides": ["orders"] }],
  "tzOffsetMinutes": 420,
  "rev": 8 }
```

- `place` kosong = tempat terpilih; `Semua` atau satu tempat; tempat tak dikenal 400 `tidak_valid`. `period` kosong =
  `hari`.
- **Rentang (`period`)** menentukan `sales`, `series`, dan `branches`; `moneyIn`, `lowStock`, `orders`, dan `report`
  selalu keadaan sekarang:
  - `hari`: penjualan hari ini; `change` dibanding hari yang sama pekan lalu (`compareLabel` "Senin lalu"); `series`
    tujuh hari terakhir per hari, titik terakhir = hari ini.
  - `minggu`: penjualan pekan ini sampai sekarang; dibanding pekan lalu ("pekan lalu"); `series` empat pekan, titik
    terakhir = pekan ini.
  - `bulan`: penjualan bulan ini sampai sekarang; dibanding bulan lalu ("bulan lalu"); `series` enam bulan, titik
    terakhir = bulan ini.
  - `label` titik grafik dipasang apa adanya di sumbu (singkat: "Sen", "Mgg 2", "Okt"). Jumlah titik boleh berbeda.
- Uang dalam Rupiah utuh (`total`, `value`, `amount`). `change` persen tanpa tanda (`12` = 12%, boleh pecahan), arahnya
  di `down`. Aplikasi menulis "naik 12% dari Senin lalu".
- `branches`: hanya pada `Semua` kalau pengguna punya beberapa kedai (sama `period`); selain itu `[]`. `status`
  keterangan bebas per kedai (opsional).
- `moneyIn`: uang masuk terbaru (rekening lewat Moota, QRIS kasir), yang terbaru dulu. `source` siap tampil.
- `lowStock`: barang di bawah batas minimum. `supplier` ada kalau pemasoknya dikenal; tanpa itu aplikasi tidak
  menawarkan "Pesan lagi". `reorderDraftId` terisi selama ada draf pesanan ke pemasok untuk barang itu yang masih
  menunggu persetujuan (status `draft`), supaya tombol berubah menjadi "Lihat draf".
- `orders`: pesanan marketplace yang masih berjalan, yang terbaru dulu. `channel` dan `status` bebas (`tiktok_shop`,
  `shopee`; `perlu_dikirim`, `dikirim`, `selesai`, `dibatalkan`). Yang belum dikenal aplikasi ditampilkan sebagai kata
  biasa ("toko_baru" menjadi "Toko baru"), jadi saluran baru tidak perlu rilis aplikasi.
- `report`: laporan terakhir yang dibuat asisten, atau `null`. Berkasnya diunduh lewat `GET /media/:id` dan dibuka/
  dibagikan dengan alur dokumen (bagian 2.10). Jenis berkas dibaca dari ekstensi `name`.
- `sources`: dari mana data usaha berasal dan apakah sudah tersambung. `key` bebas (`moka`, `moota`, `tiktok_shop`,
  `shopee`, ...). Aplikasi menulis "Data dari Moka, rekening BCA dan TikTok Shop." untuk yang `connected`, dan menawarkan
  "Sambungkan <label>" untuk yang belum: membuka layar masuk layanan `service` di Terhubung (bagian 2.16), atau daftar
  Terhubung bila `service` kosong. `provides` (opsional): bagian Usaha yang bersumber dari sini (`sales`, `stock`,
  `moneyIn`, `orders`); keterangan "dari {label}" di kartu Penjualan, Stok, dan Uang masuk memakai sumber **tersambung**
  pertama yang menyebut bagiannya. Aplikasi tidak menulis nama sumber (Moka, Moota) di kodenya: tanpa `provides`, tidak
  ada keterangan.
- `tzOffsetMinutes`: zona waktu pengguna dalam menit dari UTC (WIB 420), seperti di `GET /agenda`. Jam uang masuk dan
  pesanan (`at`, ISO 8601) ditulis menurut zona ini, bukan zona HP. Hilang atau rusak dibaca WIB.
- **Pengguna tanpa data usaha** (tempat tanpa usaha, atau belum ada kasir/rekening tersambung) mendapat jawaban kosong,
  bukan 404: `sales.total` 0, semua daftar `[]`, `report` `null`. Aplikasi lalu menampilkan "Belum ada data usaha.
  Sambungkan kasir atau rekening di Terhubung." dengan tombol ke Terhubung.
- `rev`: nomor perubahan Usaha per pengguna (satu penghitung untuk semua tempat dan rentang). Naik setiap ada yang
  berubah.

`POST /business/reorder` dengan `{ "stockId": string }` → `{ "draftId": string, "messageId": string }`.

- Membuat **draf pesanan ke pemasok** barang itu (`what: "pesanan"`, kanal WhatsApp) dan menaruhnya di chat sebagai pesan
  asisten berisi kartu `draft` (aturan draf bagian 2.7). `draftId` = id draf di kartu, `messageId` = pesan yang
  memuatnya. Aplikasi membuka chat di draf itu (`/chat?draf=<draftId>&pesan=<messageId>`). Kalau pesan itu tidak
  ada di utas yang dimuat (sudah lama, atau terlewat), aplikasi mengambil pesan yang berubah (resync), lalu memuat
  halaman lama paling banyak 5 kali; tidak ketemu: "Drafnya tidak ketemu, mungkin sudah dikirim atau dibuang." Menggulir
  otomatis ke kartu hanya dalam sekitar 3 detik sejak chat dibuka (atau drafnya ketemu). "Lihat draf" dari kartu Stok
  (tanpa `messageId`) memakai `?draf=` saja.
- **Tidak ada yang terkirim tanpa persetujuan.** Draf berstatus `draft`; pengiriman hanya lewat `POST /drafts/:id`
  `send` (tahan lima menit, bisa dibatalkan) atau persetujuan lewat WhatsApp. Tidak ada kirim otomatis, tidak ada
  tindak lanjut otomatis.
- **Idempoten per `stockId`** selama drafnya masih terbuka (`draft`): memanggil lagi mengembalikan `draftId` dan
  `messageId` yang sama dan tidak membuat pesan baru. Draf lain yang masih terbuka ke pemasok yang sama juga dipakai.
  Setelah drafnya dikirim atau dibuang, panggilan berikutnya membuat draf baru.
- Barang tidak ada: 404 `tidak_ditemukan`. Barang tanpa pemasok: 400 `tidak_valid`.
- Perubahan ini mengubah `reorderDraftId`, jadi server menyiarkan event `business` (di bawah).

Stream: `{ "type": "business", "business": Business }` memuat Usaha lengkap untuk satu `place` dan `period` (upsert
menurut keduanya; dibuang bila `business.rev` lebih lama dari yang dipegang aplikasi untuk pasangan itu). Cukup
siarkan pasangan yang berubah; boleh juga hanya yang sedang dibuka aplikasi. Setelah koneksi terbuka, aplikasi memuat
ulang `GET /business` untuk setiap pasangan yang ia pegang, dan juga saat aplikasi kembali ke depan.

### 2.16 Terhubung: `/connections`, halaman masuk resmi, dan event `connection`

`GET /connections` → `Connections`:

```json
{ "connected": [{ "id": "gmail", "name": "Gmail", "icon": "mail", "category": "kerja", "status": "connected",
                  "account": "rina@kopirindang.id", "since": "2026-09-11T03:00:00Z", "lastUsed": "2026-10-21T02:58:00Z",
                  "ring": true },
                { "id": "imou", "name": "Imou - CCTV", "icon": "camera", "category": "rumah", "status": "connected",
                  "ring": true, "attention": { "text": "Perlu disambungkan ulang", "action": "reconnect" } }],
  "catalog":   [{ "id": "notion", "name": "Notion", "icon": "note", "category": "catatan", "status": "available", "ring": false },
                { "id": "shopee", "name": "Shopee", "icon": "bag", "category": "usaha", "status": "soon", "ring": false }],
  "formerly":  [{ "id": "moka", "name": "Moka", "icon": "receipt", "category": "usaha", "status": "formerly", "ring": false }],
  "rev": 12 }
```

- `Service`: `id` (tetap, dipakai di jalur), `name` dan `account` siap tampil, `icon` (nama ikon; yang tak dikenal diganti
  ikon bawaan), `category` (`kerja`, `usaha`, `rumah`, `catatan`, `lainnya`; yang belum dikenal dibaca `lainnya`),
  `status` (`connected`, `available`, `formerly`, `soon`; yang belum dikenal dibaca `available`), `since` dan `lastUsed`
  (ISO 8601; aplikasi menulis "Terakhir dipakai 5 menit lalu"), `ring`, `attention`.
- **Tiga daftar:** `connected` = tersambung (urutan sambung, yang terbaru terakhir); `catalog` = `available` (bisa
  disambungkan) dan `soon` (tampil dengan lencana "Segera hadir", tanpa tombol sambung); `formerly` = pernah tersambung
  lalu diputus (yang terbaru dulu), bisa disambungkan lagi. Layanan hanya ada di satu daftar. Aplikasi menaruh layanan
  menurut daftar tempat ia datang dari server, bukan menurut `status`, kalau keduanya tak cocok.
- `ring: true` = layanan ini punya simpul di cincin Beranda (`home.ring.nodes`); **`ring.nodes[].key` sama dengan
  `service.id`** untuk simpul layanan (aplikasi tidak menebak "simpul terakhir": simpul yang kuncinya tidak ada belum
  dianimasikan, dan masuk dengan animasinya begitu event `home` membawanya). Cincin selalu datang dari `GET /home`
  dan event `home`, bukan dari sini: begitu sambungan selesai server menaikkan `home.rev` dan menyiarkan `home` dengan
  simpul baru di ujung cincin. Aplikasi menganimasikan simpul yang baru masuk di layar "Tersambung".
- `attention` (opsional, hanya untuk layanan `connected`): `{ "text", "action" }`. `text` = kalimat siap tampil ("Perlu
  disambungkan ulang", "Tidak terjangkau sejak 10.12"). `action`: `reconnect` = menyambungkan ulang lewat halaman masuk
  resmi menyelesaikannya (token kedaluwarsa atau dicabut); `none` = tidak ada yang bisa dilakukan pengguna dari sini
  (perangkat tidak terjangkau). Yang belum dikenal dibaca `none`. Aplikasi menampilkannya sebagai banner di atas daftar
  dan di detail; **"Sambungkan ulang" hanya muncul untuk `reconnect`** dan memakai alur menyambung di bawah. Pembacaan
  longgar: `attention` berupa kalimat saja (atau `needsAttention` lama) dibaca `{ text, action: "none" }`.

`GET /connections/:id` → `ConnectionDetail` (berlaku juga untuk layanan yang belum tersambung, dipakai layar "Masuk"):

```json
{ "service": { "...": "Service" },
  "capabilities": [{ "key": "baca_email", "label": "Membaca email masuk", "enabled": true }],
  "permission": "baca",
  "what": ["Membaca email masuk dan memberi tahu yang penting.", "Menyiapkan balasan untuk Anda setujui."],
  "memoryCount": 120 }
```

- `what`: kalimat biasa tentang yang bisa Nadia lakukan, tanpa istilah teknis. `permission`: `baca` (hanya membaca) atau
  `baca_tulis` (boleh bertindak; tindakan tetap selalu lewat persetujuan pengguna). `capabilities`: kemampuan yang
  dapat dimatikan satu per satu (aplikasi saat ini belum menampilkannya; kuncinya bebas).
- `memoryCount`: berapa hal yang Nadia ingat dari layanan ini (untuk "Hapus yang Nadia tahu"); hilang = tidak diketahui.
  Layanan tak dikenal: 404 `tidak_ditemukan`.

`PUT /connections/:id/permission` dengan `{ "permission": "baca" | "baca_tulis", "capabilities"?: [{ "key", "enabled" }] }`
(objek ketat; `capabilities` hanya yang diubah) → `ConnectionDetail` terbaru. Layanan yang tidak tersambung: 404.
Aplikasi menampilkan pilihan lebih dulu dan mengembalikannya (dengan kalimat ramah) kalau server menolak.

`POST /connections/:id/forget` → `{ "ok": true, "forgotten": 48 }`. **Lupakan, bukan putuskan:** menghapus yang Nadia
pelajari dari layanan itu (ingatan, catatan, ringkasan, dan pesan yang berasal darinya; di milo-ai `memory_forget` untuk
sumber yang sama), **sambungannya tetap ada** dan Nadia akan mempelajari yang baru dari sini. `forgotten` = jumlah hal yang
dihapus (0 bila tidak ada). Aman diulang. Layar konfirmasinya: "Hapus yang Nadia pelajari dari {layanan}? Sambungannya
tetap ada."

`DELETE /connections/:id` → `{ "ok": true }`. **Putuskan:** pencabutan akses (cabut dan hapus kredensial di sisi
layanan bila ada jalannya), Nadia berhenti membaca dan bertindak di sana, layanan pindah ke `formerly`, simpulnya hilang
dari cincin. **Tidak menghapus ingatan**: itu `forget` (pengguna bisa melakukan keduanya, urutan bebas). Layanan yang
tidak tersambung: 404.

**Menyambungkan lewat halaman masuk resmi.** Kata sandi tidak pernah lewat aplikasi ataupun Nadia.

1. Aplikasi memanggil `POST /connections/:id/start` → `{ "url": "https://..." }`. `url` = halaman masuk/izin resmi
   layanan (OAuth) yang server siapkan; **harus `https:`** (selain itu jawaban ditolak aplikasi). `callbackScheme` boleh
   ikut tetapi **diabaikan**: aplikasi memakai skemanya sendiri `sekretarisai`. `start` dibolehkan untuk layanan yang
   belum tersambung **dan untuk layanan `connected` yang `attention.action`-nya `reconnect`**; layanan `soon`, yang
   tersambung tanpa `reconnect`, atau Kotak (disambungkan lewat Tambah perangkat): 400 `tidak_valid`.
2. Aplikasi membuka `url` di dalam aplikasi dengan `WebBrowser.openAuthSessionAsync(url, "sekretarisai://terhubung/tersambung")`
   (Chrome Custom Tab di Android).
3. Layanan mengarahkan pengguna ke alamat callback **server** (`PUBLIC_BASE_URL/...`). Server menukar kode dengan token,
   menyimpannya, lalu mengarahkan peramban ke `sekretarisai://terhubung/tersambung?id=<id>&ok=1`, atau `ok=0&reason=<kode>`
   (`reason` bebas, `ditolak` dikenali: pengguna tidak memberi izin).
4. Aplikasi menangkap alamat itu (hasil `openAuthSessionAsync`, atau, bila aplikasi dibuka dingin oleh alamat itu karena prosesnya
   sempat dibunuh saat di Custom Tab, rute `app/terhubung/tersambung`). Di Android alamat yang sama bisa sampai dua kali
   ke aplikasi yang sudah berjalan (hasil sesi dan tautan masuk); `app/+native-intent.tsx` membuang tautannya selama sesi
   masuk dinanti, jadi hanya `connect()` yang menyelesaikan alur dan layar "Tersambung" terbuka sekali. `ok=1`: aplikasi
   memuat ulang `GET /connections`; begitu layanan ada di `connected` **dan** (bila tadinya `reconnect`) `attention`-nya
   hilang, atau event `connection` yang menyatakan itu datang, layar "Tersambung" tampil dengan simpul baru di cincin.
   Server **menyiarkan `connection` dengan `attention` dihapus** begitu sambungan ulang berhasil. `ok=0`: kalimat ramah dan
   "Coba lagi". Peramban ditutup tanpa alamat kembali: aplikasi memuat ulang sekali; bila ternyata sudah tersambung,
   dianggap berhasil, selain itu "Halaman masuk ditutup sebelum selesai, jadi belum ada yang tersambung."

Aturan server untuk langkah 1-3:

- **`state`**: acak, sekali pakai, kedaluwarsa pendek (sekitar 10 menit), terikat ke pengguna dan `id` layanan; callback
  tanpa `state` yang cocok ditolak (tanpa menyimpan apa pun) dan mengarah ke `ok=0&reason=kedaluwarsa`. Alamat `url`
  yang dikembalikan sudah memuat `state`.
- **PKCE** (S256) untuk layanan yang mendukungnya; `code_verifier` disimpan di sisi server bersama `state`, tidak pernah
  dikirim ke aplikasi.
- **Callback ke server, bukan ke aplikasi**: redirect URI terdaftar di layanan adalah alamat HTTPS server; aplikasi
  hanya menerima akhirnya lewat skema `sekretarisai://`. Skema itu tidak membawa rahasia (hanya `id`, `ok`, `reason`);
  kebenaran sambungan selalu dibaca dari `GET /connections`, jadi alamat kembali yang dipalsukan tidak menambah akses.
- Setelah tersimpan: naikkan `connections.rev`, siarkan `connection` untuk layanan itu, dan, bila layanan punya simpul,
  `home` (cincin).
- Aplikasi tidak menjalankan `start` dua kali bersamaan untuk satu layanan; server boleh membatalkan `state` lama saat
  `start` baru datang.

Stream: `{ "type": "connection", "service": Service, "removed"?: true, "rev": number }`. Menggantikan layanan dengan `id`
yang sama dan menaruhnya di daftar menurut `service.status` (`connected` di akhir, `formerly` di depan, selain itu
katalog); `removed` = hilang dari semua daftar. Dibuang bila `rev` lebih lama dari `rev` daftar yang dipegang aplikasi.
Siarkan saat layanan tersambung, diputus, atau `attention` berubah. Setelah koneksi terbuka dan saat aplikasi
kembali ke depan, aplikasi memuat ulang `GET /connections` (dan detail yang sedang dibuka).

Sumber data Usaha (bagian 2.15) membawa `sources[].service` = `id` layanannya di sini, supaya "Sambungkan Moka" di
Usaha membuka layar masuk layanan yang tepat.

### 2.17 Riwayat: `GET /history` dan event `history`

`GET /history?kind=&before=&limit=` → `HistoryPage`, dari yang terbaru:

```json
{ "items": [
    { "id": "h91", "at": "2026-10-21T03:05:00Z", "kind": "kirim", "icon": "chat",
      "title": "Mengirim balasan ke Pak Budi", "detail": "disetujui Anda", "channel": "whatsapp",
      "status": "menunggu", "undoable": { "draftId": "d-17", "until": "2026-10-21T03:10:00Z" },
      "link": { "route": "/chat" } },
    { "id": "h90", "at": "2026-10-21T02:40:00Z", "kind": "rumah", "icon": "snow",
      "title": "Mematikan AC kamar", "detail": "lewat suara", "channel": "chat",
      "link": { "route": "/perangkat/[id]", "params": { "id": "ac-kamar" } } } ],
  "before": "h90", "rev": 31, "now": "2026-10-21T03:06:12Z" }
```

- Query: `kind` (salah satu jenis di bawah; kosong = semua), `before` (penanda dari `before` jawaban sebelumnya, buram bagi
  aplikasi; penanda yang tidak dikenal = halaman pertama), `limit` (1 sampai 50, bawaan 20 = `HISTORY_LIMIT`). `before` di
  jawaban `null` = tidak ada halaman lebih lama. Penanda yang disarankan: `id` entri terakhir atau pasangan
  `(at, id)`; urutan tetap terbaru dulu dan stabil walau ada entri baru di depan.
- `HistoryEntry`: `id` (tetap), `at` (ISO), `kind` (`kirim`, `rumah`, `agenda`, `usaha`, `bayar`, `sambung`, `lainnya`; yang
  belum dikenal aplikasi dibaca `lainnya`), `icon` (nama ikon; yang tak dikenal diganti ikon bawaan), `title` dan `detail`
  siap tampil dan **tanpa jam** (aplikasi menulis jam dari `at`), `channel` (`app`, `whatsapp`, `chat`: dari mana tindakan
  diminta; yang tak dikenal dibuang), `status`, `undoable`, `link`.
- `status` (hanya untuk kiriman): `menunggu` (ditahan, masih bisa dibatalkan), `terkirim`, `dibatalkan`, `gagal`.
  `undoable { draftId, until }` hanya ada selama `status` `menunggu` dan `until` belum lewat; **Batalkan memakai
  `POST /drafts/:draftId` `{ "action": "cancel" }` yang sudah ada** (bagian 2.7), jadi 409 `status_draf` bila sudah
  terkirim. `until` sama dengan `heldUntil` drafnya. Aplikasi mengunci tombol selama permintaan berjalan dan menghitung mundur
  ke `until`; setelah lewat tombolnya hilang dan statusnya ditulis "Sedang dikirim" sampai event `history` datang.
- `link { route, params? }`: layar yang dibuka bila entri diketuk. Aplikasi hanya membuka jalur yang dikenalnya (`/chat`,
  `/agenda`, `/usaha`, `/perangkat`, `/perangkat/[id]`, `/terhubung`, `/terhubung/[id]`; `params` hanya huruf, angka, `-`,
  `_`, `.`). Selain itu entri tampil biasa dan tidak bisa diketuk.
- `rev`: nomor perubahan Riwayat per pengguna, naik setiap ada entri baru atau berubah. `now`: jam server (ISO); aplikasi
  menghitung selisihnya dengan jam HP supaya hitung mundur Batalkan tidak salah di HP yang jamnya meleset. Boleh tidak ada.
- Stream: `{ "type": "history", "entry": HistoryEntry, "rev": 32 }`. Upsert menurut `entry.id` di semua daftar yang
  cocok; entri baru disisipkan menurut `at`; `rev` lebih lama dari yang sudah dilihat aplikasi dibuang. Siarkan saat
  kiriman disetujui (`menunggu`), dibatalkan, terkirim, atau gagal, dan saat tindakan lain dicatat. Setelah koneksi
  terbuka dan saat aplikasi kembali ke depan, aplikasi memuat ulang halaman pertama tiap saringan yang pernah dibuka.
- Pembacaan longgar: entri yang rusak dibuang satu per satu; `channel`, `status`, `link`, `undoable` yang rusak dibuang
  dan entrinya tetap tampil.

### 2.18 Akun: `GET /account`, pengaturan, dan event `account`

`GET /account` → `Account`:

```json
{ "me": { "id": "u1", "name": "Budi Santoso", "assistantName": "Nadia", "plan": { "name": "Bisnis", "activeUntil": null },
          "phone": "6281220457781" },
  "plan": { "name": "Coba", "status": "trial", "until": "2026-10-26T03:00:00Z", "price": 99000 },
  "assistant": { "name": "Nadia", "style": "ramah" },
  "greeting": { "daily": true, "time": "07.00" },
  "notifications": { "pesan": true, "pengingat": true, "ringkasanHarian": true, "rumah": true, "usaha": true },
  "security": { "pinEnabled": false, "hasPin": false },
  "phones": [{ "id": "s-41", "name": "Pixel 8", "platform": "android", "lastSeen": "2026-10-21T03:00:00Z", "current": true },
             { "id": "s-17", "name": "Galaxy A54", "platform": "android", "lastSeen": "2026-10-18T09:00:00Z", "current": false }],
  "privacy": { "services": [{ "id": "gmail", "name": "Gmail", "memoryCount": 120 }] },
  "rev": 9 }
```

- `plan.status`: `trial` (masa coba 7 hari, sekali seumur akun; `until` = akhir masa coba), `aktif` (`until` = akhir
  langganan), `berakhir`. Status yang belum dikenal dibaca `aktif`. Aplikasi menulis "Coba gratis, tersisa 5 hari", "Aktif
  sampai 21 Nov 2026", "Sudah berakhir".
- **Pembayaran dan hapus akun hanya lewat WhatsApp.** Tombol "Perpanjang" dan "Buka WhatsApp" (hapus akun) membuka
  `https://wa.me/<waNumber>?text=...` memakai `EXPO_PUBLIC_WA_NUMBER`; QRIS dan penghapusan akun tetap alur WhatsApp yang sudah
  ada (tidak ada `POST /account/forget-all` dan tidak ada jalur bayar di API ini).
- `assistant.name` dan `me.assistantName` selalu sama. `PUT /account/assistant` mengubahnya, jadi `GET /me` ikut berubah, dan
  aplikasi memakai nama baru di mana-mana (header chat, tab bar, Inti, nama saluran notifikasi).
- `greeting`: sapaan harian. `daily` bawaan `true` (satu sapaan pagi sehari). `time` "HH.MM" WIB, bawaan "07.00".
  `daily: false` = sapaan mati untuk seterusnya; **pengingat yang pengguna minta tetap dikirim** (aturan yang sama dengan
  tingkat inisiatif di milo-ai).
- `notifications`: jenis kabar yang boleh dikirim sebagai push. Alarm yang sudah dijadwalkan di HP tidak terpengaruh.
- `phones`: satu baris per sesi aplikasi yang masih berlaku. `current: true` = sesi yang memanggil.
- `privacy.services`: layanan tersambung yang punya ingatan, dengan `memoryCount` (0 boleh tampil setelah dilupakan).
  "Hapus yang {nama} tahu" memakai `POST /connections/:id/forget` (bagian 2.16); server lalu menyiarkan `account` baru.

`PUT /account/assistant` `{ "name"?: string, "style"?: "singkat"|"ramah"|"formal" }` (objek ketat, minimal satu) → `Account`.
`name` dipotong spasinya lalu harus 2 sampai 20 huruf (`\p{L}`, tanpa angka, spasi, atau tanda); selain itu **400
`nama_tidak_valid`** (aplikasi memeriksa lebih dulu di HP, jadi ini jaring pengaman). Gaya mengubah nada jawaban di semua kanal.

`PUT /account/greeting` `{ "daily": boolean, "time"?: "HH.MM" }` → `Account`. `time` yang tak dikirim mempertahankan jam yang ada.

`PUT /account/notifications` dengan sebagian dari `{ pesan, pengingat, ringkasanHarian, rumah, usaha }` (ketat, minimal satu)
→ `Account`. Aplikasi menampilkan perubahan lebih dulu dan mengembalikannya (dengan kalimat ramah) kalau server menolak.

`DELETE /account/phones/:id` → `Account` tanpa HP itu. **Keluarkan:** cabut sesinya (token itu 401 di request berikutnya, dan
stream-nya ditutup 4401) dan hapus token notifikasinya. `current: true` (sesi yang memanggil): 400 `tidak_valid`, karena HP ini
keluar lewat `POST /auth/logout`. Sesi tidak ada atau milik orang lain: 404 `tidak_ditemukan`.

Stream: `{ "type": "account", "account": Account }`. Menggantikan Akun di layar, dibuang bila `account.rev` lebih lama dari yang
dipegang aplikasi (upsert). Siarkan saat paket berubah (masa coba habis, langganan dibayar lewat WhatsApp), nama atau gaya
diubah (juga lewat percakapan), sapaan atau notifikasi diubah, HP masuk atau keluar, PIN berubah, dan ingatan dilupakan. Bagian
yang sedang diubah di layar tidak ditimpa sampai permintaannya selesai.

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

### 2.11 `GET/PUT /account/security`, `POST /account/pin`, `POST /account/pin/verify`, lupa PIN

PIN opsional (keputusan founder): **bawaan mati**. Kalau pemilik menghidupkannya (Akun > PIN), aksi yang dijaga di
Perangkat (mematikan kamera, mematikan alarm rumah, membuka kunci pintu) meminta PIN 6 angka; kalau mati, aksi itu
langsung jalan. Pembayaran tidak pernah memakai PIN. Semua jalur ini memakai token.

`GET /account/security` dan `PUT /account/security` membalas keadaan:

```json
{ "pinEnabled": false, "hasPin": false }
```

- `PUT` mengirim `{ "pinEnabled": true }` atau `{ "pinEnabled": false, "pin": "123456" }` (objek ketat). `pinEnabled: true`
  tanpa PIN dibalas 400 `tidak_valid`: PIN dibuat dulu lewat `POST /account/pin` (atau sekaligus, lihat di bawah).
  **Mematikan WAJIB membawa `pin` (PIN yang sekarang)**: `pin` hilang atau salah dibalas 403 `pin_salah`, jadi permintaan
  PIN tidak bisa dimatikan hanya dengan token yang sah (sesi yang dicuri). Mematikan tidak menghapus PIN-nya (`hasPin`
  tetap `true`). Layar Keamanan memeriksa PIN yang sekarang lewat `verify` lebih dulu supaya salah PIN langsung
  terlihat di layar PIN.
- `POST /account/pin` membuat atau mengganti PIN, membalas keadaan yang sama:
  `{ "pin": "123456" }` (belum ada PIN) atau `{ "pin": "654321", "currentPin": "123456" }` (ganti). PIN harus 6 angka
  (`^\d{6}$`, kalau tidak 400 `tidak_valid`). Sudah ada PIN tapi `currentPin` hilang: 400 `tidak_valid`; `currentPin`
  salah: 403 `pin_salah`. Isi boleh membawa `"enable": true`: PIN tersimpan **dan** permintaan PIN hidup dalam satu
  langkah, atomik (gagal berarti tidak ada yang berubah). Aplikasi memakai ini saat pengguna membuat PIN pertama, supaya
  gagal menghidupkan (sinyal putus di tengah) tidak meninggalkan PIN yang sudah dibuat tapi belum dihidupkan. Tanpa
  `enable`, membuat PIN tidak menghidupkan permintaan PIN.
- `POST /account/pin/verify` dengan `{ "pin": "123456" }` membalas `{ "ok": true }`, atau 403 `pin_salah`. Aplikasi
  memanggilnya hanya di layar Keamanan (mengganti atau mematikan PIN). **Perangkat tidak memakainya**: PIN untuk
  mematikan kamera atau membuka kunci dikirim bersama perintahnya dan diperiksa server (lihat 2.9). Beri batas
  percobaan salah (juga untuk perintah perangkat) dengan 429 `terlalu_sering` (`retryInSec`).
- Disimpan sebagai hash (memakai `home_pins` yang sudah ada); PIN tidak masuk log.
- **Lupa PIN** (mengatur ulang tanpa PIN lama) lewat kode WhatsApp, seperti masuk:
  - `POST /account/pin/reset/start` (tanpa isi) → `{ "resendInSec": 60 }`. Server mengirim kode 6 angka ke WhatsApp
    pemilik (sekali pakai, kedaluwarsa pendek). Terlalu sering: 429 `terlalu_sering` (`retryInSec`).
  - `POST /account/pin/reset/verify` dengan `{ "code": "123456", "pin": "654321" }` (objek ketat) → `SecurityRes`.
    Kode cocok menyimpan `pin` sebagai PIN baru (`hasPin: true`); `pinEnabled` tidak berubah. Kode salah atau
    kedaluwarsa: 400 `kode_salah`. Beri batas percobaan salah.
  - Aplikasi: "Lupa PIN?" di lembar PIN dan di Keamanan membuka alur "Kode dikirim ke WhatsApp Anda" (kirim kode,
    masukkan kode, buat PIN baru, ulangi). Kode dan PIN baru dikirim bersama di langkah terakhir; kode salah
    mengembalikan ke langkah kode. Server tiruan: kode `123456` cocok, kode lain `kode_salah` (`000000` contohnya).

### 2.12 Beranda: `GET /home`, `PUT /places/current`, dan event `home`

Beranda satu pandang. Server yang menyusun ringkasannya; aplikasi hanya menampilkan.

`GET /home` → 200 `Home`:

```json
{
  "place": "Semua",
  "places": ["Rumah", "Kedai Dago", "Kedai Riau"],
  "greetingName": "Rina",
  "summary": "Ada 3 hal yang perlu Anda hari ini.",
  "approvals": [
    { "id": "d-17", "to": "Pak Budi", "channel": "whatsapp", "what": "balasan", "text": "...", "status": "draft",
      "ask": "Balasan untuk Pak Budi soal harga sewa sudah siap. Kirim?" }
  ],
  "agendaToday": [{ "id": "a1", "time": "09.00", "title": "Rapat dengan supplier susu", "kind": "meeting" }],
  "house": {
    "lines": [
      { "deviceId": "ac-kamar", "icon": "snow", "text": "AC kamar nyala · 24°", "label": "AC kamar", "on": true, "switchable": true },
      { "deviceId": "pintu-depan", "icon": "lock", "text": "Pintu depan terkunci", "switchable": false }
    ]
  },
  "business": { "source": "dari Moka", "sales": "Rp4.250.000", "change": "naik 12% dari Senin lalu", "down": false, "alert": "Susu UHT tinggal 6 karton" },
  "ring": { "nodes": [{ "key": "wa", "icon": "chat", "label": "WhatsApp", "reachable": true }] },
  "rev": 51
}
```

`PUT /places/current` dengan `{ "place": "Kedai Dago" }` (objek ketat) → 200 `Home` untuk tempat itu. Tempat yang tidak
dikenal pengguna: 400 `tidak_valid`. Pilihan tempat milik pengguna (dipakai juga oleh Perangkat dan Usaha), bukan milik
satu perangkat; server mengirim event `home` ke semua koneksi pengguna.

Aturan:

- `place`: `Semua` atau salah satu tempat pengguna. `places`: semua tempat nyata milik pengguna (tanpa `Semua`), berurutan;
  pemilih tempat menampilkan `Semua` lalu isi `places`, tanpa tempat contoh. `PUT /places/current` gagal: pilihan
  sementara di layar dikembalikan dan pengguna diberi tahu. Server lama tanpa `places` dibaca kosong (hanya `Semua`). Teks (`summary`, `text`, `sales`, `change`, `alert`) sudah jadi,
  berbahasa Indonesia sehari-hari; aplikasi tidak menyusunnya.
- `greetingName`: nama untuk sapaan, atau `null` (aplikasi menyapa "Selamat pagi" tanpa nama). Server asli tidak pernah
  mengirim nama orang lain.
- `approvals`: draf berstatus `draft` (menunggu persetujuan), yang tertua dulu. Isinya `Draft` yang sama dengan kartu di
  chat, ditambah `ask` (opsional): kalimat kartu "Butuh persetujuan Anda". Tanpa `ask` aplikasi menyusun "{Jenis} untuk
  {penerima} sudah siap. Kirim?". Aplikasi menampilkan satu kartu (yang pertama) dan tombol Lihat membuka chat. Draf yang
  disetujui, dibuang, atau dibatalkan keluar dari daftar pada event `home` berikutnya.
- `agendaToday`: paling banyak 3 baris (`HOME_AGENDA_MAX`), hari ini menurut jam, TANPA tugas (`kind: task`). `time`
  berformat `HH.MM`; `kind` adalah `reminder`, `meeting`, atau `recurring` (jenis yang belum dikenal tetap tampil).
- `house.lines`: baris kartu Rumah, berurutan. `icon` adalah nama ikon aplikasi; nama yang tidak dikenal diganti ikon
  bawaan (jangan ditolak). `on` ada hanya pada baris yang punya sakelar (AC); `switchable` = sakelar boleh diketuk
  (perangkat terjangkau). `sensitive` (opsional) = perangkat dijaga (kunci, kamera, alarm): sakelar **tidak** tampil di
  Beranda walau `switchable`, jadi sakelar tampil hanya bila `switchable && !sensitive`. Sakelar memanggil `POST /home/devices/:id` (bagian 2.9) dengan `{ "on": true|false }`.
  `label` (opsional) adalah nama perangkat untuk pembaca layar.
- `business`: ringkasan usaha untuk tempat terpilih, atau `null` kalau pengguna tidak punya usaha (kartu Usaha tidak
  tampil). `down: true` mewarnai `change` sebagai peringatan. `alert`: satu kalimat peringatan atau `null`. Tempat
  tanpa usaha (misalnya Rumah) boleh memakai angka gabungan.
- `ring.nodes`: simpul cincin Beranda dari layanan tersambung dan perangkat yang punya simpul cincin, berurutan.
  `reachable: false` = layanan/perangkat sumbernya tidak terjangkau (simpul abu-abu, "CCTV tidak terjangkau").
- `rev`: naik setiap isi Beranda berubah, per pengguna. Event `home` yang `rev`-nya lebih kecil dari yang dipegang
  aplikasi dibuang. Beranda dimuat ulang dengan `GET /home` setiap koneksi stream terbuka (juga yang pertama), dan
  jawaban `GET`/`PUT` yang `rev`-nya sama atau lebih baru dipakai apa adanya (tidak diubah di sisi aplikasi).
- Server menyiarkan `{ "type": "home", "home": Home }` setiap kali isinya berubah (draf, agenda, perangkat, layanan,
  tempat, usaha); beberapa perubahan dalam satu giliran boleh digabung. Jangan siarkan kalau tidak ada yang berubah.
- Pembacaan longgar (aplikasi): ikon yang tidak dikenal, bidang tambahan, dan baris yang rusak tidak menggagalkan
  Beranda; baris rusak dibuang. Hanya `place` atau `rev` yang hilang membuat jawaban dianggap salah (kendala server).
- `rev` tidak pernah turun di aplikasi: jawaban `GET /home` yang `rev`-nya lebih lama dari Beranda yang dipegang (event
  `home` masuk selagi memuat) dibuang dan dimuat sekali lagi. Aturan yang sama berlaku untuk Agenda, Perangkat, dan Usaha.
- Sapaan di Beranda mengikuti jam di zona pengguna (pagi 04-10, siang 11-14, sore 15-17, selain itu malam); kartu Agenda
  dan Rumah tidak tampil kalau `agendaToday` atau `house.lines` kosong.
- Perubahan ini aditif; `CONTRACT_VERSION` tetap 1.

### 2.13 Agenda dan alarm: `/agenda` dan event `agenda`

Agenda satu pengguna: pengingat, tugas, rapat, dan yang berulang. Server mengurai kalimat bebas; aplikasi hanya
menampilkan pratinjau dan menyimpannya.

`AgendaItem`:

```json
{
  "id": "a10", "date": "2026-10-21", "time": "07.00", "at": "2026-10-21T00:00:00.000Z",
  "title": "Berangkat ke bandara", "kind": "reminder", "way": "alarm",
  "note": "Penerbangan GA 408 jam 09.15, Terminal 3"
}
```

- `date` ("YYYY-MM-DD") dan `time` ("HH.MM") adalah jam dinding menurut zona waktu pengguna di server; dipakai untuk
  mengelompokkan per hari dan ditampilkan. `at` adalah saat yang sama sebagai ISO 8601 dengan zona dan menjadi acuan
  alarm di HP. `allDay: true` = sepanjang hari (`time` `00.00` diabaikan, tidak ada alarm berbunyi).
- `kind`: `reminder`, `task`, `meeting`, `recurring`. `way` (opsional): `alarm` (bunyi di HP), `call` (telepon),
  `notif` (notifikasi biasa). **Tanpa `way`, pengingat dibaca `notif`**: hanya `way: "alarm"` yang dijanjikan aplikasi
  sebagai alarm ("Bunyi sebagai alarm"), dijadwalkan di HP, dan dikabarkan lewat tanda terima; selain itu "Lewat
  notifikasi". `repeat`: keterangan berulang yang sudah jadi ("Tiap Senin"). `note`: keterangan.
- **Item berulang = kejadian.** Setiap kejadian punya `id` sendiri, `<seriesId>:<YYYY-MM-DD>` (tanggal kejadian itu,
  contoh `jemput:2026-10-26`), ditambah `seriesId` (`jemput`) yang sama untuk semua kejadian satu deret. Selesai, tunda
  (`PATCH`), dan tanda terima alarm berlaku per kejadian (id kejadian); menyelesaikan satu kejadian tidak menyentuh yang
  lain. Aplikasi menjadwalkan satu alarm per kejadian dalam 7 hari ke depan. Item sekali tidak punya `seriesId`.
- `done`: tugas atau pengingat selesai. `snoozedUntil` (ISO): ditunda; pengingat berikutnya berbunyi pada saat itu,
  bukan pada `at`. `notesMessageId`: rapat yang notulennya sudah ada di chat (id pesan notulen).

`GET /agenda?from=YYYY-MM-DD&to=YYYY-MM-DD` → 200:

```json
{ "items": [ ... ], "leftover": { "id": "l1", "title": "Kirim penawaran katering ke Bu Sari", "kind": "task", "...": "..." },
  "from": "2026-10-19", "to": "2026-11-01", "today": "2026-10-21", "now": "06.30", "tzOffsetMinutes": 420, "rev": 12 }
```

- Tanpa `from`/`to`: Senin pekan ini sampai Minggu pekan depan (14 hari), cukup untuk Hari ini, Minggu ini, dan alarm 7
  hari ke depan. Aplikasi SELALU memuat rentang bawaan ini (digabung dengan rentang bulan yang pernah dibuka di Kalender)
  tiap memuat ulang, dan sebelum menyamakan alarm memastikan `today` sampai `today + 7` sudah dimuat (pergantian pekan
  tanpa menutup aplikasi tidak membuat alarm pekan depan terlewat). `from`/`to` di jawaban adalah rentang yang sebenarnya dijawab (kedua ujung termasuk). Aplikasi meminta
  rentang bulan penuh saat membuka Kalender. `from` > `to` atau bukan tanggal: 400 `tidak_valid`.
- `items`: urut tanggal lalu jam. `leftover`: tugas hari kemarin yang belum selesai ("Kemarin belum selesai"), atau
  `null`. `today` dan `now` ("HH.MM") adalah hari ini dan jam sekarang menurut zona pengguna; aplikasi memakainya untuk
  garis "sekarang" dan menandai yang sudah lewat, jadi layar tidak bergantung pada zona waktu HP. Aplikasi memajukan
  `today` dan `now` sendiri tiap menit dari jawaban terakhir (garis "sekarang" dan "Kemarin belum selesai" berganti walau
  aplikasi tidak ditutup) dan memuat ulang rentangnya saat hari berganti.
- `tzOffsetMinutes`: selisih zona waktu pengguna dari UTC dalam menit (WIB 420, WITA 480, WIT 540). Jam yang berasal dari
  waktu ISO ("Ditunda sampai 07.10") ditampilkan menurut zona ini, bukan zona HP, supaya sama dengan `time` yang ditulis
  server. Server lama tanpa bidang ini dibaca 420.
- `rev`: naik setiap agenda pengguna berubah.

`GET /agenda/:id` → `{ "item": AgendaItem }` (layar alarm yang dibuka dari tautan, item di luar rentang yang dimuat).
Tidak ada: 404 `tidak_ditemukan`.

`POST /agenda/parse` dengan `{ "text": "Ingatkan saya bayar pajak motor tanggal 25" }` (objek ketat) → 200 (kalimat yang tidak
bisa dibaca: 422 `tidak_paham`, aplikasi menulis "Saya belum paham waktunya. Coba tulis misalnya: besok jam 9 rapat."):

```json
{ "preview": { "item": { "date": "2026-10-25", "time": "09.00", "at": "...", "title": "Bayar pajak motor",
                          "kind": "reminder", "way": "alarm" }, "guessedTime": true } }
```

Belum disimpan. `guessedTime: true` = jam tidak disebut dan server menebak; aplikasi menulis "Jamnya saya tebak".
Aplikasi meminta pratinjau setelah pengguna berhenti mengetik ~400 ms, jadi satu kalimat paling banyak satu request.
Teks kosong atau bukan teks: 400 `tidak_valid`.

`POST /agenda` dengan `{ "item": <item pratinjau, tanpa id> }` → 200 `{ "item": AgendaItem }` (server memberi `id`).
Server memvalidasi ulang dan boleh memperbaiki isinya.

`PATCH /agenda/:id` dengan `{ "done": true }` dan/atau `{ "snoozeUntil": "<ISO 8601>" }` (objek ketat, minimal satu) →
200 `{ "item": AgendaItem }`. "Tunda 10 menit" di layar alarm mengirim `snoozeUntil` = **maks(`snoozedUntil` ?? `at`,
sekarang) + 10 menit**: alarm 07.00 yang baru ditekan 07.25 ditunda sampai 07.35, bukan 07.10 yang sudah lewat. Aplikasi
memasang alarm tundaan di HP LEBIH DULU (tanpa menunggu internet), baru mengirim `PATCH`; kalau `PATCH` gagal, alarm di HP
tetap berbunyi pada waktunya, tanpa tanda terima, dan `PATCH` yang sama diulang pada penyamaan alarm berikutnya (juga
sesudah aplikasi ditutup) sampai berhasil. Item tidak ada: 404. Jawaban `item`, `POST /agenda`, dan `GET /agenda/:id`
dibaca longgar (bidang tambahan yang rusak atau baru dibuang, itemnya tetap dipakai).

`POST /agenda/leftover` dengan `{ "choice": "today" | "drop" }` → 200 `{ "item": AgendaItem | null }`. `today`
membuat tugasnya di agenda hari ini (item baru); `drop` melepasnya (`null`). Tidak ada sisa kemarin: 404.

**Alarm di HP dan tanda terima.** Aplikasi menjadwalkan sendiri alarm lokal (`AlarmManager.setAlarmClock`, jadi bunyi
walau HP terkunci atau internet mati) untuk setiap item `kind` `reminder`/`recurring` dengan `way: "alarm"`, belum
`done`, dalam 7 hari ke depan, pada `snoozedUntil ?? at`. Setelah HP berhasil menjadwalkannya, aplikasi mengirim

`POST /agenda/:id/alarm-ack` dengan `{ "scheduledFor": "<ISO 8601>" }` → 200 `{ "ok": true }`

dan aturan untuk server adalah:

- Aplikasi HANYA mengirim tanda terima setelah alarm benar-benar terpasang DAN akan terdengar: izin alarm tepat waktu
  diberikan, notifikasi aktif, dan saluran notifikasi `alarm` tidak dimatikan pengguna. Kalau salah satunya mati,
  tidak ada tanda terima dan pengingat jalan lewat WhatsApp seperti biasa.
- Server TIDAK mengirim pengingat yang sama (item dan `scheduledFor` yang sama) lewat WhatsApp: HP yang membunyikannya.
  Tanda terima itu juga menahan push `pengingat` untuk pengingat yang sama (HP sudah membunyikannya sendiri).
- **Tanda terima milik sesi (HP) yang mengirimnya**, dikenali dari token `Authorization`; server menyimpannya per sesi.
  Tanda terima gugur saat sesi itu keluar (`auth/logout`), saat token push HP itu dicabut (`DELETE /push-tokens`, bagian
  2.8), dan saat ganti akun (sesi lain). Pilihan "paling sederhana dan kuat": aplikasi TIDAK mengirim penghapusan
  tersendiri saat keluar atau ganti mode, cukup mengandalkan pencabutan sesi dan token push yang sudah diulang sampai
  berhasil; di HP sendiri semua alarm lokal dibatalkan saat keluar.
- **Cadangan bila HP tidak terlihat:** tanda terima hanya menahan WhatsApp kalau HP itu terlihat dalam 12 jam terakhir
  (stream tersambung atau request apa pun dengan token sesi itu). HP yang lama tidak terlihat (mati, aplikasi dihapus,
  henti paksa) tidak dipercaya lagi: server kirim lewat WhatsApp seperti biasa.
- Tanda terima berlaku untuk pasangan (id kejadian, `scheduledFor`). Kalau `at` atau `snoozedUntil` berubah, tanda terima lama
  gugur dan HP mengirim yang baru setelah menjadwalkan ulang; sebelum itu server mengikuti jalur biasa.
- Tanpa tanda terima pada saat pengingat jatuh tempo (HP mati, izin alarm tepat waktu dimatikan, aplikasi dihapus,
  atau `way` bukan `alarm`), server mengirim pengingat lewat WhatsApp seperti biasa. Itu cadangan, bukan duplikat.
- Idempoten: pasangan yang sama boleh dikirim berulang (aplikasi mengirim sekali per pasangan per proses, dan lagi
  setelah dibuka ulang). Item tidak ada: 404; `scheduledFor` bukan ISO 8601: 400.
- Alarm yang sudah berbunyi dan dimatikan di HP tidak perlu dikabarkan; `done` hanya berubah lewat `PATCH`.

**Stream.** `{ "type": "agenda", "items": [AgendaItem], "removed": ["id"], "leftover": AgendaItem | null, "rev": 13 }`.
Semua bidang selain `rev` opsional: `items` menambah atau menggantikan (upsert menurut `id`), `removed` membuang,
`leftover` (kalau ada) menggantikan sisa kemarin (`null` = hilang). Event dengan `rev` lebih kecil dari yang dipegang
aplikasi dibuang. Gabungkan perubahan yang berdekatan; jangan siarkan kalau tidak ada yang berubah. Setiap koneksi
stream terbuka, aplikasi memuat ulang rentang yang ia pegang dengan `GET /agenda`. Rentang di luar yang dimuat boleh
tetap ikut di `items`.

- Pembacaan longgar (aplikasi): item yang rusak atau berjenis yang belum dikenal dibuang satu per satu, bukan
  menggagalkan agenda. `Home.agendaToday` tetap dari `/home` (bagian 2.12) dan dihitung server dari agenda yang sama.
- Perubahan ini aditif; `CONTRACT_VERSION` tetap 1.

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
- `voice: true` (opsional): pesan lahir dari Mode Suara (ucapan pengguna atau balasan lisan, bagian 5a). Isinya tetap
  teks biasa di utas.
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
| `device` | `deviceId`, `name`, `on`, `deviceKind?`, `sensitive?`, `switchable?`, `temp?`, `mode?`, `note?` (aturan di 2.9) |
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
{ "type": "home", "home": { "place": "Semua", "rev": 52, "...": "..." } }
{ "type": "agenda", "items": [{ "id": "a10", "snoozedUntil": "...", "...": "..." }], "rev": 13 }
{ "type": "device", "devices": [{ "id": "ac-kamar", "...": "..." }], "rev": 12 }
{ "type": "business", "business": { "place": "Semua", "period": "hari", "rev": 8, "...": "..." } }
{ "type": "connection", "service": { "id": "gmail", "status": "connected", "...": "..." }, "rev": 12 }
{ "type": "history", "entry": { "id": "h91", "status": "terkirim", "...": "..." }, "rev": 32 }
{ "type": "account", "account": { "assistant": { "name": "Sari", "style": "ramah" }, "rev": 10, "...": "..." } }
{ "type": "thinking", "runId": "r-91", "on": true }
{ "type": "ping" }
```

- `message`: pesan baru ATAU pembaruan pesan dengan `id` yang sudah dikenal (upsert, menggantikan versi
  sebelumnya, tempat di utas tetap). Membawa semua pesan baru di utas, termasuk pesan pengguna dari WhatsApp
  (`via: 'whatsapp'`) dan pesan pengguna dari aplikasi lain milik akun yang sama. Aplikasi menggabungkan berdasarkan
  `id`.
- `draft`: perubahan draf; menimpa kartu `draft` dengan `draft.id` yang sama, dengan `rev` baru pesan pembawa kartu
  (wajib; lihat bagian 2.7). Event `message` untuk pesan itu tidak wajib: `draft` saja sudah cukup bagi tampilan.
- `home`: Beranda berubah (bagian 2.12); menggantikan `Home` di layar, kecuali `home.rev` lebih lama dari yang
  dipegang aplikasi (upsert menurut `rev`). Tidak perlu `message` yang menyertainya.
- `agenda`: agenda berubah (bagian 2.13); upsert per item menurut `id`, dibuang bila `rev` lebih lama dari yang dipegang
  aplikasi.
- `business`: Usaha satu `place` dan `period` berubah (bagian 2.15); menggantikan Usaha itu, dibuang bila `rev` lebih
  lama dari yang dipegang aplikasi.
- `connection`: satu layanan Terhubung berubah (bagian 2.16); upsert menurut `service.id`, dibuang bila `rev` lebih lama.
- `history`: satu entri Riwayat baru atau berubah (bagian 2.17); upsert menurut `entry.id`, dibuang bila `rev` lebih lama.
- `account`: Akun berubah (bagian 2.18); menggantikan Akun, dibuang bila `account.rev` lebih lama.
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

## 5a. Mode Suara: WebSocket `GET /voice`

Alamat: `wss://<host>/app/v1/voice`, terpisah dari `/stream`. Jabat tangan, header, 4401, 403/426 sama seperti
bagian 5. Satu JSON per pesan teks; skemanya `voiceClientMessageSchema` dan `voiceEventSchema` di `contract.ts`.

**Pilihan pustaka rekam (diputuskan Fase 6):** `expo-audio` 58 punya `useAudioStream`, yang mengalirkan PCM dari
mikrofon per potongan (bukan hanya merekam ke berkas). Maka aplikasi mengirim potongan PCM langsung, sehingga server
bisa memulai pengenalan ucapan sebelum pengguna selesai bicara. Format dikunci: **PCM 16-bit little-endian, 16 kHz,
mono**; aplikasi mencuplik ulang sendiri bila HP memberi laju lain.

Aplikasi ke server:

```json
{ "type": "start", "lang": "id", "clientId": "suara-lq3x-1", "format": { "codec": "pcm16", "sampleRate": 16000, "channels": 1 } }
{ "type": "audio", "seq": 0, "data": "<base64 PCM, sekitar 50-200 ms>" }
{ "type": "stop" }
{ "type": "cancel" }
{ "type": "text", "text": "Nyalakan AC kamar" }
```

- `start` membuka satu ucapan. `audio` berurutan (`seq` mulai 0). `stop` = pengguna melepas Inti (push-to-talk);
  server mengubah ucapan menjadi teks lalu menjawab. Server boleh juga menentukan sendiri ucapan selesai (deteksi
  hening) dan langsung mengirim `thinking`; aplikasi lalu mematikan mikrofonnya.
- `cancel` = buang ucapan ini, atau hentikan jawaban yang sedang berjalan (pengguna menyela / aplikasi ke latar).
  Server berhenti mengirim suara dan tidak menyimpan balasan yang belum selesai.
- `text` = pindah ke ketik di dalam Mode Suara; diperlakukan seperti ucapan yang sudah final (tanpa `start`).
- Ucapan paling lama 30 detik (`VOICE_MAX_UTTERANCE_SEC`); aplikasi berhenti sendiri dan mengirim `stop`. Server
  boleh menolak yang lebih lama dengan `error`.
- Satu soket boleh melayani banyak ucapan berturut-turut; server menutupnya dengan 4408 bila diam terlalu lama.

Server ke aplikasi:

```json
{ "type": "transcript", "text": "Matikan AC kamar", "final": false }
{ "type": "thinking", "on": true }
{ "type": "reply", "text": "Sudah. AC kamar saya matikan.", "messageId": "831" }
{ "type": "audio", "seq": 0, "data": "<base64>", "mime": "audio/mpeg", "final": true }
{ "type": "speech", "mediaId": "ucapan-77", "mime": "audio/mpeg" }
{ "type": "confirm", "card": { "kind": "payment", "...": "..." }, "messageId": "832" }
{ "type": "end", "reason": "selesai" }
{ "type": "error", "code": "stt_gagal" }
{ "type": "ping" }
```

- `transcript`: teks ucapan; `final: false` sementara dan boleh berubah, `final: true` yang dipakai untuk menjawab.
  Teks selalu tampil di layar (aksesibilitas), jadi `transcript` wajib dikirim.
- `thinking`: server sedang memproses (agen berjalan). Urutan lazim: `transcript(final)` → `thinking on` →
  `thinking off` → `reply` → suara → (`confirm`).
- `reply`: teks balasan. **Pesan asisten yang sama juga disimpan di utas chat** (`via: "app"`, `voice: true`) dan
  dikirim lewat `/stream` seperti pesan lain; `messageId` = id pesan itu. Ucapan pengguna juga masuk utas sebagai
  pesan pengguna dengan `voice: true`. Balasan memakai nama dan gaya asisten pilihan pengguna, dalam gaya lisan
  (pendek, tanpa tabel atau tautan).
- Suara balasan, dua cara (pilih salah satu per balasan):
  - `audio`: potongan base64 dengan `mime` (`audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/aac`, `audio/mp4`),
    `final: true` di potongan terakhir. Aplikasi menggabungkan potongan lalu memutarnya setelah yang terakhir (atau
    1,2 detik tanpa potongan baru bila `final` tidak pernah dikirim). Sederhana, tapi mulai bunyi setelah seluruh
    suara jadi.
  - `speech`: satu berkas di `GET /media/:id` (bagian 2.10). Aplikasi memutarnya dengan header token sehingga
    pemutar bisa mulai bunyi sambil mengunduh. **Untuk latensi rendah, pakai ini** dengan TTS streaming.
- `confirm`: pembayaran, pesan ke orang lain, dan aksi keamanan **tidak pernah dijalankan lewat suara saja**. Server
  mengirim kartunya (kontrak `Card` yang sama dengan chat: `payment`, `draft`, ...), pesan pembawa kartu sudah ada di
  utas (`messageId`, untuk pembayaran juga membawa bagian `choices`), lalu menunggu ketukan pengguna yang masuk lewat
  jalur HTTP biasa (`POST /drafts/:id`, `POST /messages` dengan pilihan). Sebelum ketukan itu tidak ada yang
  dijalankan. Aplikasi menampilkan kartu apa adanya dengan tombolnya; kartu yang tidak dikenal diarahkan ke chat.
- `end`: server mengakhiri sesi (aplikasi menutup soket). `error.code` tidak pernah ditampilkan; aplikasi memakai
  kalimat ramah. Jenis di luar daftar ini dilewati.

Penutupan: 4401 tidak sah (sesi dihapus, pengguna diminta masuk lagi), 4408 diam terlalu lama (aplikasi membuka sesi
baru saat Inti ditahan lagi), kode lain atau 1006 dianggap tidak tersambung ("Belum tersambung. Coba lagi sebentar
ya.") dan Inti mati sampai Inti ditahan lagi.

Perilaku acuan: `src/api/fake/voice.ts` (skrip server tiruan: teks ucapan muncul bertahap, berpikir, balasan, suara
hening, dan kartu konfirmasi untuk kalimat berisi "bayar", "token", atau "kirim ke").

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
