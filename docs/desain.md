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
| `MoreSheet` | "Lainnya" | Kapsul `sunken` 44 di kepala; lembar dengan baris 72: ikon + satu kata + kontrol atau chip nilai |
| `Enter`, `useEnterAnimation`, `blockLayout` | Blok muncul | Pudar + naik 12, 320 ms, jeda 80 ms (maks 3); `blockLayout` untuk blok yang bergeser |
| `useLayoutClass`, `byLayout` | Ukuran layar | `compact` / `regular` / `tall` |
| `ThumbZone` | Tata letak layar | Atas, spacer lentur, aksi utama menempel di bawah |
| `ApprovalCard` | Persetujuan di Beranda | Inisial (langit), nama, cuplikan satu baris, Ubah (`sunken`) + Kirim (`brand`, 1,4×), 56 |
| `NextItemRow` | Agenda berikutnya | Kalender biru, jam, judul (≤ 2 baris), chevron; tanpa permukaan |
| `FavouriteToggle` | Sakelar besar perangkat | 132 tinggi (104 `compact`), ikon 46, nama pendek + satu kata keadaan; ketuk nyala/mati, tahan buka remote; peran `switch` |
| `SuggestionCard` | "Coba bilang" | Hanya untuk pengguna baru; ketuk membuka chat dengan kalimatnya di kolom ketik |
| `CoachMark` | Petunjuk sekali-lihat | Gelembung `tip`/`onTip` + panah; lapisan tembus pandang: ketukan di mana pun menutupnya |
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

## Gerak

- Pelan dan halus: tekan pegas `{ damping 20, stiffness 260, mass 0,7 }`; blok 320 ms; angka 160 ms; segmen 200 ms.
- Tanpa putaran sibuk selain Inti dan gelombang suara. Hentikan putaran saat layar tidak fokus atau aplikasi di latar.
- "Kurangi gerakan" (`useReducedMotion` dari Reanimated): tanpa skala tekan, tanpa naik-memudar, angka langsung
  berganti. Getar tetap.
- Getar: sakelar/segmen `selection`, tombol remote `Light`, daya `Medium`, Kirim `Success` (`haptic()` dari kit).

## Skia

`@shopify/react-native-skia` 2.14.0 (versi yang dipatok Expo SDK 58; mendukung New Architecture) dipasang untuk
gelombang Mode Suara (R3). Inti (R2) tidak memakainya: sapuannya PNG yang diputar Reanimated dan cahayanya gradasi
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

Setelah selesai, hentikan server dan hapus `$TMPDIR/metro-*` (disk mesin pengembang sempit).
