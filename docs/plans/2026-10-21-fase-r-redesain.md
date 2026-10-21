# Fase R: Desain ulang setelah uji APK pertama

Founder mencoba APK pratinjau pertama (build 2, 21 Okt 2026) dan menilai tampilannya masih sangat kurang. Fase ini
mengubah tampilan dan rasa pakai aplikasi. Kontrak API dan server tiruan tetap dipakai dan hanya diperluas bila perlu,
misalnya untuk remote perangkat.

> **Untuk agen yang mengerjakan:** pakai superpowers:subagent-driven-development, tugas demi tugas, berurutan.
> Aturan dari fase sebelumnya tetap berlaku:
> - commit tanpa baris atribusi Claude;
> - tes penuh hijau sebelum setiap commit;
> - tanpa build Android lokal.

## Masukan founder

1. **Beranda:** S besar (Inti) dibuat lebih halus.
   - **Ketuk membuka chat. Tahan membuka Mode Suara** dan langsung mendengar; lepas untuk mengirim.
   - Mode Suara memakai **gelombang gradasi yang mengalir dan memudar halus seperti Gemini**.
2. **Pengaturan terlalu rumit.** Menunya dibuat lebih sedikit dan mudah dipahami.
3. **Rumah pintar:** setiap perangkat punya halaman sendiri seperti **remote virtual**.
   - AC: suhu, mode, kipas, swing.
   - TV: D-pad, volume, channel.
   - Speaker: putar dan volume.
   - Lampu: terang-redup dan warna.
4. **Desain monoton.** Isinya kebanyakan kotak berisi menu.
5. **Warna terlalu hijau semua.**
6. **Belum responsif.** Di HP panjang, Inti di Mode Suara terlalu tinggi dan sulit dijangkau jempol.

## Prinsip utama: kenyamanan pengguna (masukan founder atas papan desain v1)

> "Kamu terlalu fokus dengan compacting feature sampai lupa kalau yang terpenting adalah kenyamanan user dalam
> menggunakan aplikasi tersebut."

Aturan ini mengalahkan aturan lain di dokumen ini:

- **Satu layar, satu tujuan utama. Tampilkan lebih sedikit.** Hal sekunder disimpan di balik "Lainnya", satu ketukan
  lagi.
- **Beranda paling banyak 3 blok di atas Inti:**
  - satu hal yang perlu persetujuan, kalau ada;
  - agenda berikutnya, bukan seluruh hari;
  - 2–3 perangkat favorit sebagai sakelar besar.
  
  Usaha punya tabnya sendiri.
- **Sedikit tulisan:**
  - tanpa kalimat penjelasan di bawah baris;
  - ikon, angka, dan label 1–2 kata;
  - petunjuk hanya sekali di awal.
- **Lega dan besar:**
  - kontrol utama minimal 56 dp, tombol remote utama minimal 64 dp;
  - jarak antarelemen longgar;
  - teks isi minimal 16;
  - gerak tenang.
- **Remote:** 3–5 kontrol yang sering dipakai ditampilkan besar. Timer, ayun, angka, dan pilihan warna masuk ke
  "Lainnya".
- **Akun:** paling banyak 5–6 baris.
- **Hijau sebagai warna brand yang jelas:**
  - perbandingan kira-kira 60% netral, 30% hijau, 10% aksen lain;
  - perangkat menyala ditandai hijau;
  - biru, oranye, ungu, dan biru langit hanya penanda kecil kategori.
- **Ujiannya:** pemilik warung berusia 45 tahun yang sibuk harus langsung tenang dan tahu apa yang perlu diketuk.

## Arah desain: "hangat dan hidup"

### Warna (`src/theme/tokens.ts`, ganti palet; nama token boleh diubah asal konsisten)

**Netral, bukan hijau:**

| | Terang | Gelap |
|---|---|---|
| Latar | `#F7F6F2` | `#0E1012` |
| Permukaan | `#FFFFFF` | `#171A1E` |
| Permukaan naik | — | `#1F2328` |
| Teks | `#15181B` | `#F2F3F5` |
| Teks redup | `#6B6F76` | `#9CA1A8` |
| Garis halus | `#E9E7E1` | `#262A30` |

**Brand:**
- Hijau `#1D7550`, dengan versi terang `#4DA36E` dan versi gelap untuk mode gelap `#5BBF86`.
- Hanya untuk aksi utama, Inti, logo, dan status "menyala" atau "aktif".

**Aksen bidang**, masing-masing punya pasangan latar lembut untuk terang dan gelap:

| Bidang | Warna |
|---|---|
| Agenda | biru `#3B6FE0` |
| Rumah/perangkat | oranye `#F08A24` |
| Usaha | ungu `#7C5CE6` |
| Terhubung | biru langit `#1AA3C9` |
| Peringatan/hapus | koral `#E5484D` |
| Sukses | hijau brand |

**Gradasi Inti dan suara:** `#1D7550` → `#19B3A6` → `#3B6FE0`, dengan sorot `#B7E07A`.

Kontras teks memenuhi WCAG AA di kedua mode.

### Bentuk dan komposisi

- **Kurangi kotak bergaris.**
  - Bagian layar memakai judul besar dan isi yang mengalir: baris tanpa kotak, deretan geser horizontal, timeline.
  - Permukaan hanya untuk hal yang bisa disentuh. Radius 24–28, tanpa garis, bayangan sangat lembut.
- **Pusat perhatian:**
  - Angka besar, misalnya suhu 72–88 dan penjualan 32–40.
  - Ikon besar 44–48 di lingkaran berwarna aksen bidang.
  - Latar gradasi lembut, berupa radial samar, di bagian atas layar utama.
- **Gerak:**
  - Tekan mengecil ke 0,97 dengan pegas.
  - Isi layar masuk naik-memudar berurutan, jeda 40 ms dan durasi 220 ms.
  - Angka berganti halus.
  - Getar halus pada sakelar dan tombol remote.
  - Hormati pengaturan "kurangi gerakan".
- **Zona jempol:**
  - Aksi utama setiap layar ada di 40% bawah layar.
  - Pakai `flex` dan spacer, bukan jarak tetap dari atas.
  - Di layar panjang (tinggi/lebar ≥ 2,0) pusat aksi turun ke bawah.
  - Diuji di 360×640, 360×800, 393×873, dan 412×915.
  - Sentuhan minimal 48 dp.
  - Teks tetap rapi sampai skala huruf 1,3.

## Tugas

### R1: Fondasi visual

- **Palet baru** di `tokens.ts` untuk terang dan gelap, seperti di atas. Ganti pemakaian token lama di seluruh aplikasi; tidak ada lagi warna hijau untuk latar dan kartu.
- **Komponen dasar:**
  - `Surface` dengan varian polos, naik, dan aksen.
  - `SectionHeader`.
  - `AccentIcon`: ikon di lingkaran warna bidang.
  - `GradientField`: latar gradasi lembut.
  - `PressableScale`: tekan, pegas, dan getar.
  - `BigNumber`.
  - `HScroller`.
  - `useEnterAnimation`.
  - `useLayoutClass()` dengan nilai `compact`, `regular`, atau `tall` dari ukuran layar.
- **Pustaka gambar:** cek `@shopify/react-native-skia` untuk SDK 58 lewat `npx expo install`. Dipakai untuk gradasi, blur, dan gelombang di R2/R3. Kalau tidak cocok, pakai `react-native-svg` + reanimated. Laporkan dampak ukuran APK.
- **Pratinjau web untuk tangkapan layar**, opsional: kalau `expo start --web` bisa jalan dengan ringan, sediakan cara mengambil gambar layar di 393×873 lewat Playwright yang sudah ada, untuk memeriksa desain tanpa HP. Kalau terlalu berat, lewati dan jelaskan.
- **Dokumen `docs/desain.md`:** palet, komponen, aturan zona jempol.

### R2: Beranda dan Inti

- **Tata letak:**
  - Atas: sapaan sesuai waktu dan ringkasan satu kalimat di atas latar gradasi lembut.
  - Tengah:
    - "Hari ini" sebagai deretan atau timeline geser dengan aksen biru;
    - kartu persetujuan yang menonjol, berisi foto atau inisial penerima, cuplikan pesan, dan dua tombol;
    - "Rumah" sebagai deretan geser kontrol mini perangkat, dengan aksen oranye: ketuk menyalakan atau mematikan, tahan membuka remote;
    - "Usaha" sebagai angka besar dengan grafik kecil, aksen ungu.
  - Bawah, di zona jempol: Inti besar.
- **Inti baru:**
  - Lebih halus, dengan cahaya yang "bernapas" dari gradasi brand.
  - Label kecil "Ketuk untuk chat · Tahan untuk bicara".
  - **Ketuk** membuka `/chat`.
  - **Tahan** membuka Mode Suara yang langsung merekam dan mengirim saat dilepas, satu gerakan tanpa mengangkat jari.
  - Tab bar tetap.

### R3: Mode Suara ala Gemini

- **Layar penuh:**
  - Teks transkrip besar di atas.
  - Gelombang di bawah: 3–4 lapis gelombang gradasi dengan blur dan cahaya, mengalir terus.
  - Saat mendengar, tinggi gelombang mengikuti keras-pelannya suara.
  - Saat berpikir, gelombang berkilau tenang.
  - Saat menjawab, gelombang mengikuti irama balasan.
  - Peralihan antar keadaan memudar halus.
- **Kontrol** di zona jempol: area tahan-untuk-bicara besar di bawah, lalu Bisukan, Ketik, dan Selesai.
- **Inti tidak lagi menggantung di tengah atas layar.**
- Mode terang dan gelap, serta "kurangi gerakan" dengan gelombang statis yang hanya berdenyut.

### R4: Remote virtual per perangkat

- **Kontrak:**
  - `Device` mendapat `capabilities` dan `state` per jenis:
    - daya;
    - suhu: min, maks, langkah;
    - mode dan kecepatan kipas: pilihan;
    - swing;
    - terang-redup;
    - suhu warna dan warna;
    - volume dan bisu;
    - putar/jeda, berikutnya, sebelumnya, dan judul yang diputar;
    - sumber input;
    - channel;
    - tombol D-pad TV: atas, bawah, kiri, kanan, OK, kembali, beranda, menu;
    - posisi tirai;
    - kunci;
    - kamera: gambar terakhir dan privasi;
    - pemakaian listrik;
    - baterai;
    - bacaan sensor.
  - `POST /home/devices/:id` menerima nilai-nilai itu, plus `key` untuk tombol remote. Kompatibel dengan bentuk lama.
  - Server tiruan punya contoh lengkap untuk tiap jenis.
- **Halaman `app/perangkat/[id].tsx` memilih tata letak remote menurut jenis:**

  | Jenis | Tata letak |
  |---|---|
  | AC | suhu raksasa dengan dial, mode berikon, kipas, swing, timer, tombol daya bulat besar di bawah |
  | TV | daya, sumber, D-pad bundar dengan OK, tombol volume dan channel, beranda/kembali/bisu, lembar angka |
  | Speaker | sampul/gelombang lagu, putar/jeda besar, sebelumnya/berikutnya, penggeser volume, sumber |
  | Lampu | bola lampu yang bercahaya sesuai terang-redup, penggeser vertikal, pilihan warna dan suhu warna |
  | Kipas | kecepatan, ayun, timer |
  | Colokan | sakelar besar, pemakaian listrik |
  | Tirai | posisi, buka, tutup |
  | Kunci | gembok besar, geser untuk membuka, konfirmasi atau PIN sesuai aturan |
  | Kamera | gambar terakhir, privasi dengan PIN bila aktif, kejadian terbaru |
  | Sensor | bacaan |
  | Lainnya | daya |

- Tombol terasa seperti remote fisik: bulat, efek tekan, getar halus. Tombol yang paling sering dipakai ada di zona jempol.
- Aturan keamanan tetap: tidak membuka kunci lewat chat, PIN opsional.

### R5: Pengaturan yang sederhana

- **Akun:** kartu profil di atas (nama, nomor, langganan satu baris), lalu satu daftar pendek. Setiap baris berisi ikon beraksen, judul, dan satu kalimat penjelasan:
  - **Asisten**: nama, gaya bicara, sapaan pagi, dalam satu halaman.
  - **Pemberitahuan dan alarm**: sakelar per jenis dan status izin HP, dalam satu halaman.
  - **Tampilan**: Ikuti HP, Terang, atau Gelap. Pilihannya bisa langsung di Akun.
  - **Keamanan dan privasi**: PIN, HP yang terhubung, dan hapus yang asisten tahu, dalam satu halaman.
  - **Langganan**: status dan tombol Perpanjang lewat WhatsApp.
  - **Bantuan**: WhatsApp.
  - **Keluar**.
- Halaman lama digabung. Kedalaman paling banyak dua tingkat.

### R6: Layar lain dan pemeriksaan responsif

- Agenda, Usaha, Terhubung, Riwayat, dan Chat memakai bahasa visual baru:

  | Layar | Bentuk baru |
  |---|---|
  | Agenda | rel waktu |
  | Usaha | angka dan grafik sebagai pusat perhatian |
  | Terhubung | kisi logo layanan |
  | Riwayat | timeline |
  | Chat | gelembung dan kartu yang selaras dengan palet baru |

- Pemeriksaan semua layar di empat ukuran layar dan skala huruf 1,3, termasuk tes matriks layar.
- Kalau R1 berhasil menyediakan pratinjau web, sertakan tangkapan layar.
- Build EAS baru untuk diuji founder.

## Selesai bila

- Founder bisa mencoba APK baru dengan semua poin masukan di atas terpenuhi.
- Tes, tsc, dan lint hijau.
- Review akhir tanpa temuan Kritis.
