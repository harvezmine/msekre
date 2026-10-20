# Catatan untuk pembangun server Fase 1b

Dikumpulkan dari review kontrak API v1 pada 20 Okt 2026. Sebagian sudah dimasukkan ke kontrak di revisi berikutnya;
sisanya adalah aturan implementasi server. Kontrak lengkapnya ada di `src/api/contract.ts`, dan uraiannya di
`docs/api-v1.md` (Tugas 5 Fase 1a).

## Kontrak (dimasukkan ke revisi kontrak sebelum Tugas 3)

- **Waktu:** semua waktu memakai ISO 8601, termasuk `heldUntil` dan `until` pada QRIS. Aplikasi yang memformatnya
  sesuai zona waktu HP. Format `HH.MM` tanpa tanggal ambigu kalau melewati tengah malam, dan salah untuk pengguna WITA
  atau WIT.
- **Draf:**
  - ada status `failed` untuk kiriman yang gagal setelah masa tahan;
  - aksi `discard` membuang draf yang belum dikirim;
  - `cancel` dari status `held` berakhir di `cancelled`.
- **Pembaruan kartu:** event `message` dengan `id` yang sudah dikenal menggantikan versi sebelumnya (upsert). Ini
  dipakai untuk QRIS lunas atau kedaluwarsa, keadaan perangkat, dan pilihan yang sudah diambil. QRIS punya status
  `menunggu | lunas | kedaluwarsa`.
- **Pilihan:**
  - aplikasi mengirim `{ clientId, messageId, choiceId }`;
  - server mengambil judulnya dari pilihan yang tersimpan, tidak percaya judul dari klien;
  - bagian `choices` membawa `chosenId` setelah dipilih.
- **Urutan dan resync:**
  - setiap pesan punya `seq`, nomor urut yang hanya naik (bigserial);
  - riwayat memakai `?before=<seq>`, dan resync memakai `?after=<seq>`;
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
  - setiap perubahan draf disiarkan ke semua koneksi pengguna; klien membuang duplikatnya.
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
