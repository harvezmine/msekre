# Fase 2a–6a: Seluruh frontend tersambung ke kontrak, bisa dites dengan server tiruan

> **Untuk agen yang mengerjakan:** pakai superpowers:subagent-driven-development, tugas demi tugas, berurutan.

**Tujuan:** setiap layar aplikasi membaca dan menulis data lewat kontrak API dan transport. Layar tidak lagi membaca
penyimpanan contoh 0b secara langsung. Dalam mode `contoh`, server tiruan (`FakeTransport`) memegang semua data, jadi
aplikasi bisa dicoba penuh tanpa server asli. Fase 1b dan Fase 2–6 di server tinggal mengikuti kontrak yang sama.

Bagian native (alarm lokal, rekaman suara) ditulis sekarang, tapi baru bisa dipastikan di HP lewat build EAS.

**Keputusan founder (21 Okt 2026):**
1. **Aplikasi adalah add-on opsional yang terpisah.**
   - Masuk ke aplikasi hanya untuk pengguna yang **sudah** memakai Sekretaris AI lewat WhatsApp. Aplikasi tidak
     membuat akun dan tidak memulai trial.
   - Nomor yang belum terdaftar dibalas `404 belum_terdaftar` dengan `waNumber`. Layar masuk lalu menampilkan "Nomor ini
     belum memakai Sekretaris AI. Mulai dulu lewat WhatsApp ya." dengan tombol "Mulai lewat WhatsApp"
     (`https://wa.me/<waNumber>?text=Halo%2C%20saya%20mau%20coba%20Sekretaris%20AI.`).
   - Alur dan pesan proaktif WhatsApp tidak berubah. Notifikasi aplikasi hanya tambahan, sesuai yang diizinkan pengguna.
2. **Dokumen dibuka dengan alur normal.**
   - "Buka" mengunduh berkas lewat `GET /media/:id` dengan header Authorization ke cache aplikasi, lalu membukanya di
     aplikasi bawaan HP (intent VIEW dengan content URI).
   - "Bagikan" membuka lembar bagikan sistem.
   - Tautan bertanda tangan tidak diperlukan.
3. **PIN pilihan pengguna, bawaannya mati.**
   - Akun → Keamanan berisi saklar "Minta PIN untuk kamera, alarm rumah, dan kunci pintu" (mati), plus alur "Buat PIN"
     (masukkan, lalu ulangi) dan "Ganti PIN".
   - Kalau saklarnya mati, aksi itu langsung jalan tanpa PIN.
   - Pembayaran tidak pernah memakai PIN.

**Arsitektur:**
- **Kontrak v1 diperluas per bidang.** Setiap bidang mendapat:
  - skema zod di `src/api/contract.ts` (atau file per bidang yang diekspor ulang dari sana);
  - metode di `Transport`;
  - implementasi di `HttpTransport` dan `FakeTransport`;
  - hook data `useHome`, `useAgenda`, `useDevices`, `useBusiness`, `useConnections`, `useHistory`, `useAccount`, dan
    `useVoice`, masing-masing berisi controller kecil seperti `ChatController`, dengan cache, muat, aksi, dan pembaruan
    dari stream.
- **Stream event baru** memakai pola upsert yang sama: `home`, `agenda`, `device`, `business`, `connection`, `history`.
  Setiap event membawa `rev`.
- **Data contoh pindah ke server tiruan.** Data dan reducer dari `src/sample/*` menjadi milik `FakeTransport`.
  - Layar hanya memakai hook.
  - `ContohBridge` dan `SampleProvider` dihapus di akhir, setelah semua layar pindah.
  - Empat alur prototipe tetap jalan, karena sekarang semuanya lewat server tiruan.
- **Dokumentasi:** setiap perluasan kontrak ditulis juga di `docs/api-v1.md` (bagian baru per bidang) dan
  `docs/catatan-server-fase-1b.md`.

**Aturan tetap:**
- Semua aturan Fase 0–1a berlaku, termasuk pengaman disk.
- Satu subagen pada satu waktu.
- Tes penuh hanya sebelum commit, lalu `jest --clearCache`.
- Tidak ada build Android, export, atau prebuild di Mac ini; build lewat EAS.
- Teks di layar mode server tidak memakai istilah teknis atau kata "Fase N".

## Status (21 Okt 2026): Tugas 0–8 selesai

Semua tugas sudah dikerjakan di branch `dev` repo ini. Kode native (alarm Kotlin, rekaman suara) belum pernah dikompilasi
atau dijalankan di Mac ini; itu menunggu build EAS dan uji di HP (`docs/ROADMAP.md`, daftar uji HP).

| Tugas | Isi | Commit |
|---|---|---|
| 0 | Aplikasi add-on tanpa daftar, dokumen diunduh lalu dibuka, PIN opsional bawaan mati | `0a1f53d` |
| 1 | Server tiruan memegang data contoh, Beranda lewat kontrak | `10fc6f0` |
| 2A | Agenda lewat kontrak, server membaca kalimat, Tambah dengan pratinjau | `1c4b8ed` |
| 2B | Alarm lokal di HP (modul Expo Kotlin), sinkron dengan agenda, panduan izin alarm | `c0a564c` |
| 3 | Perangkat: kontrak dan server tiruan, lalu layar (Perangkat, detail AC, PIN, Beranda, kartu chat) | `9edb7c2`, `86c898c` |
| 4 | Usaha lewat kontrak, "Pesan lagi" | `ea7c1d2` |
| 5 | Terhubung lewat kontrak, sambung lewat halaman masuk resmi | `86c0b72` |
| 6 | Riwayat dan Akun: kontrak lalu layar | `142f14f`, `05b962d` |
| 7 | Mode Suara: `expo-audio` dan keep-awake, lalu soket `/voice`, rekam PCM, kartu konfirmasi | `892a8a5`, `caa53d6` |
| 8 | Bersih-bersih, tes ujung ke ujung, matriks layar, ROADMAP | `3395283`, `4dbd32b`, `0ca88cb` |

Perbaikan tinjauan di antaranya: F1 `6cb9ce9`, `d16bf8c`, `caf5789`; F2 `c93d86d`, `598c24d`, `d242076`, `c168362`.
Di luar tugas: layar pembuka beranimasi `d73e0bb`, `deploy-apk.sh` `4c8d74d`, `bd93927`, konfigurasi EAS `3511973`,
`63e34d5`. (Daftar lengkap: `git log --oneline 842c1b6..HEAD`.)

**Tugas 8, yang dikerjakan:**
- Tidak ada layar atau komponen di `app/` dan `src/ui/` yang membaca atau menulis penyimpanan contoh. Data contoh hanya
  dipakai `src/api/fake/*`. `SampleProvider`, `ApiSampleProvider`, dan hook `useSample*` dihapus; `SampleStore` tinggal
  data pribadi `FakeTransport`.
- Toast berdiri sendiri: `ToastProvider`, `useToast`, dan `ToastHost` di `src/ui/toastStore.tsx` dan `src/ui/Toast.tsx`.
- Tanggal (`src/api/dates.ts`), konstanta perangkat (`src/api/constants.ts`), salinan layanan (`src/api/serviceCopy.ts`), dan
  pengguna/alarm contoh (`src/api/demo.ts`) pindah keluar dari `src/sample`.
- Teks: tidak ada "Fase N" atau "dibangun" di layar (contoh maupun server); "Nadia" hanya lewat `DEFAULT_ASSISTANT`.
- Tes: `e2e-contoh` (10), `e2e-server` (11, `HttpTransport` ke server palsu `fakeHttp.ts`), `layar-matriks` (73), `toast-store`.

---

## Tugas 0: Terapkan tiga keputusan founder

- `auth/verify` dan `auth/start`: kode error `belum_terdaftar` (404) dengan `waNumber` di kontrak, server tiruan, dan
  layar masuk. Server tiruan menganggap nomor berakhiran `0000` belum terdaftar, untuk tes.
- Konfigurasi cadangan `EXPO_PUBLIC_WA_NUMBER` lewat `extra.waNumber`.
- Dokumen:
  - `useMedia().download(mediaId)`, memakai `expo-file-system` dengan header;
  - `openFile` lewat `expo-intent-launcher` (`ACTION_VIEW` dengan `getContentUriAsync`), dengan cadangan
    `expo-sharing`;
  - "Bagikan" memakai `expo-sharing`;
  - mode contoh membuat berkas contoh kecil di cache;
  - pesan ramah kalau tidak ada aplikasi yang bisa membuka berkasnya.
- PIN:
  - kontrak `GET/PUT /account/security`: `{ pinEnabled, hasPin }`;
  - `POST /account/pin`: buat atau ganti, dengan `{ pin, currentPin? }`;
  - `POST /account/pin/verify`;
  - layar `app/akun/keamanan.tsx`, ditambah alur buat dan ganti PIN memakai `PinPad`;
  - `/pin` hanya muncul kalau `pinEnabled`;
  - bawaannya mati di server tiruan.
- `docs/api-v1.md` bagian 10: tandai pertanyaan 1 dan 2 sebagai sudah diputuskan. Catat juga keputusan PIN dan
  add-on di ROADMAP.

## Tugas 1: Beranda (`/home`)

- `GET /home` mengembalikan:
  - `{ greetingName, summary, approvals: Draft[] }`;
  - `agendaToday: AgendaItem[]` (maks 3, tanpa tugas);
  - `house: { lines: HouseLine[], ac?: DeviceSummary }`;
  - `business: BusinessSummary | null` (untuk tempat terpilih);
  - `ring: { nodes: RingNode[] }` (dari layanan dan perangkat, dengan `reachable`);
  - `place`.
- `PUT /places/current { place }`.
- Event stream `home` (upsert ringkasan).
- `useHome()`; Beranda, `PlaceButton`, `/tempat`, dan cincin memakai hook ini.
- **Tes:** Beranda dalam mode contoh sama dengan sebelumnya; mode gelap; tempat berganti; persetujuan muncul dan hilang
  mengikuti draf.

## Tugas 2: Agenda dan alarm lokal

**Kontrak:**
- `GET /agenda?from=YYYY-MM-DD&to=…` mengembalikan `{ items, leftover }`.
- `POST /agenda/parse { text }` mengembalikan pratinjau `{ item, guessedTime }`. Server yang mengurai kalimat; pengurai
  contoh pindah ke server tiruan.
- `POST /agenda { item }`.
- `PATCH /agenda/:id { done?, snoozeUntil? }`.
- `POST /agenda/leftover { choice }`.
- Event `agenda`.

**Alarm lokal:**
- `src/alarm/` berisi antarmuka `AlarmScheduler` dengan dua isi: native dan tiruan untuk tes.
- Isi native memakai modul Expo lokal `modules/alarm` (Kotlin):
  - `AlarmManager.setAlarmClock`;
  - notifikasi layar penuh yang membuka `/alarm?id=`;
  - jadwal dipulihkan setelah HP dinyalakan ulang (`BOOT_COMPLETED`);
  - izin `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, dan `POST_NOTIFICATIONS`.
- Kalau ada pustaka terawat yang setara, boleh dipakai; laporkan pilihannya.
- **Sinkron:**
  - Setiap pengingat berjenis `alarm` dijadwalkan di HP.
  - Tanda terima `POST /agenda/:id/alarm-ack` dikirim ke server, supaya server tidak mengirim pengingat yang sama lewat
    WhatsApp. Ini aturan server, dicatat di dokumen.
- **Layar panduan izin** (`app/izin-alarm.tsx`): alarm tepat waktu, layar penuh, dan pengecualian penghemat baterai.
  Untuk Xiaomi, Oppo, dan Vivo ada panduan singkat bergambar ikon.

**Tes (dengan tiruan):** penjadwalan, pembatalan, dan penundaan; tanda terima; layar alarm dari id. Kode native belum
bisa dites di sini, jadi jelaskan di laporan.

## Tugas 3: Perangkat

**Kontrak:**
- `GET /devices?place=` mengembalikan `{ places, rooms, devices, box, routines }`.
- `POST /home/devices/:id` (sudah ada; Fase 3 server) untuk kendali.
- `POST /routines/:id/run`.
- `PUT /box { micOn }`.
- Mematikan kamera, alarm rumah, atau membuka kunci:
  - kalau `pinEnabled`, kirim `pin` di body;
  - kalau PIN salah, server membalas `403 pin_salah`.
- Event `device`.

Layar Perangkat, detail AC (putaran suhu), PIN, dan Tambah perangkat memakai `useDevices()`.

## Tugas 4: Usaha

- `GET /business?place=` mengembalikan `{ sales, series, branches, moneyIn, lowStock, orders, report }`.
- `POST /business/reorder` membuat draf ke supplier. Drafnya tampil di chat, dan tidak ada yang terkirim tanpa
  persetujuan.
- Event `business`.

Layar Usaha memakai `useBusiness()`.

## Tugas 5: Terhubung

**Kontrak:**
- `GET /connections` mengembalikan `{ connected, catalog, formerly }`.
- `GET /connections/:id` mengembalikan `{ service, capabilities, permission }`.
- `PUT /connections/:id/permission`.
- `POST /connections/:id/forget`.
- `DELETE /connections/:id`.
- `POST /connections/:id/start` mengembalikan `{ url }`, yaitu halaman masuk resmi layanan.

**Alur sambung:**
- Aplikasi membuka `url` dengan `expo-web-browser` `openAuthSessionAsync`, dengan alamat kembali
  `sekretarisai://terhubung/tersambung?id=`.
- Server tiruan langsung "berhasil" dan meniru animasi simpul masuk cincin.
- Event `connection`.

Layar Terhubung (2h–2k) memakai `useConnections()`.

## Tugas 6: Riwayat dan Akun

**Kontrak:**
- `GET /history?kind=&before=` mengembalikan `{ items, before }`, berupa entri dengan `undoable`, `until`, dan
  `outgoingId`. Batalkan memakai `POST /drafts/:id cancel`.
- `GET /account` mengembalikan `{ me, plan, assistant: { name, style }, notifications, security, phones }`.
- `PUT /account/assistant`.
- `PUT /account/notifications`.
- `DELETE /account/phones/:id`.

**Layar:**
- Riwayat dan Akun memakai hook masing-masing.
- Halaman pengaturan baru:
  - "Nama dan gaya asisten": nama, dan gaya Singkat / Ramah / Formal;
  - "Notifikasi": saklar per jenis;
  - "HP yang terhubung": daftar perangkat, dengan Keluarkan;
  - "Privasi": daftar layanan, dengan "Hapus yang Nadia tahu".

## Tugas 7: Mode Suara

**Kontrak WebSocket `/voice`** (terpisah dari `/stream`):
- Klien mengirim `start { lang: 'id' }`, potongan audio (frame biner PCM16 16 kHz, atau base64 kalau biner tidak
  didukung), lalu `stop`.
- Server mengirim:
  - `transcript { text, final }`;
  - `thinking`;
  - `reply { text }`;
  - potongan audio balasan (`audio`);
  - `confirm { card }` untuk pembayaran, pesan ke orang lain, dan aksi keamanan, yang ditampilkan sebagai kartu dan
    tidak dijalankan lewat suara saja;
  - `end`.

**Aplikasi:**
- Rekaman memakai `expo-audio`, atau pustaka streaming yang terawat; laporkan pilihannya.
- Tahan Inti untuk bicara, lepas untuk mengirim.
- Keadaan Inti mengikuti event, dan cincin mendengar mengikuti keras-pelannya suara dari meter rekaman.
- Teks langsung tampil di layar.
- Balasan suara diputar, dan teksnya tetap tampil.
- Tombol: Bisukan, Pindah ke ketik, Selesai.
- Server tiruan memakai skrip contoh yang sekarang ada di `src/sample/voice.ts`.

**Tes:** urutan keadaan, kartu konfirmasi, bisukan, dan pindah ke ketik. Rekaman dan pemutar di-mock.

## Tugas 8: Bersih-bersih dan pemeriksaan menyeluruh

**Yang dikerjakan:**
- Hapus `SampleProvider`/`ContohBridge`. Data contoh hanya tinggal di server tiruan.
- Tes empat alur prototipe dan semua layar (mode gelap, 360 dp) lewat server tiruan.
- Mode server dicek dengan `HttpTransport` ke server palsu di tes (fetch dan WebSocket tiruan).
- ROADMAP: status, daftar uji HP tambahan (alarm, suara, dokumen, PIN), dan daftar bahan dari founder.
- Satu review akhir tanpa temuan Kritis.
