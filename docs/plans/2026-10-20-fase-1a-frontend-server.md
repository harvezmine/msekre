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

## Kontrak API (versi 1)

Semua jalur diawali `/app/v1`. Header `Authorization: Bearer <token>` wajib, kecuali untuk `auth/*`. Isi request dan
response berupa JSON.

| Jalur | Request | Response |
|---|---|---|
| `POST /auth/start` | `{ phone: string }` (format E.164 tanpa +, contoh `6281220457781`) | `{ resendInSec: number }`. Kode dikirim lewat WhatsApp |
| `POST /auth/verify` | `{ phone, code: string(6) }` | `{ token, user: Me }`. Kode salah → 400 `{ error: 'kode_salah' }` |
| `POST /auth/logout` | — | `{ ok: true }` |
| `GET /me` | — | `Me` |
| `GET /messages?before=<id>&limit=30` | — | `{ items: Message[], before: string \| null }`, berurutan dari yang terbaru |
| `POST /messages` | `{ clientId, text }` atau `{ clientId, choiceId, choiceTitle }` | `{ message: Message }`. Ini pesan pengguna yang tersimpan; balasan datang lewat stream |
| `POST /drafts/:id` | `{ action: 'send' \| 'cancel' \| 'edit', text? }` | `{ draft: Draft }` |
| `POST /devices` | `{ pushToken, platform: 'android' \| 'ios' }` | `{ ok: true }` |
| `GET /media/:id` | — | berkas (gambar QRIS, dokumen), dengan token |
| `WS /stream?token=…` | — | event `StreamEvent` dalam bentuk JSON per pesan |

**Tipe:**

```
Me       = { id, name: string|null, assistantName: string, plan: { name: string, activeUntil: string|null } }
Message  = { id: string, clientId?: string, at: ISO8601, from: 'user'|'assistant', via: 'app'|'whatsapp',
             parts: Part[] }
Part     = { type: 'text', text }
         | { type: 'choices', prompt?: string, choices: { id, title, description? }[] }
         | { type: 'image', mediaId, mime, caption?, alt? }
         | { type: 'document', mediaId, name, mime, sizeBytes }
         | { type: 'audio', mediaId, mime, transcript? }
         | { type: 'card', card: Card }
Card     = { kind: 'draft', draft: Draft }
         | { kind: 'device', deviceId, name, on: boolean, temp?: number, mode?: string, note?: string }
         | { kind: 'notes', title, when, decisions: string[], meetingId }
         | { kind: 'payment', title, amountRp: number, lines: { label, value }[], ask: string }
         | { kind: 'qris', amountRp, until: 'HH.MM', mediaId }
Draft    = { id, to, channel: 'whatsapp'|'email', what: 'balasan'|'pesanan'|'email'|'undangan',
             text, status: 'draft'|'held'|'sent'|'cancelled', heldUntil?: 'HH.MM' }
StreamEvent = { type: 'message', message: Message }
            | { type: 'draft', draft: Draft }
            | { type: 'thinking', on: boolean }
            | { type: 'ping' }
```

**Aturan perilaku server, yang ditiru juga oleh server tiruan:**
- **`POST /messages`** langsung menyimpan pesan pengguna, lalu mengirim event `thinking on`. Setelah itu datang satu
  atau beberapa event `message` dari asisten, lalu `thinking off`.
- **Kiriman ke orang lain** selalu berupa kartu `draft`:
  - `send` mengubah status menjadi `held`, dengan `heldUntil` = sekarang + 5 menit.
  - Setelah 5 menit status menjadi `sent`, dan perubahannya dikirim lewat event `draft`.
  - `cancel` hanya bisa dari status `held`.
- **Pesan dari WhatsApp** ikut tampil dengan `via: 'whatsapp'`: satu utas, keputusan bawaan #3 di roadmap.
- **WebSocket** mengirim `ping` tiap 25 detik. Kalau koneksi putus, klien menyambung ulang dengan jeda bertingkat
  (1, 2, 4, 8, lalu paling lama 30 detik), kemudian mengambil pesan yang terlewat lewat `GET /messages`.

---

## Tugas 1: Kontrak, transport, sesi, dan mode

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

**File:** `src/api/usePush.ts`, `app/_layout.tsx`, `app/izin-notifikasi.tsx` (lembar bawah ajakan), `app.json`.

**Perilaku:**
- **Ajakan izin:**
  - Setelah masuk pertama kali (atau dari Akun → Notifikasi), lembar bawah menjelaskan dengan bahasa biasa: "Biar
    pengingat dan kabar penting sampai, izinkan notifikasi ya."
  - Tombolnya "Izinkan" dan "Nanti saja".
  - Android 13+ meminta izin `POST_NOTIFICATIONS`.
- **Saluran Android** "Pesan dari Nadia" (penting) dan "Pengingat" (penting, bersuara).
- **Token push** dikirim ke `POST /devices`. Dalam mode `contoh` tidak dikirim ke mana pun, cukup dicatat.
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

**Yang dikerjakan:**
- `docs/api-v1.md`: kontrak dalam bahasa biasa untuk pembuat server, dengan contoh JSON dan aturan perilaku.
- ROADMAP: status Fase 1a, dan isi Fase 1b (server) yang merujuk ke `docs/api-v1.md`.
- Satu review akhir tanpa temuan Kritis.

**Selesai bila:**
- tsc, lint, dan jest hijau;
- dalam mode `contoh`, alur masuk lalu chat lalu kartu bisa dicoba di HP;
- tanpa server asli, semua yang butuh server sudah lewat kontrak.
