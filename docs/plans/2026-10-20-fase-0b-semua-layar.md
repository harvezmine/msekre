# Fase 0b: Semua layar dengan data contoh

> **Untuk agen yang mengerjakan:** pakai superpowers:subagent-driven-development. Kerjakan tugas demi tugas, berurutan.
> Langkah memakai kotak centang (`- [ ]`).

**Tujuan:** semua layar di desain Claude Design bisa dibuka dan dicoba di HP, lengkap dengan mode gelap. Isinya data
contoh, belum tersambung ke server. Empat alur prototipe juga bisa diklik dari awal sampai akhir.

**Kenapa sebelum Fase 1:** founder memilih "semua layar dulu" (20 Okt 2026), supaya desain bisa dicoba dan dikoreksi
di HP sebelum server disambungkan. Fase 1–5 di roadmap kemudian tinggal menyambungkan layar-layar ini ke data asli.

**Arsitektur:**
- Semua data contoh dan keadaan bersama (AC nyala/mati, kiriman tertahan, layanan tersambung, agenda yang ditambah)
  disimpan di satu **penyimpanan contoh**, `src/sample/store.tsx`.
  - Isinya reducer murni yang dites, dan provider di `app/_layout.tsx`.
  - Dengan ini, aksi di satu layar terlihat di layar lain. Contoh: AC dimatikan lewat suara, lalu tampil mati di
    Beranda.
- Lembar bawah memakai rute Stack `presentation: 'transparentModal'` ditambah komponen `Sheet` sendiri (geser naik
  280 ms dan latar gelap), supaya persis seperti desain dan brief.
- Komponen bersama dibuat sekali di Tugas 1, lalu dipakai semua layar.

**Teknologi:** sama dengan Fase 0. Ditambah react-native-gesture-handler 3.3 (sudah terpasang) untuk slider alarm dan
putaran suhu.

**Spesifikasi tampilan:** file desain HTML adalah spesifikasinya. Setiap opsi berisi ukuran, warna, jarak, dan teks
lengkap dalam gaya inline. Tugas di bawah menunjuk baris-barisnya, dan pelaksana menyalin ke React Native dengan
token yang sudah ada.
- Rencana ini sengaja tidak menyalin ulang kode layar, karena kodenya sudah ada di desain.
- Perilaku, rute, dan tes ditulis lengkap di sini.

**Aturan dari Fase 0 tetap berlaku.**
- Teknis:
  - Setiap perintah dijalankan setelah `source dev-env.sh`.
  - Tes memakai RNTL 14 yang asinkron.
  - Reanimated memakai `get()`/`set()`.
  - Tab memakai `expo-router/js-tabs`.
  - Cek API di versi terpasang.
- Sebelum commit: tsc, lint, dan jest harus hijau.
- Commit kecil, pesan berbahasa Indonesia, tanpa Co-Authored-By.
- Teks di layar:
  - bahasa sehari-hari, tanpa istilah teknis dan tanpa emoji;
  - layar kosong tidak boleh berjudul "Kosong";
  - pesan gagal ditulis "Lagi ada kendala, sudah dilaporkan ke tim. Coba lagi sebentar ya."

Lokasi desain:
- `D1` = `design/handoff/sekretaris-ai-mobile-app-design/project/Sekretaris AI.dc.html`
- `D2` = `design/handoff/sekretaris-ai-mobile-app-design/project/Sekretaris AI Layar.dc.html`
- `DP` = `design/handoff/sekretaris-ai-mobile-app-design/project/Sekretaris AI Prototipe.dc.html` (alur prototipe)
- `SK` = `design/handoff/sekretaris-ai-mobile-app-design/project/sk-shared.js` (ikon, Inti, cincin, QR, keyframe)

---

## Peta rute

| Desain | Rute | File | Tampil sebagai |
|---|---|---|---|
| 1b, 1c, 1d | `/chat` | `app/chat.tsx` | layar. Berisi utas contoh; `/chat?kosong=1` = keadaan kosong |
| 2a + Minggu ini + Kalender | tab Agenda | `app/(tabs)/agenda.tsx` | tab |
| 2b | `/agenda/tambah` | `app/agenda/tambah.tsx` | lembar bawah |
| 2l | `/alarm` | `app/alarm.tsx` | layar penuh (`fullScreenModal`) |
| 2c | tab Perangkat | `app/(tabs)/perangkat.tsx` | tab |
| 2d | `/perangkat/[id]` | `app/perangkat/[id].tsx` | layar |
| 2e | `/pin` | `app/pin.tsx` | lembar bawah. Parameter: `untuk` (nama perangkat), `aksi` |
| 2f | `/perangkat/tambah` | `app/perangkat/tambah.tsx` | layar |
| 2g | tab Usaha | `app/(tabs)/usaha.tsx` | tab |
| 2h | `/terhubung` | `app/terhubung/index.tsx` | layar |
| 2i | `/terhubung/[id]` | `app/terhubung/[id].tsx` | layar |
| 2j | `/terhubung/masuk` | `app/terhubung/masuk.tsx` | lembar bawah. Parameter: `id` |
| 2k | `/terhubung/tersambung` | `app/terhubung/tersambung.tsx` | layar |
| 2m | `/riwayat` | `app/riwayat.tsx` | layar |
| 2q | `/akun` | `app/akun.tsx` | layar |
| 2n, 2o, 2p | `/mulai`, `/mulai/masuk`, `/mulai/pilih` | `app/mulai/*.tsx` | layar tanpa tab |
| pemilih tempat | `/tempat` | `app/tempat.tsx` | lembar bawah: Semua · Rumah · Kedai Dago · Kedai Riau |

Semua rute baru didaftarkan di `app/_layout.tsx` dengan `presentation` yang sesuai.

## Alur prototipe yang harus bisa diklik

1. **Bicara mematikan AC:**
   - Di Beranda, tahan Inti.
   - Mode Suara memutar contoh. Saat masuk keadaan "berbicara", penyimpanan contoh mencatat `acOn = false`.
   - Kembali ke Beranda: kartu Rumah menulis "AC kamar mati", dan Riwayat mencatat "Mematikan AC kamar · lewat suara".
2. **Setujui lalu batalkan kiriman:**
   - Di Beranda, ketuk "Lihat" di kartu persetujuan, lalu di chat ketuk Kirim di kartu konfirmasi.
   - Kartu berubah menjadi "Dikirim 10.47 · Batalkan".
   - Riwayat menampilkan "Mengirim balasan ke Pak Budi" dengan tombol Batalkan.
   - Setelah Batalkan, muncul toast "Kiriman ke Pak Budi dibatalkan.", dan entri Riwayat tercoret.
   - Kartu persetujuan di Beranda hilang setelah Kirim.
3. **Alarm:**
   - Buka `/alarm` lewat Akun → Coba (development) atau dengan menahan item "Jemput Kayla les" di Agenda.
   - Ketuk "Tunda 10 menit", lalu aplikasi kembali ke Agenda.
   - Item pengingatnya kini tertulis "Ditunda sampai 07.10".
4. **Sambungkan layanan baru:**
   - Di Beranda, ketuk tulisan di bawah cincin untuk membuka Terhubung.
   - Ketuk Sambungkan di TikTok Shop, lalu "Masuk (contoh)" di halaman masuk.
   - Layar tersambung memutar animasi simpul masuk cincin. Selesai membawa kembali ke Beranda.
   - Cincin Beranda kini punya 8 simpul, dengan tulisan "8 terhubung · CCTV tidak terjangkau".

---

## Tugas 1: Penyimpanan contoh dan komponen bersama

**File:**
- `src/sample/store.tsx`, ditambah data contoh di `src/sample/*.ts`. `home.ts` yang lama dipindah ke sini.
- `src/ui/Sheet.tsx`, `src/ui/Toast.tsx`, `src/ui/Segmented.tsx`, `src/ui/FilterChips.tsx`, `src/ui/ListRow.tsx`,
  `src/ui/PlaceButton.tsx`.
- `app/tempat.tsx`.

**Penyimpanan contoh:**
- `SampleProvider` dan `useSample()` mengembalikan `{ state, dispatch }`. Reducer murni `sampleReducer` diekspor untuk
  tes.
- Isi `state`:
  - `place`
  - `acOn`, `acTemp`, `acMode`, `acFan`
  - `devices`: perangkat per tempat dan ruangan, dari 2c
  - `approvalPending`
  - `outgoing`: kiriman ke Pak Budi, dengan status `draft | held | cancelled`
  - `agenda`: item dari 2a ditambah yang dibuat di Tambah. Tiap item punya `id`, `time`, `title`, `kind`, `note`,
    `snoozedUntil`
  - `connected`: layanan tersambung dari 2h, plus TikTok Shop setelah alur 4
  - `history`: entri Riwayat, berurutan waktu
  - `toast`
  - `onboarded`
- Aksi (diketik dengan TypeScript):
  - `setPlace`, `setAc`, `toggleDevice`
  - `sendDraft`, `cancelSend`
  - `addAgenda`, `snooze`
  - `connect`, `disconnect`, `forget`
  - `showToast`, `hideToast`
  - `finishOnboarding`
- Setiap aksi yang mengubah dunia luar menambah entri `history` dengan teks seperti di 2m.
- Penyimpanan ini hanya di memori. Aplikasi yang ditutup kembali ke keadaan contoh awal, dan itu disengaja.

**Komponen bersama:**
- **`Sheet`:**
  - latar `rgba(13,43,34,.45)` yang memudar;
  - panel `card` dengan sudut atas 28 dan pegangan 36×4 `#D5DBD2` (seperti 2b, 2e, 2j);
  - naik dari bawah dalam 280 ms (keyframe `sk-sheet` di SK);
  - menutup dengan ketuk latar, tombol kembali Android, atau geser ke bawah;
  - mengikuti setelan kurangi gerakan.
- **`Toast`:** bilah gelap di bawah, 16 dp di atas tab bar. Muncul memudar sambil naik 8 dp (`sk-toast`), lalu hilang
  sendiri setelah 2,6 detik. Dibaca pembaca layar (`accessibilityLiveRegion="polite"`).
- **`Segmented`:** segmen tiga pilihan seperti Hari ini / Minggu ini / Kalender di 2a, dengan peran tab.
- **`FilterChips`:** chip filter seperti di 2m, digulir mendatar, dengan peran tombol dan keadaan terpilih.
- **`ListRow`:** baris kartu daftar (ikon 40, judul, keterangan, chevron) seperti di 2h dan 2q.
- **`PlaceButton`:** tombol tempat di kiri atas (Beranda, Perangkat, Usaha) yang membuka `/tempat`.
- **`/tempat`:** daftar Semua · Rumah · Kedai Dago · Kedai Riau. Tempat terpilih diberi centang. Memilih menutup
  lembar dan mengubah `state.place`.

**Tes:**
- Reducer: setiap aksi, termasuk entri `history` yang benar dan `cancelSend` hanya dari status `held`.
- `Sheet`:
  - menutup saat latar diketuk;
  - memanggil `onClose`.
- `Toast` hilang setelah 2,6 detik (timer palsu).
- `Segmented` dan `FilterChips` memanggil `onChange`.
- `/tempat` mengubah tempat.
- Beranda membaca data dari penyimpanan, bukan dari `home.ts` lama.

**Selesai bila:** semua tes hijau, dan Beranda tampil persis seperti sebelumnya.

## Tugas 2: Chat dengan kartu (1b, 1c)

**Desain:** D1 baris 101–215.

**File:** `app/chat.tsx`, `src/ui/chat/*` (Bubble, ConfirmSendCard, DeviceCard, NotesCard, FileCard, TokenCard,
QrisCard, Thinking), dan `src/sample/chat.ts`.

**Perilaku:**
- Tanpa `?kosong=1`, chat menampilkan utas contoh berurutan:
  - 1b: AC 24°, lalu "Balas Pak Budi…" dengan kartu konfirmasi, lalu "Cek stok kedai" dengan tanda berpikir.
  - 1c: notulen, file, token listrik, lalu QRIS.
- Utas mulai dari bawah dan bisa digulir.
- Header dan kolom ketik sama dengan Fase 0.
- **`DeviceCard`:**
  - memakai `state.acOn`/`acTemp` dan sakelar yang sama dengan Beranda;
  - tombol −/+ mengubah suhu (16–30) di penyimpanan contoh;
  - teks "Perintah terakhir: … · suhu ruangan sekarang 27°".
- **`ConfirmSendCard`:**
  - Ubah membuka kolom teks di kartu yang bisa diedit, dengan tombol Simpan.
  - Kirim menjalankan `sendDraft`, lalu kartu menampilkan "Dikirim 10.47 · Batalkan".
  - Batalkan menjalankan `cancelSend` dan menampilkan "Dibatalkan · tidak jadi terkirim".
  - Getar ringan saat Kirim (brief: getar saat konfirmasi terkirim).
- **`QrisCard`:** pola QR contoh dari `qr()` di SK (deterministik, 25×25). Berlaku sampai 10.15.
- **Kolom ketik:** mengetik lalu menekan kirim (tombol mic berubah jadi ikon `send` saat ada teks) menambah gelembung
  pengguna, lalu tanda berpikir. Setelah 1,2 detik muncul jawaban contoh: "Ini masih contoh. Mulai Fase 1 saya
  menjawab sungguhan."
- **Saran di keadaan kosong:** mengetuk saran mengisi kolom ketik dengan teks saran itu.
- **Keyboard:** tidak menutupi kolom ketik (KeyboardAvoidingView atau padding keyboard yang benar dengan
  edge-to-edge).

**Tes:**
- utas contoh menampilkan semua kartu;
- Kirim mengubah status kartu dan mencatat Riwayat;
- Batalkan;
- −/+ suhu dibatasi 16–30;
- mengetik lalu kirim menampilkan gelembung dan jawaban setelah 1,2 detik;
- `?kosong=1` menampilkan keadaan kosong (tes Fase 0 tetap lulus).

## Tugas 3: Agenda, Tambah, dan Alarm (2a, 2b, 2l)

**Desain:** D2 baris 17–83 dan 406–423.

**File:**
- `app/(tabs)/agenda.tsx` dan `app/agenda/tambah.tsx`;
- `app/alarm.tsx`;
- `src/ui/agenda/*` (AgendaItem, NowLine, WeekList, MonthGrid);
- `src/ui/SwipeToConfirm.tsx`;
- `src/sample/agenda.ts`.

**Agenda, segmen Hari ini (2a):**
- Judul "Senin, 20 Okt", ditambah "N lagi hari ini".
- Kartu "Kemarin belum selesai" dengan dua pilihan:
  - "Kerjakan hari ini" memindahkan tugas ke hari ini;
  - "Lepaskan" menghapusnya.
  - Setelah dipilih, kartu hilang.
- Daftar item dengan ikon per jenis:
  - pengingat (`bell`): "Telepon saya" atau "Bunyi sebagai alarm";
  - tugas (`task`, `taskDone` kalau selesai; ketuk untuk menandai);
  - rapat (`camera`): "Notulen siap" membuka chat;
  - berulang (`repeat`).
- Item yang sudah lewat tampil redup. Garis "sekarang" di jam contoh 09.41.
- Tombol Tambah mengambang di kanan bawah.

**Segmen Minggu ini** (tidak ada di desain; buat dengan komponen yang sama): daftar per hari, Senin–Minggu, memakai
data contoh `agenda.ts` untuk 7 hari. Judul hari dengan gaya subjudul, item dengan `AgendaItem`.

**Segmen Kalender** (tidak ada di desain):
- Kisi bulan Oktober 2026, mulai Senin, dengan nama hari dua huruf.
- Tanggal yang punya agenda diberi titik hijau. Hari ini ditandai lingkaran mint.
- Mengetuk tanggal menampilkan daftar item hari itu di bawah kisi.

**Lembar Tambah (2b):**
- Kolom teks bahasa biasa.
- Pratinjau "Akan saya simpan sebagai" yang dibaca dari teks oleh **pengurai contoh sederhana** di
  `src/sample/parse.ts`:
  - mengenali "ingatkan" (jenis pengingat), "tanggal N" (tanggal Oktober), "jam N" atau "jam N.MM";
  - bawaan jam 09.00, ditambah keterangan "Jamnya saya tebak. Ketuk untuk mengubah.";
  - judul diambil dari sisa kalimat dengan huruf depan besar.
- Simpan menjalankan `addAgenda`, menutup lembar, dan item tampil di Agenda.
- Tombol mic di kolom membuka Mode Suara.

**Alarm (2l):**
- Layar penuh forest dengan Inti 96, jam 96 pt, judul, dan catatan penerbangan.
- Tombol "Tunda 10 menit" menjalankan `snooze`, lalu kembali ke Agenda.
- Tombol "Tanya Nadia" membuka chat.
- **SwipeToConfirm** "Geser untuk mematikan":
  - jempol 60 bisa digeser (gesture handler);
  - lepas di atas 80% lebar mematikan alarm dan kembali; di bawah itu jempol kembali ke awal;
  - untuk pembaca layar, punya aksi "Matikan".
- Getar berpola (`Haptics.notificationAsync`) setiap 2 detik selama layar alarm terbuka, berhenti saat keluar
  (brief: getar saat alarm).

**Tes:**
- urutan item dan ikon per jenis;
- Kerjakan hari ini / Lepaskan;
- pindah segmen ke Minggu ini dan Kalender;
- mengetuk tanggal menampilkan itemnya;
- pengurai contoh dengan 5 kalimat (termasuk "Ingatkan saya bayar pajak motor tanggal 25" → Sabtu, 25 Okt, 09.00,
  ditebak);
- Simpan menambah item;
- Tunda menampilkan "Ditunda sampai 07.10" di Agenda;
- aksi pembaca layar "Matikan";
- getar berhenti saat layar ditutup (jumlah timer 0).

## Tugas 4: Perangkat, detail AC, PIN, Tambah perangkat (2c, 2d, 2e, 2f)

**Desain:** D2 baris 88–257. Lihat juga `dial()` di bagian skrip D2 (baris sekitar 566–575).

**File:**
- `app/(tabs)/perangkat.tsx`, `app/perangkat/[id].tsx`, `app/pin.tsx`, `app/perangkat/tambah.tsx`;
- `src/ui/device/*` (DeviceTile, BoxCard, RoomTabs, RoutineRow, Dial, PinPad);
- `src/sample/devices.ts`.

**Perangkat (2c):**
- Tombol tempat, tombol tambah (ke `/perangkat/tambah`), dan avatar.
- Tab ruangan Ruang tamu · Kamar · Dapur · Teras dengan garis bawah hijau.
- Kartu Kotak Sekretaris AI (hanya di Ruang tamu):
  - "Mic menyala" dengan tombol Matikan / Nyalakan yang berganti;
  - speaker, suhu ruangan, dan kelembapan.
- Ubin 2 kolom:
  - sakelar mengubah perangkat;
  - ubin yang tidak terjangkau berwarna abu dengan titik clay, tanpa sakelar;
  - mengetuk ubin AC membuka detail.
- Rutinitas: ketuk "Jalankan" menerapkan perubahannya ke perangkat contoh, mencatat Riwayat, dan memunculkan toast.
- **PIN:** mematikan **kamera** membuka `/pin`. PIN contoh adalah 123456. PIN benar mematikan kamera; PIN salah
  menggetarkan titik dan menulis "PIN belum cocok, coba lagi.".
- Data per tempat: Rumah memakai data 2c. Kedai Dago dan Kedai Riau punya 3–4 perangkat contoh (lampu, AC, CCTV
  kasir). Tempat "Semua" menampilkan judul tempat sebagai pemisah.

**Detail AC (2d):**
- **Putaran suhu** (SVG busur 270°, 16–30):
  - jempolnya bisa digeser dengan pan gesture;
  - tombol −/+ di bawahnya;
  - angka besar 64 pt;
  - untuk pembaca layar, peran `adjustable` dengan aksi naik/turun.
- Kartu info inframerah. Teks ini hanya untuk perangkat dengan `via: 'ir'`.
- Mode 4 pilihan, kecepatan kipas 4 pilihan, jadwal ("Mati sendiri jam 05.00", ditambah tombol Tambah jadwal yang
  memunculkan toast "Jadwal baru dibuat di Fase 3").
- Tombol utama "Matikan AC" / "Nyalakan AC" sesuai keadaan.
- Semua memakai keadaan AC yang sama dengan Beranda dan chat.

**Tambah perangkat (2f):** kartu Kotak (tombol "Pasang Kotak" memunculkan toast "Pemasangan lewat Bluetooth dibangun
bersama kotaknya") dan daftar 9 merek dari `brands` di bagian skrip D2.

**Tes:**
- pindah ruangan;
- sakelar mengubah keadaan dan Beranda ikut;
- rutinitas;
- PIN benar dan salah;
- putaran suhu: aksi naik/turun dan batas 16–30;
- mode dan kipas;
- Kedai Dago menampilkan perangkat kedai.

## Tugas 5: Usaha (2g)

**Desain:** D2 baris 259–322. Lihat juga `spark()` di bagian skrip D2.

**File:** `app/(tabs)/usaha.tsx`, `src/ui/business/*` (SalesCard, Sparkline, MoneyInCard, StockCard, OrdersRow,
ReportCard), dan `src/sample/business.ts`.

**Perilaku:**
- **Tempat:** Semua cabang / Kedai Dago / Kedai Riau. Angka penjualan dan grafik berganti sesuai tempat. Untuk
  "Rumah" tampil keterangan "Pilih tempat usaha untuk melihat penjualan." dengan tombol pilih tempat.
- **Sparkline** 7 hari dengan titik hari ini. Hari ini memakai warna hijau.
- **Stok menipis:**
  - "Pesan lagi" membuka chat dengan kartu konfirmasi draf pesanan ke supplier ("PT Sumber Susu");
  - tidak ada yang terkirim sebelum Kirim.
- **Pesanan TikTok Shop** membuka toast "Daftar pesanan dibangun di Fase 4".
- **Laporan:** tombol Buka memunculkan toast "File contoh".

**Tes:**
- angka per tempat;
- keadaan untuk tempat Rumah;
- "Pesan lagi" menambah kartu konfirmasi di chat;
- grafik menggambar 7 titik.

## Tugas 6: Terhubung, detail, masuk, tersambung (2h, 2i, 2j, 2k)

**Desain:** D2 baris 324–404, ditambah `connected`/`groups` di bagian skrip D2, dan `sk-join` di SK.

**File:** `app/terhubung/index.tsx`, `app/terhubung/[id].tsx`, `app/terhubung/masuk.tsx`,
`app/terhubung/tersambung.tsx`, dan `src/sample/services.ts`.

**Perilaku:**
- **Daftar Terhubung (2h):**
  - layanan yang tersambung beserta statusnya; yang tidak terjangkau berwarna clay;
  - kelompok Kerja dan Usaha dengan tombol Sambungkan, Rumah (ringkasan merek), dan Lainnya.
- **Detail layanan (2i):**
  - isi "Yang bisa Nadia lakukan" per layanan;
  - izin radio "Hanya membaca" / "Boleh bertindak";
  - "Hapus semua yang Nadia tahu…" meminta konfirmasi di lembar bawah, lalu menjalankan `forget` dan memunculkan
    toast;
  - "Putuskan" meminta konfirmasi, lalu menjalankan `disconnect`; simpulnya hilang dari cincin Beranda.
- **Masuk (2j):**
  - lembar berisi info "halaman resmi", Inti kecil, dan kotak tempat halaman layanan;
  - tombol "Masuk (contoh)" menjalankan `connect`, lalu pindah ke tersambung.
- **Tersambung (2k):**
  - `Orbit` dengan simpul baru yang **masuk cincin**: animasi `sk-join` 900 ms, `cubic-bezier(.2,.8,.2,1)`, dari
    jarak 70 dp ke arah luar dengan skala .4, dan garisnya muncul memudar;
  - izin "Hanya membaca" dengan tombol Ubah;
  - Selesai kembali ke Beranda.
- **Beranda:** cincin dan tulisannya memakai `state.connected`. Mengetuk tulisan di bawah cincin membuka `/terhubung`,
  dan cincinnya bisa diketuk (`onPressRing`).

**Tes:**
- alur 4 dari awal sampai Beranda menampilkan 8 simpul;
- putuskan mengurangi simpul;
- hapus data memunculkan toast;
- izin bisa diganti;
- simpul baru memakai animasi masuk (props `join`), kecuali saat gerak dikurangi.

## Tugas 7: Riwayat, Akun, layar pertama kali (2m, 2q, 2n–2p)

**Desain:** D2 baris 425–522, ditambah `akun` di bagian skrip D2.

**File:** `app/riwayat.tsx`, `app/akun.tsx`, dan `app/mulai/index.tsx`, `masuk.tsx`, `pilih.tsx`.

**Riwayat (2m):**
- Linimasa dikelompokkan per hari (Hari ini, Kemarin), dengan garis penghubung.
- Filter Semua · Pesan · Rumah · Usaha · Pembelian.
- Batalkan tampil hanya untuk kiriman berstatus `held`, ditambah keterangan "sampai 10.47". Setelah dibatalkan,
  entrinya tercoret dan muncul toast.

**Akun (2q):**
- Profil, kartu langganan, dan bagian-bagian dari `akun`.
- Riwayat membuka `/riwayat`, Terhubung membuka `/terhubung`.
- Baris lain memunculkan toast yang menyebut fase pembangunannya.
- Wordmark dan versi di bawah.
- **Hanya development**, bagian "Coba" berisi: Layar pertama kali, Alarm, Pemeriksa Inti.
- Beranda: avatar "RW" membuka `/akun`. Tahan avatar tetap membuka `/inti`.

**Layar pertama kali (2n–2p):**
- **2n:** Mulai.
- **2o:**
  - nomor WhatsApp dengan awalan +62;
  - 6 kotak kode yang otomatis pindah fokus;
  - hitungan mundur "Kirim ulang kode dalam 00.42";
  - kode contoh apa pun berisi 6 angka diterima.
- **2p:**
  - pilihan bisa lebih dari satu;
  - tombol utama menyesuaikan pilihan pertama, misalnya "Sambungkan Google Kalender";
  - "Lewati dulu" langsung ke Beranda.
- Selesai menjalankan `finishOnboarding` dan membuka Beranda (`router.replace`).
- Penanda titik 3 langkah mengikuti halaman.

**Tes:**
- filter Riwayat;
- Batalkan hanya pada kiriman yang tertahan;
- semua navigasi dari Akun;
- kode 6 angka, hitung mundur dengan timer palsu;
- pilihan ganda dan teks tombol;
- Lewati dulu.

## Tugas 8: Rangkai alur dan periksa menyeluruh

**Yang dikerjakan:**
- Tes integrasi untuk 4 alur prototipe di `__tests__/alur.test.tsx`. Render beberapa layar dengan `SampleProvider`
  yang sama dan jalankan langkahnya.
- Periksa semua layar dalam mode gelap: tes `ThemeProvider scheme="dark"` untuk setiap layar baru, dengan minimal satu
  warna dari palet gelap.
- Periksa lebar 360 dp: tes merender setiap layar dengan `useWindowDimensions` di-mock ke 360×740 tanpa crash. Cincin
  dan putaran suhu harus menyesuaikan ukuran.
- Perbarui `docs/ROADMAP.md`, yaitu status Fase 0b dan isi Fase 1–5 yang kini berarti "sambungkan ke server".

**Selesai bila:**
- tsc, lint, dan jest hijau;
- `npx expo export --platform android` berhasil;
- satu review akhir tanpa temuan Kritis.

---

## Cara kerja

- **Satu subagen pelaksana per tugas, berurutan.**
- **Review setelah setiap tugas:**
  - kesesuaian dengan rencana ini dicek pengendali;
  - review kualitas kode dijalankan per dua tugas, karena kuota API terbatas;
  - temuan Penting diperbaiki sebelum lanjut.
- **Uji di HP:** setelah HP tersambung dan ruang disk cukup, pasang dan coba di HP (Tugas 14 Fase 0, ditambah semua
  layar ini).
