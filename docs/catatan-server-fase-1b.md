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
