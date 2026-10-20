# Fase 1a: Frontend siap bicara dengan server (masuk, chat, notifikasi)

> **Untuk agen yang mengerjakan:** pakai superpowers:subagent-driven-development, tugas demi tugas, berurutan.

**Tujuan:** aplikasi punya lapisan data yang memakai kontrak API yang sama dengan server nanti. Kontraknya meliputi
masuk dengan nomor WhatsApp, riwayat dan pengiriman chat, pesan langsung, kartu, persetujuan kiriman, dan notifikasi.

Selama server (Fase 1b) belum ada, aplikasi berjalan dengan **server tiruan** di dalam aplikasi. Server tiruan
memenuhi kontrak yang sama persis. Begitu server asli siap, cukup ganti satu setelan.

**Kenapa frontend dulu:** founder meminta frontend Fase 1 dikerjakan lebih dulu (20 Okt 2026). Kontrak yang ditulis di
sini menjadi spesifikasi server di Fase 1b.

**Arsitektur:**
- **`src/api/contract.ts`** berisi skema zod untuk semua request, response, dan event. Tipe TypeScript diturunkan dari
  skema ini.
  - Di Fase 1b, file ini dipindah ke milo-ai (`src/appapi/contract.ts`) sebagai sumber kebenaran.
  - Aplikasi kemudian menyalinnya lewat `npm run sync:contract`.
- **`Transport`** adalah satu antarmuka dengan dua isi:
  - `HttpTransport`: HTTP ke `/app/v1/*` ditambah WebSocket `/app/v1/stream`;
  - `FakeTransport`: server tiruan di memori, dengan balasan dan event berjadwal.
  - Pilihannya lewat `src/api/mode.ts`. Bawaannya `contoh` di build uji, dan bisa diganti dari Akun → Coba.
- **Hook data** dipakai layar, sehingga layar tidak tahu transport mana yang dipakai: `useAuth()`, `useChat()`,
  `usePush()`.
- **Penyimpanan contoh 0b** tetap dipakai layar lain (Agenda, Perangkat, Usaha, dan seterusnya), dan disambungkan di
  Fase 2–5. Chat berpindah ke `useChat()`.
- **Token sesi** disimpan di `expo-secure-store`. Kalau server membalas 401, sesi dihapus dan aplikasi kembali ke layar
  masuk.

**Teknologi tambahan:**
- `zod` versi 4, sama dengan milo-ai;
- `expo-secure-store`;
- `expo-notifications`;
- `expo-device` (sudah ada di template);
- `@react-native-community/netinfo` atau `expo-network`, untuk tanda sinyal.

**Aturan tetap:**
- Semua aturan teknis Fase 0 dan 0b berlaku.
- Teks pesan gagal di layar: "Lagi ada kendala, sudah dilaporkan ke tim. Coba lagi sebentar ya." Kode error tidak
  pernah ditampilkan.
- Tidak ada yang terkirim ke orang lain tanpa persetujuan pengguna.

---

## Kontrak API (v1, revisi 20 Okt)

Direvisi sesudah review Tugas 1–2 dan sebelum chat (Tugas 3). Sumber kebenarannya `src/api/contract.ts`; alasan tiap
perubahan ada di `docs/catatan-server-fase-1b.md`.

Semua jalur diawali `/app/v1`. Header `Authorization: Bearer <token>` wajib, kecuali untuk `auth/*`. Isi request dan
response berupa JSON. Setiap request HTTP dan jabat tangan WebSocket membawa `X-App-Version` (dari `expo.version`) dan
`X-Contract-Version`.

| Jalur | Request | Response |
|---|---|---|
| `POST /auth/start` | `{ phone: string }` (format E.164 tanpa +, contoh `6281220457781`) | `{ resendInSec: number }`. Kode dikirim lewat WhatsApp. Diulang sebelum `resendInSec` → 429 `terlalu_sering` |
| `POST /auth/verify` | `{ phone, code: string(6) }` | `{ token, user: Me }`. Kode salah, kedaluwarsa, atau belum diminta → 400 `kode_salah` |
| `POST /auth/logout` | — | `{ ok: true }` |
| `GET /me` | — | `Me` |
| `GET /messages?before=<seq>&limit=30` | — | `{ items: Message[], before: number \| null }`, terbaru dulu. `before` yang tidak ada → halaman terbaru |
| `GET /messages?changedAfter=<rev>&limit=100` | — | `{ items: Message[], more: boolean }`, terlama dulu menurut `rev`; memuat pesan baru DAN pesan lama yang diperbarui. Untuk resync |
| `POST /messages` | `{ kind: 'text', clientId, text }` atau `{ kind: 'choice', clientId, messageId, choiceId }` (objek ketat, tidak boleh campuran) | `{ message: Message }`. Pesan pengguna yang tersimpan; balasan datang lewat stream. Judul pilihan diambil server |
| `POST /drafts/:id` | `{ action: 'send' \| 'cancel' \| 'discard' \| 'edit', text? }` | `{ draft: Draft }` |
| `POST /push-tokens` | `{ pushToken, platform: 'android' \| 'ios' }` | `{ ok: true }` |
| `POST /home/devices/:id` | `{ on?, temp?, mode? }` (minimal satu) | `{ card: DeviceCard }`. Fase 3; Fase 1b boleh 501 `belum_tersedia` |
| `GET /media/:id` | — | berkas (gambar QRIS, dokumen), dengan token |
| `WS /stream` | — | event `StreamEvent` dalam bentuk JSON per pesan. Token di header `Authorization`, bukan query string |

**Error** (`{ error: <kode>, retryInSec? }`): 400 `tidak_valid` / `kode_salah`; 401 `tidak_masuk`; 403 `diblokir`;
404 `tidak_ditemukan`; 409 `status_draf` / `sudah_dipilih`; 426 `perlu_pembaruan`; 429 `terlalu_sering` (dengan
`retryInSec`); 500 `server`; 501 `belum_tersedia`.

**Tipe:**

```
Me       = { id, name: string|null, assistantName: string, plan: { name: string, activeUntil: ISO8601|null },
             phone: string }   // E.164 tanpa +, untuk Akun bila name kosong
Message  = { id: string, seq: number, rev: number, clientId?: string, at: ISO8601, from: 'user'|'assistant',
             via: 'app'|'whatsapp', parts: Part[] }
Part     = { type: 'text', text }
         | { type: 'choices', prompt?: string, choices: { id, title, description? }[], chosenId?: string }
         | { type: 'image', mediaId, mime, caption?, alt? }
         | { type: 'document', mediaId, name, mime, sizeBytes }
         | { type: 'audio', mediaId, mime, transcript? }
         | { type: 'card', card: Card }
         | { type: 'unknown', note }          // dibuat aplikasi saat membaca; server tidak mengirimnya
Card     = { kind: 'draft', draft: Draft }
         | { kind: 'device', deviceId, name, on: boolean, temp?: number, mode?: string, note?: string }
         | { kind: 'notes', title, when, decisions: string[], meetingId }
         | { kind: 'payment', title, amountRp: number, lines: { label, value }[], ask: string }
         | { kind: 'qris', amountRp, until: ISO8601, status: 'menunggu'|'lunas'|'kedaluwarsa', mediaId }
Draft    = { id, to, channel: 'whatsapp'|'email', what: 'balasan'|'pesanan'|'email'|'undangan',
             text, status: 'draft'|'held'|'sent'|'cancelled'|'failed', heldUntil?: ISO8601 }
StreamEvent = { type: 'message', message: Message }       // id yang sudah dikenal = upsert
            | { type: 'draft', draft: Draft }             // menimpa kartu dengan draft.id yang sama
            | { type: 'thinking', runId: string, on: boolean }
            | { type: 'ping' }
```

**Aturan perilaku server, yang ditiru juga oleh server tiruan:**
- **Waktu:** semua ISO 8601 dengan zona. Aplikasi memformatnya ke jam HP dengan `formatJam(iso)` → "10.47".
- **`POST /messages`** langsung menyimpan pesan pengguna, lalu mengirim `thinking on` (dengan `runId`). Setelah itu datang
  satu atau beberapa event `message` dari asisten, lalu `thinking off` dengan `runId` yang sama. Aplikasi menyimpan
  himpunan `runId` aktif; berpikir = himpunan tidak kosong.
- **`clientId`** unik per (pengguna, clientId); mengirim ulang mengembalikan pesan asli.
- **`seq`** hanya naik dan tetap seumur pesan. **`rev`** adalah nomor perubahan per pengguna yang hanya naik: bertambah
  (nilai baru, lebih besar dari semua `rev` milik pengguna itu) saat pesan disimpan DAN setiap kali diperbarui, termasuk
  perubahan draf pada kartu di dalamnya. **Upsert:** event `message` dengan `id` yang sudah dikenal menggantikan
  versi sebelumnya (tempat dan `seq` tetap), dipakai untuk QRIS `lunas` / `kedaluwarsa`, keadaan perangkat, dan
  `chosenId` pada pilihan.
- **Kiriman ke orang lain** selalu berupa kartu `draft`:
  - `send` hanya dari `draft` atau `failed` ("Coba lagi") → `held`, dengan `heldUntil` = sekarang + 5 menit.
  - Setelah 5 menit `held` → `sent`, atau `failed` kalau pengiriman gagal.
  - `cancel` hanya dari `held` → `cancelled`; `discard` hanya dari `draft` → `cancelled`; `edit` hanya dari `draft`.
  - Setiap perubahan draf disiarkan lewat event `draft` ke semua koneksi (juga yang berasal dari aksi aplikasi).
- **Pesan dari WhatsApp** ikut tampil dengan `via: 'whatsapp'`: satu utas, keputusan bawaan #3 di roadmap.
- **WebSocket** mengirim `ping` tiap 25 detik. Setiap kali terbuka (juga yang pertama), klien mengambil pesan yang
  terlewat lewat `GET /messages?changedAfter=<rev terbesar yang dikenal>` (berulang selama `more`, dengan `rev` pesan
  terakhir) dan menggabungkannya berdasarkan `id`. Resync memakai `rev`, bukan `seq`, supaya QRIS yang lunas saat koneksi
  putus ikut terbawa.
  Penolakan jabat tangan (403 diblokir, 426 perlu pembaruan, 429) dilaporkan React Native sebagai tutup 1006, sama dengan
  jaringan putus. Setelah 3 kali gagal terbuka berturut-turut klien memanggil `GET /me` sekali: 401 → keluar, 403 / 426 →
  berhenti menyambung dan menampilkan penyebabnya; jawaban lain → jeda bertingkat berlanjut.
  Kalau koneksi putus atau macet saat menyambung (15 detik), klien menyambung ulang dengan jeda 1, 2, 4, 8, lalu paling
  lama 30 detik.
- **Pembacaan longgar:** bagian, kartu, atau enum yang tidak dikenal menjadi `{ type: 'unknown', note }`; hanya pesan
  tanpa `id` atau `seq` yang dibuang (`rev` yang hilang diganti `seq`).

**Navigasi masuk (mode server):** `app/_layout.tsx` memakai `Stack.Protected`; aturannya di `src/api/routeAccess.ts`
(`/mulai` dan `/mulai/masuk` hanya tanpa sesi, `/mode` selalu terbuka, selebihnya hanya dengan sesi). Layar yang menjadi
tertolak (keluar, sesi dicabut server) dibuang dari tumpukan berikut riwayatnya. Setelah masuk, `AfterSignIn` membuka
`/mulai/pilih`; "Lewati dulu" atau tombol utamanya memanggil `router.dismissAll()` lalu `router.replace('/')`, jadi
tumpukan tepat `[Beranda]`. Layar pembuka asli bertahan sampai huruf, mode tersimpan, dan pemeriksaan sesi selesai
(paling lama 6 detik).

---

## Tugas 1: Kontrak, transport, sesi, dan mode

**Status: selesai.** Commit: 724b200 (kontrak), 2d12a35 (FakeTransport), 684a9e8 (HttpTransport), d1ffafd (ApiProvider), 5036810 dan 4eaa5e5 (revisi kontrak, header versi, resync lewat rev), bdb7a30 (send dari draf failed).

**File:**
- `src/api/contract.ts`;
- `src/api/transport.ts` (antarmuka);
- `src/api/http.ts` (`HttpTransport`: fetch dengan batas waktu 15 detik, plus WebSocket);
- `src/api/fake/` (`FakeTransport` dan skenarionya);
- `src/api/session.ts` (secure-store);
- `src/api/mode.ts`;
- `src/api/ApiProvider.tsx`;
- `src/api/errors.ts` (memetakan error ke teks ramah).

**Perilaku:**
- **Mode:** `contoh` atau `server`.
  - URL server dibaca dari `app.json` `expo.extra.apiUrl`.
  - Bawaannya kosong. Kalau kosong, mode `server` tidak bisa dipilih.
- **`FakeTransport`:**
  - `auth/start`: nomor apa pun minimal 9 digit diterima.
  - `auth/verify`: kode apa pun 6 angka diterima, **kecuali** `000000`, yang dibalas `kode_salah` untuk menguji
    layar.
  - Riwayat contoh diambil dari utas 0b, dikonversi ke `Message`.
  - Balasan berjadwal: `thinking`, lalu 1,2 detik kemudian jawaban. Beberapa kata kunci memicu kartu:
    - "balas …" → draf;
    - "AC" → kartu perangkat;
    - "token" → kartu pembayaran.
  - Draf `held` berubah menjadi `sent` setelah 5 menit.
  - Bisa disuruh "putus" dari tes, untuk menguji penyambungan ulang.

**Tes:**
- Semua skema menerima contoh yang valid dan menolak yang tidak valid.
- `HttpTransport`:
  - membentuk URL dan header dengan benar (dites dengan fetch tiruan);
  - status 401 menghapus sesi;
  - batas waktu menghasilkan error ramah.
- `FakeTransport`: alur kirim pesan sampai `thinking` → `message` → `thinking off` (dengan timer palsu).
- Draf: `send` → `held` → `sent` setelah 5 menit; `cancel` dari `held`.
- Penyambungan ulang memakai jeda bertingkat, lalu mengambil pesan yang terlewat.

## Tugas 2: Masuk dan sesi

**Status: selesai.** Commit: c29ffd4 (useAuth, gerbang masuk), f64c9ee (penyimpanan aman), 748af3c (Stack.Protected, keluar lokal dulu).

**File:** `src/api/useAuth.ts`, `app/mulai/masuk.tsx`, `app/mulai/pilih.tsx`, `app/_layout.tsx`, `app/akun.tsx`.

**Perilaku:**
- **Layar 2o:**
  - "Masuk" memanggil `auth/start`; hitung mundurnya dari `resendInSec`.
  - Kode 6 angka memanggil `auth/verify`. Saat berhasil, token disimpan dan aplikasi pindah ke `/mulai/pilih`.
  - Kode salah menampilkan teks "Kodenya belum cocok. Coba cek lagi pesan WhatsApp-nya." di bawah kotak, lalu kotak
    dikosongkan.
  - Error jaringan memunculkan pesan ramah.
- **Saat aplikasi dibuka, dalam mode `server`:** kalau belum ada sesi, aplikasi membuka `/mulai`, dengan tumpukan
  bersih. Kalau ada sesi, aplikasi memanggil `GET /me`; nama pengguna dan asisten dipakai di Beranda dan chat,
  menggantikan `DEFAULT_ASSISTANT`.
- **Dalam mode `contoh`:** perilakunya tetap seperti 0b, tanpa paksaan masuk.
- **Akun:** baris baru "Keluar" (dengan konfirmasi lembar bawah) memanggil `auth/logout`, menghapus sesi, lalu
  membuka `/mulai`. Ada juga baris development "Mode data: Contoh / Server" di bagian Coba.

**Tes:**
- masuk sukses menyimpan token;
- kode salah;
- error jaringan;
- dalam mode server tanpa sesi, aplikasi diarahkan ke `/mulai`;
- logout menghapus sesi;
- nama asisten dari `Me` tampil di header chat.

## Tugas 3: Chat tersambung

**Status: selesai.** Commit: c74db93 (useChat), f78c4e6 (layar chat), bb537d9 (ContohBridge dan tes alur), cf3492e (kolom ketik mati saat akun tidak aktif).

**File:**
- `src/api/useChat.ts`, berisi state utas: pesan, `pending` (pesan optimistis), `thinking`, dan status koneksi;
- `app/chat.tsx`;
- `src/ui/chat/*` (pemetaan `Part` dan `Card` ke komponen yang sudah ada, ditambah `ChoicesCard` dan `ImageCard`);
- `src/ui/chat/ConnectionBanner.tsx`.

**Perilaku:**
- **Daftar pesan:**
  - Memakai FlatList terbalik (pesan terbaru di bawah).
  - Pesan lama dimuat saat menggulir ke atas (`before`), dengan indikator kecil.
  - Pesan dari WhatsApp diberi tanda kecil "lewat WhatsApp" di bawah gelembung.
- **Mengirim:**
  - Gelembung langsung tampil dengan `clientId` dan tanda "mengirim…". Tanda itu diganti oleh pesan yang tersimpan.
  - Kalau gagal, gelembung diberi tanda "Belum terkirim · Coba lagi".
- **Tombol pilihan** (`choices`) tampil sebagai tombol di bawah pesan. Mengetuk tombol mengirim `choiceId`, lalu
  tombolnya terkunci, menandai pilihan yang diambil.
- **Kartu draf** memakai `ConfirmSendCard` yang ada, tapi aksinya memanggil `POST /drafts/:id`. Event `draft`
  memperbarui kartu.
- **Kartu perangkat, notulen, pembayaran, dan QRIS** memakai komponen 0b, dengan data dari `Card`. Gambar QRIS diambil
  lewat `GET /media/:id` (`Image` dengan header token). Server tiruan memakai gambar QR dari `qrPattern`.
- **Tanda berpikir** mengikuti event `thinking`.
- **Banner koneksi** "Sinyal lemah, pesan Anda saya simpan dulu" tampil saat WebSocket putus lebih dari 3 detik, dan
  Inti di header berpindah ke keadaan `off`.
- **Pesan yang diketik saat offline** masuk antrean dan dikirim setelah koneksi kembali.

**Tes (dengan `FakeTransport`):**
- riwayat dan muat pesan lama;
- kirim pesan: optimistis lalu tersimpan;
- gagal kirim lalu coba lagi;
- tombol pilihan;
- draf kirim, `held`, lalu batal;
- `held` menjadi `sent` setelah 5 menit;
- banner koneksi dan antrean offline;
- tanda "lewat WhatsApp";
- semua kartu dari kontrak tampil.

## Tugas 4: Notifikasi

**Status: selesai (kode).** Commit: fd22c4a (expo-notifications, app.config.ts), 0c91e48 (izin, saluran, token ke server, ketukan). Perlu perangkat dan Firebase untuk diuji penuh.

**File:** `src/api/usePush.ts`, `app/_layout.tsx`, `app/izin-notifikasi.tsx` (lembar bawah ajakan), `app.json`.

**Perilaku:**
- **Ajakan izin:**
  - Setelah masuk pertama kali (atau dari Akun → Notifikasi), lembar bawah menjelaskan dengan bahasa biasa: "Biar
    pengingat dan kabar penting sampai, izinkan notifikasi ya."
  - Tombolnya "Izinkan" dan "Nanti saja".
  - Android 13+ meminta izin `POST_NOTIFICATIONS`.
- **Saluran Android** "Pesan dari Nadia" (penting) dan "Pengingat" (penting, bersuara).
- **Token push** dikirim ke `POST /push-tokens`. Dalam mode `contoh` tidak dikirim ke mana pun, cukup dicatat.
- **Mengetuk notifikasi** membuka `/chat`, juga saat aplikasi sedang tertutup.
- **Notifikasi tidak muncul** saat pengguna sedang membuka chat.
- **FCM butuh `google-services.json` dari Firebase** (persiapan founder di roadmap).
  - `app.json` merujuk filenya hanya kalau ada. Gunakan `app.config.ts` yang membaca keberadaan file.
  - Tanpa file itu, build tetap jalan dan notifikasi lokal tetap bisa dites.

**Tes:**
- ajakan izin: Izinkan / Nanti saja;
- token dikirim sekali per perubahan;
- ketukan notifikasi membuka chat (dengan mock `expo-notifications`);
- notifikasi diredam saat chat terbuka.

## Tugas 5: Rapikan, dokumentasi, dan serah-terima ke Fase 1b

**Status: selesai. Fase 1a lengkap.** Dokumen: `docs/api-v1.md`, ROADMAP, dan rencana ini (lihat commit "docs: kontrak API v1 untuk server Fase 1b, status Fase 1a"). Perbaikan hasil review: 840441f (chat: pengendali bersama, rev pada draf, kunci aksi kartu), lalu batch E2: b8e1968 (konfigurasi: google-services dan alamat server dari variabel lingkungan, `eas.json`) dan 7a1aebb (notifikasi: peredaman hanya pesan chat, nama saluran, token tiap mulai, ketukan dihapus, izin ditanya lagi, `DELETE /push-tokens`), serta commit dokumentasi daftar uji. Daftar uji perangkat: ROADMAP "Daftar uji di HP: Fase 1a".

**Yang dikerjakan:**
- `docs/api-v1.md`: kontrak dalam bahasa biasa untuk pembuat server, dengan contoh JSON dan aturan perilaku.
- ROADMAP: status Fase 1a, dan isi Fase 1b (server) yang merujuk ke `docs/api-v1.md`.
- Satu review akhir tanpa temuan Kritis.

**Selesai bila:**
- tsc, lint, dan jest hijau;
- dalam mode `contoh`, alur masuk lalu chat lalu kartu bisa dicoba di HP;
- tanpa server asli, semua yang butuh server sudah lewat kontrak.
