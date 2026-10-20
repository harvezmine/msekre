# Roadmap aplikasi mobile Sekretaris AI

Ditulis 19 Okt 2026. Nama "Sekretaris AI" masih sementara.

Dokumen ini membagi pembangunan aplikasi menjadi delapan fase (0–7). Tiap fase menghasilkan sesuatu yang bisa
dipasang di HP dan dicoba. Rincian langkah demi langkah ditulis per fase di `docs/plans/`, tepat sebelum fasenya
dimulai, supaya rinciannya selalu mengikuti kode terbaru.

- Rencana produk dan IoT: `docs/plan-app-iot.md` di repo milo-ai.
- Desain: `design/handoff/` (hasil Claude Design 19 Okt 2026). Brief-nya ada di `docs/prompt-desain-app.md` milo-ai.

## Keputusan yang sudah diambil

| Hal | Keputusan |
|---|---|
| Teknologi | **Expo (React Native, TypeScript)**. Pada 19 Okt 2026 Flutter sempat dipilih, lalu diganti Expo. Alasannya satu bahasa dengan server, skema API bisa dipakai bersama, dan desainnya berupa React/HTML |
| Repo | Terpisah: folder `mobile/` di dalam milo-ai dengan git sendiri, diabaikan oleh git milo-ai. Perubahan server tetap di milo-ai, di branch `dev` |
| Desain | Hasil Claude Design dianggap cukup. Layar yang belum digambar (Agenda Minggu ini/Kalender, Perangkat mode gelap) dibuat dengan token dan komponen yang sama |
| Tab bawah | Beranda · Agenda · Inti (Nadia) · Perangkat · Usaha. Prototipe yang menaruh Riwayat di tab kelima tidak diikuti |
| Platform | Android dulu. iPhone setelah Fase 7 |
| Build | Development build (bukan Expo Go), karena alarm butuh modul native |

## Keputusan bawaan (boleh diubah sebelum fasenya dimulai)

| # | Hal | Bawaan | Paling lambat |
|---|---|---|---|
| 1 | Nama aplikasi | "Sekretaris AI", ditulis di satu konstanta (`src/brand.ts`) | Fase 7 |
| 2 | ID paket Android | `id.my.secretary.dev` untuk build uji. ID final **tidak bisa diganti setelah terbit**, jadi diputuskan bersama nama | Fase 7 |
| 3 | Isi chat | Satu utas: chat di aplikasi menampilkan seluruh percakapan, dari WA maupun aplikasi. Pesan dari WA diberi tanda kecil "lewat WhatsApp" | Fase 1 |
| 4 | Kanal balasan | Balasan dikirim ke kanal tempat pengguna terakhir menulis. Pesan proaktif (sapaan, pengingat, kabar rumah) dikirim lewat notifikasi aplikasi dulu, dan lewat WA kalau aplikasinya tidak terpasang atau tidak dibuka 3 hari | Fase 1 |
| 5 | Batalkan kiriman | Pesan ke orang lain ditahan 5 menit sebelum dikirim, dan bisa dibatalkan selama itu. Pesan yang sudah terkirim tidak ditarik | Fase 5 |
| 6 | PIN | Hanya untuk mematikan kamera atau alarm (memakai `home_pins` yang sudah ada). Pembayaran tidak memakai PIN | Fase 3 |
| 7 | Kata panggil kotak | "Nadia" | K1 (di luar roadmap ini) |

### Pertanyaan terbuka untuk founder

- **PIN membuka pintu.** Keputusan 6 menyebut PIN hanya untuk mematikan kamera atau alarm, tetapi aplikasi contoh (Fase 0b) juga meminta PIN untuk membuka kunci pintu depan (baris PIN di Akun: "...dan membuka pintu"). Perilakunya tidak diubah. Mohon putuskan sebelum Fase 3: PIN untuk pintu tetap ada (lalu perbarui keputusan 6), atau dibuang dari aplikasi.

## Arsitektur singkat

```
HP (Expo)                                   Server milo-ai (Fastify)
┌──────────────────────────┐   HTTPS        ┌──────────────────────────────────────────┐
│ expo-router: layar       │ ─────────────► │ src/appapi/routes.ts   /app/v1/*         │
│ src/api: klien + tipe    │   WebSocket    │ src/appapi/stream.ts   pesan baru, suara │
│   (contract.ts disalin)  │ ◄────────────► │ src/appapi/auth.ts     kode masuk lewat WA│
│ modul native `alarm`     │                │ src/appapi/channel.ts  AppChannel        │
│ expo-notifications (FCM) │ ◄── push ───── │ src/appapi/push.ts     FCM HTTP v1        │
└──────────────────────────┘                │        │                                  │
                                            │        ▼ ingest() yang sama dengan WA     │
                                            │ pipeline, agen, reminders, home, ...     │
                                            └──────────────────────────────────────────┘
```

- **Pesan dari aplikasi** masuk ke `ingest()` yang sama dengan webhook WhatsApp, persis seperti test chat
  (`src/testchat/routes.ts:175`). Penanda pesannya diawali `app.`. Agen, memori, tool, dan riwayat tidak perlu
  diubah.
- **Pesan keluar** tetap lewat `Outbox`. `AppChannel` menerapkan interface `WhatsApp` (`src/wa/client.ts`) dan
  membungkus `WebChatChannel` di `src/app.ts:160`. Untuk tiap pesan, ia memilih kirim ke aplikasi (WebSocket kalau
  terbuka, push kalau tidak) atau ke WA, sesuai keputusan #4. Semua tetap tercatat di tabel `messages`.
- **Kontrak API**: skema zod ada di `src/appapi/contract.ts` milo-ai. Aplikasi menyalinnya lewat
  `npm run sync:contract`, jadi tipe di server dan di aplikasi selalu sama.
- **Masuk**: nomor WhatsApp, lalu kode 6 angka dikirim lewat WA. Server menyimpan hash token sesi di
  `app_sessions`. Aplikasi menyimpan token di `expo-secure-store`. Token push disimpan di `app_devices`.

## Fase

Ukuran adalah **perkiraan kasar** untuk satu orang dibantu Claude, termasuk uji di HP. Angkanya akan dikoreksi
setelah Fase 0 dan 1 selesai.

### Fase 0: Fondasi visual (±3–4 hari)

Rincian: `docs/plans/2026-10-19-fase-0-fondasi.md`.

- **Persiapan:**
  - Node 24 LTS (Node 26 di Mac ini terlalu baru untuk Expo);
  - Android Studio dan SDK;
  - development build pertama.
- **Token dan komponen:**
  - token warna terang/gelap, tipografi Plus Jakarta Sans, dan ikon (path SVG dari desain);
  - **Inti** dengan 5 keadaannya, **cincin ekosistem** dengan aliran titik, dan tab bar dengan Inti menonjol.
- **Layar statis dengan data contoh:** Beranda (1a/1f), Chat kosong (1d), Mode Suara (1e), dan layar pemeriksa Inti
  (1k).
- **Server:** belum ada perubahan.
- **Selesai bila:** di HP Android, Beranda terlihat sama dengan desain 1a dan 1f (ikut mode gelap HP), Inti bernapas,
  titik mengalir di cincin, ketuk Inti membuka Chat, dan tahan Inti membuka Mode Suara dengan getar.

### Fase 0b: Semua layar dengan data contoh (±1–2 minggu)

Rincian: `docs/plans/2026-10-20-fase-0b-semua-layar.md`. Ditambahkan 20 Okt 2026 atas pilihan founder: semua layar
dibuat dulu supaya bisa dicoba dan dikoreksi di HP.

- Semua 23 layar desain dibuat dengan data contoh dan mode gelap, termasuk Minggu ini/Kalender di Agenda yang tidak ada
  di desain.
- Ada penyimpanan contoh bersama, jadi aksi di satu layar terlihat di layar lain.
- Empat alur prototipe bisa diklik: bicara mematikan AC, kirim lalu batalkan, tunda alarm, dan menyambungkan layanan
  baru.
- **Server:** belum ada perubahan.
- **Status (20 Okt 2026): selesai (kode).** Yang sudah ada:
  - semua layar desain dengan data contoh dan mode gelap;
  - penyimpanan contoh bersama, jadi aksi di satu layar terlihat di layar lain;
  - empat alur prototipe, diuji ujung ke ujung (`__tests__/alur.test.tsx`);
  - tes mode gelap dan lebar 360 dp untuk setiap layar.
- **Masih perlu dicek di HP** (tes Jest tidak bisa menilai ini):
  - gestur: tarik lembar (sheet), geser untuk mematikan alarm, putaran suhu;
  - kolom ketik terdorong papan ketik;
  - TalkBack;
  - huruf besar dari pengaturan sistem;
  - riak sentuhan dan getar sungguhan.
- **Akibat ke fase berikutnya:** di Fase 1–5, bagian "Aplikasi" berarti menyambungkan layar yang sudah ada ke data
  asli. Membuat layar dari nol tidak diperlukan lagi.

### Fase 1: Masuk dan Chat (±2 minggu), dibagi 1a (aplikasi) dan 1b (server)

Fase 1 dibelah dua pada 20 Okt 2026: **1a** sisi aplikasi dengan server tiruan, **1b** sisi server di milo-ai.
Rincian 1a: `docs/plans/2026-10-20-fase-1a-frontend-server.md`. Kontrak untuk 1b: `docs/api-v1.md`.

#### Fase 1a: Aplikasi di atas kontrak (status 20 Okt 2026: selesai, kode, frontend)

Yang sudah ada:
- kontrak API v1 revisi (`src/api/contract.ts`, zod), `HttpTransport` (HTTP + WebSocket dengan header versi, sambung
  ulang bertingkat, resync lewat `changedAfter`, pemeriksaan `GET /me` saat jabat tangan ditolak) dan `FakeTransport`
  (server tiruan di memori, mode `contoh`);
- masuk dan sesi: `useAuth`, token di secure-store, penjaga rute `Stack.Protected`, keluar lokal dulu;
- chat tersambung: daftar terbalik, pilihan, gambar, suara, kartu draf, antrean offline, banner koneksi dan akun
  tidak aktif/versi lama (`useChat`);
- notifikasi: lembar izin, saluran Android, token ke `POST /push-tokens`, ketukan membuka chat, diredam saat chat
  terbuka (kode saja).

Perlu perangkat atau Firebase (belum bisa dinilai dari tes Jest): push sungguhan (`google-services.json`), gestur
dan papan ketik di chat, pemutaran suara, membuka dokumen, TalkBack. Dokumen juga perlu keputusan URL bertanda
tangan (`docs/api-v1.md` bagian 2.10).

#### Fase 1b: Server (sesuai `docs/api-v1.md`)

Dikerjakan di milo-ai: modul `src/appapi/` (kontrak dipindah ke sana), `AppChannel`, tabel sesi/token push/pesan
(`rev`/`seq`), masuk lewat kode WhatsApp, `/stream`, media, draf dengan masa tahan 5 menit, dan push. Daftar tes ada
di akhir `docs/api-v1.md`. Pertanyaan terbuka untuk founder ada di bagian 10 dokumen itu.

#### Rencana awal Fase 1 (tetap berlaku sebagai ruang lingkup)

**Server (milo-ai):**
- Tabel `app_sessions` dan `app_devices`.
- `/app/v1/auth/start` mengirim kode lewat WA. `/app/v1/auth/verify` memberi token.
- `/app/v1/messages`: GET untuk riwayat (mundur per halaman), POST untuk mengirim (masuk ke `ingest()`).
- WebSocket `/app/v1/stream` untuk pesan baru dan tanda sedang berpikir.
- `AppChannel` untuk memilih kanal. FCM untuk push.
- Pesan keluar yang berupa tombol, gambar QRIS, atau dokumen dikirim ke aplikasi sebagai **kartu** dengan data
  terstruktur, bukan teks biasa.
- Tes `node --test` untuk auth, pemilihan kanal, dan bentuk kartu.

**Aplikasi:**
- 3 layar pertama kali membuka aplikasi (2n, 2o, 2p).
- Chat lengkap: riwayat, kirim, tanda berpikir, saran saat kosong.
- Kartu: konfirmasi kirim, perangkat, token listrik, QRIS, file, notulen (1b, 1c).
- Notifikasi push. Membuka notifikasi langsung membawa ke chat.

**Selesai bila:** satu pengguna bisa masuk dengan nomornya dan memakai Sekretaris AI penuh lewat aplikasi tanpa
membuka WhatsApp, dan pesan proaktif datang sebagai notifikasi aplikasi, bukan pesan WA.

**Risiko:**
- Kode masuk lewat Fonnte gratis. Di nomor resmi (WABA) kode masuk butuh template autentikasi yang berbayar.
- Saat ini `supportsButtons` berlaku untuk satu kanal penuh. Agar pengguna aplikasi dapat tombol sementara
  pengguna Fonnte tidak, pipeline perlu membaca kemampuan per pengguna.

### Fase 2: Beranda hidup, Agenda, dan alarm lokal (±2 minggu)

**Server:**
- `/app/v1/home`: ringkasan Beranda, yaitu agenda hari ini, rumah, usaha, persetujuan tertunda, dan simpul
  terhubung.
- `/app/v1/agenda?range=hari|minggu|bulan`.
- Tambah agenda dengan bahasa biasa: teks → pratinjau (tanggal, jam, jenis) → simpan. Memakai tool reminder yang
  sudah ada.
- "Kemarin belum selesai" dari `task_followups`.
- Tanda terima alarm per pengingat. Kalau aplikasi sudah menjadwalkan alarmnya, server tidak mengirim pengingat
  lewat WA. Kalau belum, server tetap mengirim lewat WA seperti sekarang.

**Aplikasi:**
- Beranda memakai data asli. Agenda: Hari ini, Minggu ini, Kalender. Lembar Tambah (2a, 2b).
- **Modul Expo lokal `alarm` (Kotlin)**:
  - `AlarmManager.setAlarmClock` dan notifikasi layar penuh;
  - jadwal dipulihkan setelah HP dinyalakan ulang.
- Layar alarm (2l) dengan Tunda dan Tanya Nadia.
- Layar panduan izin: alarm tepat waktu, notifikasi layar penuh, dan pengecualian penghemat baterai. Xiaomi, Oppo,
  dan Vivo sering mematikan alarm aplikasi.

**Selesai bila:** alarm tetap bunyi di mode pesawat, setelah HP dinyalakan ulang, dan di HP Xiaomi dengan
pengaturan bawaan.

**Risiko:**
- Kebijakan Play membatasi `USE_EXACT_ALARM` dan `USE_FULL_SCREEN_INTENT` hanya untuk aplikasi yang fungsi
  utamanya alarm atau kalender. Kita harus mengisi formulir deklarasi.
- Kalau ditolak, alarm memakai `SCHEDULE_EXACT_ALARM` yang izinnya diminta ke pengguna.

### Fase 3: Perangkat (±1,5 minggu)

**Server:**
- `/app/v1/devices`, dikelompokkan per tempat dan ruangan, dibungkus dari `src/home/`.
- Aksi perangkat, verifikasi PIN memakai `home_pins`, dan rutinitas.
- Pengelompokan tempat dan ruangan perlu ditentukan: belum jelas apakah memakai `home_names` atau kolom baru.
  Langkah pertama fase ini adalah mencari jawabannya di kode.

**Aplikasi:**
- Perangkat (2c), detail AC dengan putaran suhu (2d), lembar PIN (2e), Tambah perangkat (2f).
- Masuk ke akun merek memakai halaman sambung yang sudah ada di server, dibuka lewat `expo-web-browser`, lalu
  kembali ke aplikasi lewat deep link.

**Selesai bila:** AC dan lampu asli bisa dinyalakan/dimatikan dari aplikasi, dan mematikan kamera meminta PIN.

**Catatan:**
- Teks "perintah terakhir, bukan keadaan AC" hanya untuk perangkat inframerah. AC yang tersambung lewat LG ThinQ
  menampilkan keadaan aslinya.
- Kotak Sekretaris AI baru muncul setelah prototipe K1.

### Fase 4: Usaha (±1 minggu)

**Server:** `/app/v1/business` dari sumber yang sudah ada:
- penjualan dan stok dari `stock_*`;
- uang masuk dari Moota.
- Moka, Accurate, dan TikTok Shop belum dibangun; kartunya tampil hanya kalau sumbernya tersambung.
- "Pesan lagi" membuat draf lewat `pending_actions`.

**Aplikasi:** layar Usaha (2g) dengan grafik garis kecil dan kartu file laporan.

**Selesai bila:** angka di layar sama dengan yang dijawab Nadia di chat untuk pertanyaan yang sama.

### Fase 5: Terhubung, Riwayat, Akun (±1,5 minggu)

**Server:**
- Daftar semua sambungan: Google, Microsoft, Notion, Plaud, Moota, GitHub, MCP, merek rumah.
- Izin baca saja (`access_set`), hapus data per layanan (`memory_forget`), dan putuskan sambungan.
- `activity_log` untuk Riwayat.
- **Penahanan kiriman 5 menit** di relay (keputusan #5).

**Aplikasi:**
- Terhubung (2h–2k), termasuk animasi simpul baru masuk cincin.
- Riwayat (2m) dengan filter dan Batalkan.
- Akun (2q).

**Selesai bila:** menyambungkan Google dari aplikasi berhasil sampai simpulnya muncul di cincin Beranda, dan pesan
ke orang lain bisa dibatalkan dalam 5 menit.

### Fase 6: Mode Suara (±2 minggu)

**Server:** WebSocket suara.
- Alurnya: potongan audio → deteksi selesai bicara → suara jadi teks (Groq whisper) → agen dengan gaya jawaban
  lisan → teks jadi suara (ElevenLabs, streaming) → audio dikirim balik.
- Kalimat pengisi untuk tool yang lama.
- Pembayaran, pesan ke orang lain, dan aksi keamanan tidak dijalankan lewat suara saja; muncul kartu konfirmasi.

**Aplikasi:**
- Tahan Inti untuk bicara. Layar suara dengan 5 keadaan Inti dan teks langsung.
- Pemilihan pustaka rekam-streaming dilakukan di awal fase.

**Selesai bila:** dari selesai bicara sampai mulai dijawab di bawah 2 detik (median 20 percobaan) di jaringan 4G.

**Risiko:** latensi. Jalur server ini nanti dipakai juga oleh kotak IoT.

### Fase 7: Rilis Play Store (±1 minggu kerja, ditambah waktu tunggu Google)

- Nama final, ID paket final, dan cek merek di PDKI.
- Logo vektor untuk ikon dan Inti.
- Akun Play Console organisasi (PT Mitra Visi Digital, D-U-N-S) dan verifikasi developer Android.
- Deklarasi izin alarm dan layar penuh, formulir keamanan data, dan kebijakan privasi (UU PDP).
- Pelaporan crash (Sentry).
- EAS Build dan Submit: uji internal → uji tertutup → produksi.

## Urutan dan jalur paralel

```
Fase 0 ─► Fase 0b ─► Fase 1a ─► Fase 1b ─┬─► Fase 2 ─┐
                                         ├─► Fase 3 ─┼─► Fase 6 ─► Fase 7
                                         ├─► Fase 4 ─┤
                                         └─► Fase 5 ─┘
```

- Fase 0, 0b, 1a, dan 1b harus berurutan (1a boleh jalan selagi 1b dirancang, karena kontraknya sudah beku). Fase 2–5 boleh ditukar urutannya sesuai prioritas bisnis. Fase 6 butuh chat dan
  kartu konfirmasi dari Fase 1.
- **Mulai hari ini, berjalan paralel karena butuh waktu tunggu:**
  1. Akun Play Console organisasi dan D-U-N-S (bisa berminggu-minggu).
  2. Proyek Firebase untuk FCM (dibutuhkan di Fase 1).
  3. File vektor logo (SVG/AI) dari pembuatnya. Gambar di desain hanya 282×310 piksel.
  4. Nama aplikasi dan cek PDKI.

## Cara kerja per fase

1. **Sebelum fase mulai**, tulis rincian `docs/plans/<tanggal>-fase-N-<nama>.md`: file yang disentuh, langkah
   kecil, dan tes.
2. **Server** dikerjakan di milo-ai branch `dev`. Tes memakai `npm test` dengan Postgres lokal.
3. **Aplikasi** dikerjakan di repo ini. Tes logika memakai Jest (`npx jest`). Tampilan dicek di HP Android lewat
   development build.
4. **Commit kecil per langkah** di repo masing-masing. Tidak ada commit gabungan lintas repo.
5. **Akhir fase**: founder mencoba di HP sesuai kriteria "selesai bila". Temuan dicatat sebelum fase berikutnya.

## Daftar uji di HP: Fase 0b

Dijalankan di perangkat Android sungguhan sebelum Fase 1.

1. **Lembar dan tombol kembali Android.** Tempat, Tambah, PIN, masuk, konfirmasi: kembali, ketuk latar, geser pelan, sentak cepat. Agenda → + → mikrofon → kembali. Suara → Pindah ke ketik → kembali.
2. **Keyboard.** Tambah, kolom chat (navigasi gestur dan tiga tombol), kode di layar pertama kali.
3. **Dial.** Seret, lewat 30 lalu balik, ketuk di cincin, ketuk di celah, getar tiap derajat, menggulir dari cincin dibanding dari tengah.
4. **Alarm.** Geser lebih dari 80% mematikan, yang lebih pendek kembali; getar tiap 2 detik berhenti saat keluar; Tanya Nadia; kembali.
5. **Alur 4.** Animasi simpul bergabung, Selesai ke Beranda dengan 8 simpul, kembali di Tersambung.
6. **Layar pertama kali** lewat Akun → Coba: 6 kotak kode, tempel, isi otomatis, hitung mundur dan kirim ulang, Lewati dulu lalu kembali.
7. **HP sempit dan font terbesar.** Cincin, Riwayat, Akun, lembar tinggi, Tersambung, Mulai.
8. **TalkBack.** Label cincin, ubin, dial (dapat disesuaikan), sakelar, pilihan radio, isi di belakang lembar tidak terbaca.
9. **Mode gelap** diganti langsung, splash gelap, sudut riak pada tombol pil.
10. **Getar** (Kirim, PIN salah, dial, alarm), serta jeda dan lanjut Orbit/Inti saat aplikasi ke latar lalu kembali.
