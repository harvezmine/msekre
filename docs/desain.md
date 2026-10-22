# Desain Fase R: cara memakai token dan komponen

Sumber kebenaran: `docs/desain/spesifikasi.md` (v2) dan papan `docs/desain/papan-desain.html`. Dokumen ini menjelaskan
cara memakainya di kode. Token ada di `src/theme/tokens.ts`, komponen dasar di `src/ui/kit` (impor dari `@/ui/kit`),
katalog hidup di rute `/dev/kit` (hanya build pengembangan; di Akun > Coba, atau buka lewat tautan).

## Prinsip

1. **Kenyamanan dulu.** Satu tujuan per layar, sedikit tulisan, kontrol utama besar. Ruang kosong itu fitur.
2. **Kira-kira 60% netral, 30% hijau brand, 10% penanda kecil.**
3. **Tampilkan lebih sedikit.** Kontrol kedua masuk ke `MoreSheet` ("Lainnya") atau layar detail.
4. **Tanpa kalimat penjelasan.** Baris dan kartu: judul 1–3 kata, lalu nilai atau satu kata keadaan ("Nyala", "24°").

## Tema

```tsx
const { c, marker, shadow, radius, space, motion, type, field, scheme } = useTheme();
```

| Kelompok | Isi |
|---|---|
| `c` | Netral: `bg`, `surface`, `raised`, `sunken`, `sunken2`, `text`, `muted`, `faint` (hiasan saja), `line`, `tabbar`, `voiceCanvas`. Brand: `brand`, `onBrand`, `brandInk`, `brandSoft`, `brandGlow`. Lain: `ripple`, `scrim` |
| `marker` | Penanda kategori `agenda` (biru), `rumah` (oranye), `usaha` (ungu), `terhubung` (langit), `warn` (koral). Tiap kategori hanya `base` (titik, garis grafik) dan `ink` (ikon, teks peringatan kecil). Sengaja tanpa `soft` |
| `shadow` | `boxShadow` RN: `e1` ubin, `e2` kartu, `key` tombol remote, `power` tombol daya menyala, `thumb`, `knob` |
| `type` | `readout` 100/300, `figure` 46, `display` 32, `title` 28, `headline` 24, `header` 20, `quote` 19, `section` 18, `row` 17, `subtitle`/`body`/`bubble` 16, `label` 15, `caption` 14, `micro` 12 |
| `radius`, `space`, `motion` | Lihat komentar di `tokens.ts`; `space.hit` 56 (kontrol utama), `space.hitMin` 48, `space.key` 64 |
| `onVoice` | Teks dan tombol di atas kanvas Mode Suara/alarm (sama di dua mode) |

Teks memakai `<Txt v="row">`; angka jam/uang/suhu diberi `tabular`. `readout` dan `figure` otomatis dibatasi skala huruf
1,1, `micro` 1,2.

### Pemetaan dari palet lama

| Lama | Baru |
|---|---|
| `paper` | `bg` |
| `card` | `surface` (tanpa garis tepi, dengan `shadow.e1`) |
| `ink` | `text` |
| `green` | `brand` (tombol utama, menyala), `brandInk` (tautan, kata keadaan), atau `text` (ikon netral) |
| `onGreen` | `onBrand` |
| `mint` | `sunken` (lingkaran ikon, tombol kedua) atau `brandSoft` (menyala/terpilih, kecil) |
| `leaf`, `leafText`, `sage` | `brand` / `brandInk` |
| `clay`, `clayBg` | `marker.warn.ink`, latar `sunken` |
| `track`, `stepOff` | `sunken2` |
| `quiet`, `quietTile` | `sunken` |
| `quietText`, `micSub` | `muted` |
| `dotEmpty` | `faint` |
| `voice`, `forestTile` | `voiceCanvas`; ubin Kotak = `text` dengan ikon `bg` |
| `onForest.*` | `onVoice.*` |

## Warna: aturan pakai

- **Hijau brand** untuk: Inti, gradasi hero (`GradientField recipe="hero"`), tab aktif (`brandInk` di atas penanda
  `brandSoft`), tombol utama (Kirim, Simpan), tautan, sukses, dan **setiap keadaan menyala**.
- **Menyala:** ubin `Surface variant="on"` (terang: `brandSoft`; gelap: permukaan arang + cahaya hijau di pojok, tidak
  pernah permukaan hijau), lingkaran ikon `AccentIcon tone="on"`, kata keadaan `brandInk`, sakelar `brand`, tombol daya
  `RemoteKey variant="power" on`. **Mati = netral** (`surface` + `e1`, ikon `muted`).
- **Penanda kategori** hanya sebagai warna ikon di lingkaran netral (`AccentIcon tone="agenda"`), titik kecil, atau
  garis grafik. Tidak pernah latar, judul bagian, atau permukaan berwarna. Busur dingin dial AC boleh biru langit.
- **Peringatan:** `marker.warn.ink` untuk teks/ikon kecil, latar tetap netral (`sunken`). Tombol hapus: isian
  `marker.warn.ink` dengan teks `onBrand`.
- Mode gelap tetap arang netral; hijau hanya aksen dan cahaya.
- Kontras: semua pasangan teks lulus WCAG AA, diperiksa otomatis di `__tests__/kit-token.test.tsx`.

## Komponen (`@/ui/kit`)

| Komponen | Pakai untuk | Catatan |
|---|---|---|
| `Surface` | Ubin, kartu, blok | `plain` / `raised` / `on` / `sunken` / `ghost`; `onPress` membuatnya bisa ditekan (pegas + getar) |
| `PressableScale` | Semua yang bisa ditekan | Skala 0,97 (remote 0,94), pegas pelan, `haptic`, tahan 300 ms, peran/label diteruskan; tanpa skala bila "kurangi gerakan" |
| `AccentIcon` | Ikon di lingkaran | Kategori: lingkaran netral + ikon tinta kategori; `brand`, `on`, `neutral` |
| `SectionHeader` | Judul bagian | Aksi tautan hijau atau `iconOnly` (lebih sedikit tulisan) |
| `GradientField` | Cahaya lembut di atas layar | Resep `hero`, `cool`, `warm`, `profile`; absolut, tidak menangkap sentuhan |
| `BigNumber` | Suhu, persen, uang | Angka tabular, berganti dengan geser + pudar 160 ms |
| `HScroller` | Deretan geser | Mulai di tepi 20, jarak 12, berhenti per butir |
| `Segmented` | Pilihan pendek | Lintasan `sunken`, jempol `surface`, segmen 44; satu kata per pilihan |
| `ListRow` | Baris tanpa kotak | Ikon 44 + judul + nilai/chevron; `description` hanya bila sungguh perlu |
| `RemoteKey` | Tombol remote | 60–100 (bawaan 64); `power` (sakelar hijau), `selected`, `brand`, `ink`, `glass`; label bawah hanya bila ikon tidak jelas |
| `Rocker` | VOL / CH | Dua tombol 64 dalam kapsul 80 |
| `Slider` | Volume, terang lampu | Horizontal 56, vertikal 112×440 (isian warna cahaya lampu); `adjustable` untuk pembaca layar |
| `Dial` | Suhu AC | Busur 270°, tanpa label skala, angka di tengah; geser cincin atau naik/turun pembaca layar |
| `TimeRail`, `TimeStrip` | Agenda | Jam + 2–3 kata + satu ikon; garis sekarang hijau, butir berikutnya bertitik biru |
| `Sparkline`, `AreaChart` | Usaha | Garis ungu, area 14% |
| `MoreSheet` | "Lainnya" | Kapsul `sunken` 44 di kepala; lembar dengan baris 72: ikon + satu kata + kontrol atau chip nilai (tanpa `onPress`: nilai baca saja); `footer` untuk isi tambahan (papan angka) |
| `ChoiceSheet` | Pilih satu (sumber input, timer) | Lembar dengan judul satu kata dan baris 64, centang hijau; memilih menutup lalu menjalankan |
| `Enter`, `useEnterAnimation`, `blockLayout` | Blok muncul | Pudar + naik 12, 320 ms, jeda 80 ms (maks 3); `blockLayout` untuk blok yang bergeser |
| `useLayoutClass`, `byLayout` | Ukuran layar | `compact` / `regular` / `tall` |
| `ThumbZone` | Tata letak layar | Atas, spacer lentur, aksi utama menempel di bawah |
| `ApprovalCard` | Persetujuan di Beranda | Inisial (langit), nama, cuplikan satu baris, Ubah (`sunken`) + Kirim (`brand`, 1,4×), 56 |
| `NextItemRow` | Agenda berikutnya | Kalender biru, jam, judul (≤ 2 baris), chevron; tanpa permukaan |
| `FavouriteToggle` | Sakelar besar perangkat | 132 tinggi (104 `compact`), ikon 46, nama pendek + satu kata keadaan; ketuk nyala/mati, tahan buka remote; peran `switch` |
| `SuggestionCard` | "Coba bilang" | Hanya untuk pengguna baru; ketuk membuka chat dengan kalimatnya di kolom ketik |
| `CoachMark` | Petunjuk sekali-lihat | Gelembung `tip`/`onTip` + panah; lapisan tembus pandang: ketukan di mana pun menutupnya |
| `ServiceLogo` | Logo layanan di mana pun layanan tampil | Ubin persegi membulat 28% sisi seperti ikon aplikasi (bukan lingkaran): putih + garis tipis di terang, `raised` di gelap; ukuran 28/40/56/72; `status` `connected` (takik centang hijau), `attention` (titik koral), `soon` (redup). Pemetaan id -> logo hanya di `src/ui/connect/logos.ts` (logo landing, Simple Icons, ubin huruf berwarna merek bila tidak ada logo bebas pakai; id asing dicocokkan lewat nama). Logo SVG dibuat ulang dengan `node scripts/make-logos.mjs` dari `assets/logos/` |
| `blockEntering`, `blockExiting` | Blok muncul/pergi | Prop `entering`/`exiting` Reanimated: pudar + naik 12, 320 ms, jeda 80; pergi 260 ms |

Komponen lama (`Card`, `ListRow`/`ListGroup` di `src/ui`, `Segmented`, `Toggle`) sudah memakai token baru; layar akan
dibangun ulang dengan kit di R2–R6.

## Zona jempol dan kelas tata letak

`useLayoutClass()` dari ukuran jendela:

| Kelas | Aturan | Contoh |
|---|---|---|
| `compact` | tinggi < 700 | 360×640 |
| `tall` | tinggi/lebar ≥ 2,0 | 360×800, 393×873 (acuan), 412×915 |
| `regular` | selain itu | 412×780 |

- Setiap layar: isi atas, spacer lentur, aksi utama di bawah, diukur dari batas aman bawah (`ThumbZone`). Tidak ada
  jarak tetap dari atas untuk mendorong aksi ke bawah.
- Aksi utama di 40% bawah: Inti, Kirim, − / daya / +, rocker, putar, Tambah.
- Di `tall`, tinggi lebih masuk ke spacer. Di `compact`: sapaan 28, Inti 76, ubin 104.
- Target: kontrol utama ≥ 56 dp, tombol remote 60–100, kontrol kedua ≥ 48.
- Teks tetap rapi sampai skala huruf 1,3: tinggi minimum, bukan tinggi tetap.

## Beranda, Inti, dan bilah tab (R2)

- **Beranda tumbuh pelan-pelan** (`src/ui/beranda/blocks.ts`): sapaan pendek ("Pagi, Rina"; pengguna baru "Halo,
  Rina") dan avatar (ke Akun). Paling banyak tiga blok, urutan tetap, masing-masing hanya bila ada isinya:
  persetujuan tertua, agenda berikutnya (dalam 12 jam, tetap 15 menit setelah mulai), 2–3 sakelar favorit. Tanpa blok:
  satu `SuggestionCard` di zona jempol. Usaha, ringkasan, cincin layanan, dan pemilih tempat tidak di Beranda.
- **Favorit**: yang disematkan (`Device.favorite`), atau tiga yang terakhir diatur (`Device.lastUsedAt`) tanpa kunci,
  kamera, dan perangkat yang dijaga. Ketuk lewat `useDeviceControl` (PIN dan "buka kunci?" tetap berlaku).
- **Inti** (`src/ui/inti/IntiOrb.tsx`, `IntiButton.tsx`): bola gradasi brand (sapuan PNG `assets/brand/inti-sapuan.png`
  dari `scripts/make-inti.mjs`, diputar 16 detik), cahaya bernapas 4,2 detik, S putih. 92 di Beranda (76 `compact`),
  pusatnya di garis atas bilah; 48 di tab lain. Ketuk = chat; tahan = `/suara?hold=1` langsung mendengar, jari diangkat
  mengirim (`src/voice/holdBridge.ts`). Label = nama asisten, petunjuk "Ketuk untuk chat, tahan untuk bicara".
- **Bilah tab** (`src/ui/TabBar.tsx`, `src/ui/tabSet.ts`): dua paruh mengapit slot Inti 96. Beranda dan Agenda selalu;
  Perangkat setelah ada perangkat (Kotak termasuk); Usaha setelah `Home.business` ada. Susunan terakhir disimpan di HP;
  tab yang muncul selagi aplikasi terbuka masuk dengan gerak 360/240 ms dan titik hijau sampai dikunjungi.
- **Petunjuk** (`src/ui/tips.ts`): "Ketuk untuk chat · Tahan untuk bicara" sekali seumur aplikasi di HP ini, dengan
  halo di Inti; menutupi kartu contoh selama tampil; ketukan apa pun menutupnya.

## Mode Suara (R3)

- **Satu niat:** tahan Inti sambil bicara, lalu baca ucapan dan jawabannya dengan tenang. Kanvas selalu gelap
  (`voiceCanvas`) di mode terang maupun gelap.
- **Atas:** titik hijau kecil (berdenyut 1,6 detik saat mendengar; dibacakan "Mendengar", "Nadia berpikir", "Nadia
  menjawab", "Siap"), lalu ucapan besar (`transcript` 32/42; kata terakhir yang belum pasti 42% terang). Berpikir:
  ucapan meredup dan hanya "Sebentar…" yang berdenyut. Menjawab: ucapan mengecil (20/28, redup), balasan 26/34 di
  bawahnya (area langsung sopan). Belum ada ucapan: "Tahan Inti sambil bicara" redup di tempat ucapan akan muncul.
- **Bawah (zona jempol):** gelombang di belakang (62% tinggi layar, menempel di bawah), lalu Bisukan (60, ikon saja),
  **Inti 88** sebagai tempat menahan, Ketik (60, ikon saja), dan "Selesai" (56). Menyala (dibisukan, sedang mengetik) =
  hijau lembut + cincin hijau. Kolom ketik dan kartu konfirmasi muncul tepat di atas kontrol; gelombang meredup separuh
  selama keduanya tampil. Kontrol menempel di bawah (tanpa jarak dari atas), jadi di HP panjang tetap di 40% bawah.
- **Inti di Mode Suara:** sedikit membesar saat mendengar, cahayanya `1 + 0,45 × level`, cincin gradasi berputar 3,2
  detik saat berpikir, redup bila belum tersambung. Tahan dari Beranda (`?hold=1`) tetap satu gerakan.
- **Gelombang** (`src/voice/WavesSkia.tsx`, hitungan di `src/voice/waveMath.ts`): empat lapis §5.1 (warna
  `gradients.waves`), tiap lapis = jalur tertutup + gradasi tiga warna × pita alfa vertikal (`Blend dstIn`, anak pertama
  warna, kedua alfa) + `BlurMask` + `blendMode="plus"`, garis puncak tipis di lapis depan, kilau menyapu saat berpikir,
  bilasan biru-hijau di dasar. Jam frame Reanimated (`useFrameCallback`) memajukan fase, level halus (naik 0,35 / turun
  0,10 per frame 60 fps, tidak bergantung laju frame), kecepatan, terang, dan kilau di utas UI; jalur dibangun di worklet
  (`usePathValue`). Keadaan: mendengar = level mikrofon (desibel, lantai 0,12, kecepatan 1); berpikir = 0,14 ± 0,04,
  kecepatan 0,45, terang 70%, kilau; menjawab = selubung bicara tiruan ±3,4 suku kata/detik, kecepatan 0,8; siap = napas
  pelan 4,2 detik; mati/kendala = redup dan berhenti pelan-pelan. Semua peralihan meluruh ±300 ms, kanvasnya tidak pernah
  dipasang ulang. "Kurangi gerakan": bingkai diam dengan denyut terang 2,4 detik. Layar tidak fokus: jam berhenti.
- **Level mikrofon** (`src/voice/pcm.ts` `level`): RMS → desibel, -50 dB = 0, -10 dB = 1; pengendali menulisnya ke
  nilai bersama `voice.level`.

## Remote virtual dan Perangkat (R4)

- **Satu niat per remote** (komentar pertama tiap berkas di `src/ui/remote/`). `app/perangkat/[id].tsx` memilih tata letak
  dengan `remoteKindOf` (jenis dulu; jenis `other` menurut kemampuannya; tanpa petunjuk: daya saja) dan menyediakan
  `RemoteContext` (`control`, `adjust`, `setFavorite`, `retry`, `mediaUrl`, Kotak). Kontrol hanya untuk kemampuan yang
  dimiliki (`capsOf`; server lama tanpa `capabilities` disusun dari `ac`/`level`).
- **`RemoteFrame`**: kembali + nama (+ "Perkiraan" kecil untuk perangkat IR) + Lainnya; isi atas, spacer, kontrol utama
  di zona jempol. Lainnya selalu memuat Favorit (kecuali Kotak dan sensor) dan, untuk IR, satu kalimat "Keadaan ini
  perkiraan dari perintah terakhir.". Tidak terjangkau: isi diredupkan 38% dan tersembunyi dari pembaca layar, satu
  baris "Tidak terjangkau" + Coba lagi. Isi hanya bisa digulir bila tidak muat (layar pendek).
- **Layar utama vs Lainnya:**

  | Remote | Layar utama | Lainnya |
  |---|---|---|
  | AC | Dial suhu (busur biru langit saat mendinginkan), suhu ruangan, mode (≤ 5), − / daya / + (76/100/76) | Kipas (segmen batang), Ayun, Timer |
  | TV | Daya, Sumber, D-pad + OK, Kembali/Beranda/Menu, VOL, Bisukan, CH | Papan angka |
  | Speaker | Sampul (dari server atau lukisan gradasi dari judul), judul, penyanyi, sebelumnya / putar-jeda 92 / berikutnya, volume | Sumber, Bisu, Daya |
  | Lampu | Bola lampu bercahaya (ikut terang), persen, penggeser tegak berwarna cahaya, daya | Suhu warna (Hangat/Netral/Dingin), warna (bulatan) bila ada |
  | Kipas | Baling-baling berputar, kecepatan (tombol besar), Ayun, daya | Timer |
  | Colokan | Watt sekarang dan kWh hari ini (angka besar), daya 124 | Timer |
  | Tirai | Jendela bergambar, persen, penggeser tegak, Tutup / Buka | - |
  | Kunci | Gembok besar, Terkunci/Terbuka, satu tombol Buka (PIN atau "buka kunci?") / Kunci | Baterai |
  | Kamera | Gambar terakhir + titik rekam, tombol Rekam (privasi dijaga PIN) | - |
  | Sensor | Bacaan besar, baterai | - |
  | Kotak | Online, suhu, kelembapan, tombol mic besar | Speaker |
  | Lainnya | Ikon besar, keadaan, daya | - |

- **Nilai kontinu** (suhu, terang, volume, posisi) lewat `adjust`: layar langsung, server menerima nilai akhir 400 ms
  setelah perubahan terakhir, dikirim saat layar ditutup, dikembalikan bila gagal. Tombol remote lewat `control({ key })`.
- **Perangkat** (`app/(tabs)/perangkat.tsx`): judul, tempat kecil (bila lebih dari satu tempat) dan + di kepala; segmen
  "Semua" + ruangan (di tempat "Semua": per tempat); kisi `gridRows`: AC menyala selebar layar dengan suhu 56, Kotak, ubin
  dua kolom, tidak terjangkau paling akhir. Kata ubin `tileWord` ("Dingin", "80%", "Vol 18", "Memutar", "Terkunci",
  "Terputus"). Ketuk ubin sakelar (`tileToggles`) = nyala/mati; kunci, kamera, tirai, sensor, Kotak, dan yang dijaga
  dibuka remote-nya; tahan ubin mana pun membuka remote. Rutinitas sebagai deretan pil, hanya bila ada.
- Pratinjau web: `/perangkat/ac-kamar?lainnya=1` membuka Lainnya, `/perangkat?tempat=Rumah` memilih tempat.

## Akun yang sederhana (R5)

- **Akun** (`app/akun.tsx`, papan bingkai 19): kartu profil (`src/ui/akun/ProfileCard.tsx`: avatar 68 bercincin gradasi
  brand, nama, satu baris paket dari `planLine` dengan Perpanjang ke WhatsApp; masa coba memakai batang 7 ruas dari
  `trialBar`), lalu **paling banyak enam baris** tanpa kalimat keterangan: Asisten (nama), Pemberitahuan (Nyala / Mati /
  Perlu izin), Tampilan (segmen langsung di baris itu), Keamanan (PIN / Mati), Layanan tersambung (jumlah, ke
  Terhubung), Bantuan (WhatsApp). Keluar sebagai tombol teks koral, "Data contoh" dan versi kecil, dan satu baris Coba
  (mode contoh dan build pengembangan saja) yang membuka lembar jalan pintas layar uji.
- **Kedalaman paling banyak dua**: Akun → halaman baris → lembar konfirmasi.
  - `akun/asisten`: nama (Simpan hanya muncul saat diubah), gaya bicara sebagai segmen dengan satu contoh kalimat,
    sakelar Sapaan pagi + jam. Gaya dan sapaan berlaku seketika, dikembalikan bila server menolak.
  - `akun/notifikasi` (Pemberitahuan): Izin HP (ketuk hanya bila perlu izin), Alarm (HP dengan alarm native), lalu
    sakelar per jenis. Rumah hanya bila ada perangkat, Usaha hanya bila ada data usaha (`useNotifications`).
  - `akun/keamanan`: PIN (+ Ganti PIN, Lupa PIN), HP yang terhubung (Keluarkan), yang asisten tahu per layanan (ketuk =
    lembar konfirmasi hapus), Hapus akun (WhatsApp), Kebijakan privasi.
- Halaman lama `akun/sapaan`, `akun/tampilan`, `akun/hp`, dan `akun/privasi` sudah digabung dan dihapus. Riwayat dibuka
  dari kepala chat (ikon jam), bukan dari Akun.

## Gerak

- Pelan dan halus: tekan pegas `{ damping 20, stiffness 260, mass 0,7 }`; blok 320 ms; angka 160 ms; segmen 200 ms.
- Tanpa putaran sibuk selain Inti dan gelombang suara. Hentikan putaran saat layar tidak fokus atau aplikasi di latar.
- "Kurangi gerakan" (`useReducedMotion` dari Reanimated): tanpa skala tekan, tanpa naik-memudar, angka langsung
  berganti. Getar tetap.
- Getar: sakelar/segmen `selection`, tombol remote `Light`, daya `Medium`, Kirim `Success` (`haptic()` dari kit).

## Skia

`@shopify/react-native-skia` 2.14.0 (versi yang dipatok Expo SDK 58; mendukung New Architecture) dipakai hanya untuk
gelombang Mode Suara (R3). Kanvasnya `opaque` (di Android SurfaceView, jalur termurah), jadi denyut "kurangi gerakan"
dihitung di dalam Skia, bukan lewat opacity View. Di web, `src/voice/Waves.web.tsx` memuat CanvasKit dulu
(`public/canvaskit.wasm`, tidak ikut git) lalu memakai komponen Skia yang sama; tanpa berkas itu tampil pita cahaya
diam. Inti (R2) tidak memakainya: sapuannya PNG yang diputar Reanimated dan cahayanya gradasi
radial `react-native-svg`, jadi sama di HP, web, dan Jest. Di Jest, `jest.setup.ts` memakai tiruan ringan
`__tests__/skiaMock.ts` (Canvas = View, komponen gambar lain kosong), jadi tes tidak memuat modul native atau CanvasKit.
Dampak ukuran APK belum diukur: periksa di build EAS berikutnya.

## Tangkapan layar tanpa HP

`node scripts/shots.mjs <rute...> --out <folder> --sizes 393x873 --themes light,dark` menyalakan `expo start --web`,
membuka rute di Chromium tanpa layar (cache Playwright), lalu menyimpan PNG. Server yang sudah jalan: `--url
http://localhost:8099` (Metro dengan `CI=1` tidak memantau berkas: nyalakan ulang setelah mengubah kode). Pilihan
pratinjau di alamat, hanya saat pengembangan (`src/dev/query.web.ts`):

| Alamat | Isi |
|---|---|
| `/?petunjuk=0` | Beranda pengguna contoh tanpa petunjuk |
| `/?contoh=baru&petunjuk=0` | Pengguna baru: sapaan, kartu contoh, dua tab |
| `/?contoh=baru&petunjuk=1` | Pembukaan pertama: petunjuk Inti dengan halo |
| `/suara?demo=mendengar` | Mode Suara mendengar (level mikrofon tiruan); juga `berpikir`, `menjawab`, `siap` |

Gelombang Skia di web macet dengan waktu virtual Chrome (tiap frame WebGL perangkat lunak lambat). Untuk Mode Suara
pakai jam sungguhan: `node scripts/shots.mjs '/suara?demo=mendengar' --out <folder> --sizes 393x873 --themes dark
--motion on --real 8000`. Skrip menyalin `canvaskit.wasm` ke `public/` selama berjalan dan menghapusnya lagi.

Setelah selesai, hentikan server dan hapus `$TMPDIR/metro-*` (disk mesin pengembang sempit).

## Layar lain dan pemeriksaan responsif (R6)

Setiap berkas layar dibuka dengan satu komentar niat: untuk apa layar itu dan satu tindakan tersering (yang paling besar
dan paling dekat dengan jempol).

| Layar | Layar utama | Satu ketukan lagi |
|---|---|---|
| Agenda (papan 17) | Deretan tujuh hari (terpilih = lingkaran hijau, titik biru = ada agenda), rel waktu hari itu (`TimeRail`: jam, judul, satu ikon; garis sekarang hijau; berikutnya di kartu putih bertitik biru; tugas = kotak centang 28), "Tambah…" + mic hijau menempel di atas bilah tab | Bulan lain (lembar kalender dari nama bulan di kepala), rincian butir (ketuk butir: cara, ulangan, tempat rapat; selalu dibacakan), pratinjau alarm (tahan) |
| Usaha (papan 18) | Tempat (tulisan + chevron), segmen Hari ini / Minggu / Bulan, angka ringkas `figure` ("Rp 4,25 jt", `formatRupiahRingkas`) + panah persen, `AreaChart` ungu, cabang (titik ungu), satu stok menipis dengan Pesan di zona jempol | `usaha/lainnya`: semua stok, uang masuk, pesanan, laporan, sumber data |
| Chat | Kepala: Inti 40, nama, "Siap membantu", jam (Riwayat), Mode Suara. Gelembung pengguna `sunken` kanan, asisten `surface` kiri; kartu `ChatCard` (radius 24, `e1`, tombol 52); kolom ketik 56 dengan kirim/mic 56 | - |
| Riwayat | Garis waktu: ikon penanda kategori 44 di rel, judul, jam di kanan, satu keterangan; Batalkan + hitung mundur | Saringan (satu tombol di kepala, pilihannya di `ChoiceSheet`) |
| Terhubung | "{n} layanan tersambung" dengan dok logo yang tersambung (bertumpuk tipis), banner tenang untuk yang perlu dilihat, lalu kartu logo dua kolom per kelompok (Kerja, Catatan, Usaha, Rumah, Lainnya; titik penanda kecil di judul): tersambung = takik centang hijau di logo, perlu dilihat = titik koral, "Segera" redup | Detail: ubin logo 72 + nama + satu baris keadaan, paling banyak tiga baris "yang bisa dilakukan" berikon kecil, izin sebagai `Segmented role="radio"` + satu kalimat, Hapus/Putuskan sebagai tombol teks di zona jempol, Sambungkan / Sambungkan ulang sebagai tombol utama paling bawah. Masuk dan Tersambung: `JoinMark` (logo layanan, garis, tanda S asisten; titik hijau mengalir saat menyambung; saat tersambung logo meluncur, garis tergambar, lalu centang, sekali per sambungan) |
| Alarm | Jam besar 104/300, judul, catatan; Tanya (Inti 32) + Tunda 60, lalu geser untuk mematikan, semuanya menempel di bawah | Panduan izin: satu baris per izin (centang hijau atau "Atur") |
| Mulai | Satu kalimat, Inti, kolom besar `sunken` (nomor 19, kotak kode 64), tombol utama di bawah | - |
| Lembar | `ConfirmBody` (ikon, judul 20, satu kalimat, tombol 56 koral/hijau, Batal), PIN dengan tombol pil 64 (56 compact), pemilih tempat baris 64 | - |

- **Akun hanya dari Beranda.** Agenda dan Usaha tidak lagi punya avatar.
- **Sisa tugas kemarin** tidak di layar Agenda; asisten menanyakannya sekali di chat (`resolveLeftover` tetap ada).
- **Toast** memakai tinta petunjuk (`tip`/`onTip`), radius 20.

### Pemeriksaan responsif (`__tests__/responsif.test.tsx`)

- Semua layar di 360×640 (compact) dan 412×915 (tall): tidak ada lebar tetap yang melebihi layar.
- Aksi utama tiap layar berada di wadah zona jempol: `testID="zona-jempol"` (bagian bawah `ThumbZone`, kolom ketik chat,
  Tambah di Agenda, stok di Usaha, aksi alarm, tombol Mulai/Masuk/Selesai), `lembar-panel` (panel lembar bawah), atau
  `suara-kontrol`. Tambahkan penanda yang sama saat membuat layar baru.
- Skala huruf 1,3 di 360×640 (layar kunci): teks ≥ 40 dibatasi `maxFontSizeMultiplier` ≤ 1,2 dan teks baca tidak duduk
  di kotak bertinggi tetap < 40.
