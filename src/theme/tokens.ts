/**
 * Token visual Fase R v2: docs/desain/spesifikasi.md dan papan docs/desain/papan-desain.html. Panduan: docs/desain.md.
 * - Kira-kira 60% netral hangat, 30% hijau brand, 10% penanda kecil.
 * - Hijau = brand: gradasi hero, Inti, tab aktif, tombol utama, dan SEMUA keadaan menyala (ubin, tombol daya, sakelar,
 *   pilihan terpilih). Mati = netral.
 * - Warna kategori (biru, oranye, ungu, langit, koral) hanya penanda: warna ikon di lingkaran netral, titik kecil, garis
 *   grafik. Sengaja tanpa token latar lembut, supaya tidak ada permukaan besar berwarna kategori.
 * - Mode gelap tetap arang netral; hijau hanya sebagai aksen dan cahaya, tidak pernah permukaan hijau.
 */

// ---------------------------------------------------------------------------------------------------------------------
// Netral (60%) dan brand hijau (30%), §1.1 dan §1.2

export const light = {
  /** Latar layar. */
  bg: '#F7F6F2',
  /** Kartu, ubin, tombol yang bisa disentuh. */
  surface: '#FFFFFF',
  /** Tombol remote, D-pad, rocker: satu tingkat di atas `surface` (di mode gelap lebih terang). */
  raised: '#FFFFFF',
  /** Lintasan segmen, gelembung pesan, kolom ketik, tombol kedua, lingkaran ikon kategori. */
  sunken: '#F0EEE8',
  /** Lintasan penggeser/dial yang belum terisi, sakelar mati, jempol segmen di mode gelap. */
  sunken2: '#E6E3DB',
  /** Teks dan ikon utama. */
  text: '#15181B',
  /** Teks kedua, tab yang tidak aktif, ikon mati. */
  muted: '#64686F',
  /** Hiasan saja (titik timeline kosong, chevron). Jangan untuk teks yang harus dibaca. */
  faint: '#A4A7AC',
  /** Garis tipis, rel, pemisah. */
  line: '#E9E7E1',
  /** Permukaan tab bar bawah. */
  tabbar: '#FFFFFF',
  /** Latar Mode Suara dan alarm, sama di dua mode. */
  voiceCanvas: '#07090B',
  /** Hijau brand: tombol utama, isian keadaan menyala (lingkaran ikon ubin, tombol daya, sakelar), Inti, garis sekarang. */
  brand: '#1D7550',
  /** Teks/ikon di atas `brand` (juga di atas isian koral tombol hapus). */
  onBrand: '#FFFFFF',
  /** Teks hijau: label tab aktif, kata keadaan ("Nyala", "24°"), tautan seperti Perpanjang. */
  brandInk: '#1D7550',
  /** Latar ubin menyala (terang), penanda tab aktif, pilihan terpilih, tombol lembut (Pesan, Perpanjang). */
  brandSoft: '#E3F1E8',
  /** Cahaya hijau radial di pojok kanan atas ubin menyala (dipakai di mode gelap). */
  brandGlow: 'rgba(77,163,110,0.34)',
  /** Riak tekan Android. */
  ripple: 'rgba(21,24,27,0.10)',
  /** Tirai di belakang lembar bawah (38%). */
  scrim: 'rgba(14,16,18,0.38)',
  /** Gelembung petunjuk sekali-lihat (CoachMark): tinta gelap di mode terang, terang di mode gelap. */
  tip: '#15181B',
  /** Teks di atas `tip`. */
  onTip: '#FFFFFF',
};

export type Palette = Record<keyof typeof light, string>;

export const dark: Palette = {
  bg: '#0E1012',
  surface: '#171A1E',
  raised: '#1F2328',
  sunken: '#202328',
  sunken2: '#2A2E34',
  text: '#F2F3F5',
  muted: '#9CA1A8',
  faint: '#5E636A',
  line: '#262A30',
  tabbar: '#131619',
  voiceCanvas: '#07090B',
  brand: '#5BBF86',
  onBrand: '#0E1012',
  brandInk: '#5BBF86',
  /** Transparan supaya tetap arang di atas permukaan (≈ #21312D di atas `surface`). */
  brandSoft: 'rgba(91,191,134,0.14)',
  brandGlow: 'rgba(91,191,134,0.22)',
  ripple: 'rgba(242,243,245,0.14)',
  scrim: 'rgba(0,0,0,0.5)',
  tip: '#F2F3F5',
  onTip: '#0E1012',
};

// ---------------------------------------------------------------------------------------------------------------------
// Penanda kategori (10%), §1.3: hanya `base` (titik, garis grafik) dan `ink` (ikon, inisial). Tanpa `soft` dengan sengaja.

/** Kategori; `warn` = peringatan, hapus, Keluar, titik merekam. */
export type Category = 'agenda' | 'rumah' | 'usaha' | 'terhubung' | 'warn';
export const CATEGORIES: readonly Category[] = ['agenda', 'rumah', 'usaha', 'terhubung', 'warn'];

export interface MarkerRole {
  /** Titik, garis grafik, busur dingin AC. */
  base: string;
  /** Ikon di lingkaran netral, inisial kontak, teks peringatan kecil (AA di atas `bg`, `surface`, `sunken`). */
  ink: string;
}
export type Markers = Record<Category, MarkerRole>;

export const markerLight: Markers = {
  /** Biru: ikon kalender, titik agenda berikutnya. */
  agenda: { base: '#3B6FE0', ink: '#2F5BC4' },
  /** Oranye: ikon perangkat saja (keadaan menyala = hijau). */
  rumah: { base: '#F08A24', ink: '#A64F08' },
  /** Ungu: garis dan area grafik, titik cabang, ikon tema. */
  usaha: { base: '#7C5CE6', ink: '#6343D1' },
  /** Langit: ikon, inisial kontak, busur dingin AC. */
  terhubung: { base: '#1AA3C9', ink: '#0D6F8B' },
  /** Koral. */
  warn: { base: '#E5484D', ink: '#C8313A' },
};

export const markerDark: Markers = {
  agenda: { base: '#6E96F5', ink: '#8DADF7' },
  rumah: { base: '#F5A04F', ink: '#F5A04F' },
  usaha: { base: '#A58BFF', ink: '#B6A0FF' },
  terhubung: { base: '#4CC3E3', ink: '#4CC3E3' },
  warn: { base: '#F2777B', ink: '#F2777B' },
};

/** Teks dan tombol di atas `voiceCanvas` (Mode Suara, alarm, pemeriksa Inti). Sama di mode terang dan gelap. */
export const onVoice = {
  text: '#F2F3F5',
  /** Isian tombol "Selesai" dan geser "Matikan". */
  strong: '#F2F3F5',
  /** Teks di atas `strong`. */
  onStrong: '#0E1012',
  soft: '#9CA1A8',
  hint: '#878C94',
  label: '#C9CBCF',
  button: 'rgba(242,243,245,0.10)',
  buttonLine: 'rgba(242,243,245,0.18)',
} as const;

// ---------------------------------------------------------------------------------------------------------------------
// Gradasi, §1.4

export const gradients = {
  /** Inti: sapuan melingkar (pakai PNG atau Skia), dengan sorot putih, limau, dan bayangan biru tua. */
  inti: {
    sweep: ['#1D7550', '#159A84', '#19B3A6', '#3B6FE0', '#2A8C6A', '#1D7550'],
    highlight: '#B7E07A',
  },
  /** Titik tengah gradasi brand (daun). */
  leaf: '#4DA36E',
  /** Gelombang Mode Suara: warna brand yang dinaikkan terangnya supaya bercahaya di atas `voiceCanvas`. */
  waves: {
    green: '#2FBF7F',
    teal: '#19D3C0',
    blue: '#4F86FF',
    lime: '#C6F08A',
    periwinkle: '#7C9CFF',
    mint: '#5FE3B5',
  },
  voiceBg: '#07090B',
} as const;

/**
 * Satu elips cahaya di `GradientField`: warna di pusat dengan `opacity`, memudar ke 0 di `fade` (0..1) jari-jarinya.
 * `x` dan `y` pecahan dari lebar dan tinggi bidang (boleh di luar 0..1), `rx`/`ry` jari-jari dalam dp.
 */
export interface FieldLayer {
  color: string;
  opacity: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  fade: number;
}
/** `hero` Beranda, `cool` remote AC, `warm` lampu (cahaya lampu itu sendiri), `profile` kartu Akun. */
export type FieldRecipe = 'hero' | 'cool' | 'warm' | 'profile';
/** Tinggi bawaan tiap resep. */
export const FIELD_HEIGHT: Record<FieldRecipe, number> = { hero: 460, cool: 420, warm: 420, profile: 200 };

const MINT = '#BEE8CD';
const TEAL = '#19B3A6';

const fieldLight: Record<FieldRecipe, FieldLayer[]> = {
  hero: [
    { color: MINT, opacity: 0.95, x: 0, y: 0, rx: 360, ry: 320, fade: 0.72 },
    { color: '#4DA36E', opacity: 0.3, x: 0.62, y: -0.08, rx: 300, ry: 260, fade: 0.72 },
    { color: TEAL, opacity: 0.2, x: 1.08, y: 0.16, rx: 260, ry: 240, fade: 0.72 },
  ],
  cool: [
    { color: '#1AA3C9', opacity: 0.16, x: 0.5, y: 0.1, rx: 340, ry: 300, fade: 0.72 },
    { color: MINT, opacity: 0.6, x: 0, y: 0, rx: 300, ry: 260, fade: 0.72 },
  ],
  warm: [
    { color: '#FFBE6E', opacity: 0.4, x: 0.2, y: 0, rx: 300, ry: 260, fade: 0.72 },
    { color: '#F08A24', opacity: 0.16, x: 1, y: 0.04, rx: 260, ry: 220, fade: 0.72 },
  ],
  profile: [
    { color: MINT, opacity: 0.9, x: 1, y: 0, rx: 240, ry: 180, fade: 0.72 },
    { color: TEAL, opacity: 0.12, x: 0.75, y: -0.2, rx: 200, ry: 140, fade: 0.72 },
  ],
};

const fieldDark: Record<FieldRecipe, FieldLayer[]> = {
  hero: [
    { color: '#5BBF86', opacity: 0.2, x: 0, y: 0, rx: 340, ry: 300, fade: 0.72 },
    { color: TEAL, opacity: 0.12, x: 1.04, y: 0.1, rx: 280, ry: 240, fade: 0.72 },
  ],
  cool: [{ color: '#4CC3E3', opacity: 0.13, x: 0.5, y: 0.1, rx: 340, ry: 300, fade: 0.72 }],
  warm: [
    { color: '#FFB450', opacity: 0.18, x: 0.2, y: 0, rx: 300, ry: 260, fade: 0.72 },
    { color: '#F5A04F', opacity: 0.12, x: 1, y: 0.04, rx: 260, ry: 220, fade: 0.72 },
  ],
  profile: [{ color: '#5BBF86', opacity: 0.14, x: 1, y: 0, rx: 240, ry: 180, fade: 0.72 }],
};

// ---------------------------------------------------------------------------------------------------------------------
// Bayangan, §4: prop gaya `boxShadow` RN (New Architecture). Permukaan tanpa garis tepi; ubin menyala tanpa bayangan.

export interface Elevation {
  /** Ubin. */
  e1: string;
  /** Kartu persetujuan, kartu profil, kartu saran. */
  e2: string;
  /** Tombol remote bulat (sorot di atas + bayangan). */
  key: string;
  /** Tombol daya yang menyala (cahaya hijau). */
  power: string;
  /** Jempol segmen. */
  thumb: string;
  /** Jempol penggeser, sakelar, dial. */
  knob: string;
}

const shadowLight: Elevation = {
  e1: '0 1px 2px rgba(21,24,27,0.04), 0 6px 18px -4px rgba(21,24,27,0.08)',
  e2: '0 1px 2px rgba(21,24,27,0.04), 0 16px 36px -10px rgba(21,24,27,0.14)',
  key: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(21,24,27,0.07), 0 6px 16px -4px rgba(21,24,27,0.13)',
  power: '0 16px 32px -10px rgba(29,117,80,0.65)',
  thumb: '0 1px 2px rgba(21,24,27,0.06), 0 2px 8px -2px rgba(21,24,27,0.10)',
  knob: '0 1px 3px rgba(0,0,0,0.2), 0 4px 10px -2px rgba(21,24,27,0.18)',
};

const shadowDark: Elevation = {
  e1: 'inset 0 1px 0 rgba(255,255,255,0.035)',
  e2: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 40px -14px rgba(0,0,0,0.7)',
  key: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 4px rgba(0,0,0,0.35), 0 10px 22px -8px rgba(0,0,0,0.6)',
  power: '0 16px 32px -10px rgba(91,191,134,0.55)',
  // Jempol segmen gelap memakai `sunken2` tanpa bayangan.
  thumb: '0 0 0 rgba(0,0,0,0)',
  knob: '0 1px 3px rgba(0,0,0,0.45), 0 4px 10px -2px rgba(0,0,0,0.5)',
};

// ---------------------------------------------------------------------------------------------------------------------
// Huruf, §3: Plus Jakarta Sans, termasuk 300 untuk angka besar.

export const FONT = {
  300: 'PlusJakartaSans_300Light',
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
} as const;

/**
 * Skala huruf Fase R v2. Angka (jam, uang, suhu) memakai `tabular` di `Txt`. Kenyamanan dulu: teks isi 16, teks baca
 * tidak di bawah 14; hanya label tab, nama hari, dan VOL/CH yang 12.
 */
export const typeScale = {
  /** Suhu AC 100 (lampu 88, ubin AC 56: atur `size` di BigNumber). */
  readout: { fontSize: 100, lineHeight: 104, fontFamily: FONT[300], letterSpacing: -5 },
  /** Uang Usaha. */
  figure: { fontSize: 46, lineHeight: 52, fontFamily: FONT[600], letterSpacing: -1.8 },
  /** Sapaan (28/34 di layar compact). */
  display: { fontSize: 32, lineHeight: 38, fontFamily: FONT[600], letterSpacing: -1 },
  /** Transkrip Mode Suara. */
  transcript: { fontSize: 32, lineHeight: 42, fontFamily: FONT[500], letterSpacing: -0.64 },
  /** Judul layar tab. */
  title: { fontSize: 28, lineHeight: 34, fontFamily: FONT[600], letterSpacing: -0.7 },
  /** Judul lagu. */
  headline: { fontSize: 24, lineHeight: 30, fontFamily: FONT[600], letterSpacing: -0.5 },
  /** Kepala remote dan Akun. */
  header: { fontSize: 20, lineHeight: 26, fontFamily: FONT[600], letterSpacing: -0.3 },
  /** Kalimat contoh di kartu saran. */
  quote: { fontSize: 19, lineHeight: 26, fontFamily: FONT[600], letterSpacing: -0.2 },
  /** Judul bagian dan judul lembar. */
  section: { fontSize: 18, lineHeight: 24, fontFamily: FONT[600], letterSpacing: -0.18 },
  /** Baris daftar, butir agenda, nama di kartu persetujuan (600 untuk judul). */
  row: { fontSize: 17, lineHeight: 22, fontFamily: FONT[500] },
  /** Judul kartu/ubin. */
  subtitle: { fontSize: 16, lineHeight: 22, fontFamily: FONT[600] },
  body: { fontSize: 16, lineHeight: 24, fontFamily: FONT[400] },
  /** Cuplikan pesan (satu baris). */
  bubble: { fontSize: 16, lineHeight: 22, fontFamily: FONT[400] },
  /** Tautan, segmen, tombol. */
  label: { fontSize: 15, lineHeight: 20, fontFamily: FONT[600] },
  /** Kata keadaan dan label kecil ("Nyala", "Mati"). */
  caption: { fontSize: 14, lineHeight: 18, fontFamily: FONT[500] },
  /** Label tab, nama hari, VOL/CH. */
  micro: { fontSize: 12, lineHeight: 15, fontFamily: FONT[500] },
} as const;

export type TypeVariant = keyof typeof typeScale;

/** Batas skala huruf HP untuk teks yang sudah sangat besar dan label kecil (§3). */
export const FONT_SCALE_CAP: Partial<Record<TypeVariant, number>> = { readout: 1.1, figure: 1.1, micro: 1.2 };

// ---------------------------------------------------------------------------------------------------------------------
// Bentuk dan jarak, §4

export const radius = {
  /** Kartu persetujuan, profil, saran. */
  card: 28,
  /** Ubin perangkat. */
  tile: 26,
  /** Blok kecil (butir berikutnya di rel waktu, sisa tugas). */
  block: 20,
  /** Tombol pil 56 dp. */
  button: 28,
  composer: 28,
  rocker: 40,
  segmentTrack: 18,
  segmentThumb: 14,
  cover: 34,
  sliderVertical: 44,
  /** Sudut atas lembar bawah. */
  sheet: 30,
  /** Gelembung: kiri atas kecil (ekor), sisanya 20. */
  bubbleTail: 6,
  bubble: 20,
  round: 999,
} as const;

/** Grid 4 pt, dengan jarak lega (ruang kosong itu fitur, jangan diisi). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  /** Tepi halaman. */
  gutter: 20,
  /** Tepi kartu (isinya sejajar dengan tepi halaman). */
  cardInset: 16,
  /** Jarak antarblok. */
  block: 24,
  /** Isi kartu. */
  cardPad: 20,
  /** Jarak antarubin dan deretan geser. */
  tileGap: 12,
  /** Tinggi minimum baris daftar. */
  rowMin: 72,
  /** Kontrol utama (tombol, ubin, segmen penting). */
  hit: 56,
  /** Kontrol kedua paling kecil. */
  hitMin: 48,
  /** Tombol remote utama (60–100). */
  key: 64,
} as const;

// ---------------------------------------------------------------------------------------------------------------------
// Gerak, §5: pelan dan halus. Tanpa putaran sibuk selain Inti dan gelombang suara.

export const motion = {
  press: { scale: 0.97, keyScale: 0.94, spring: { damping: 20, stiffness: 260, mass: 0.7 } },
  /** Blok muncul: pudar + naik 12, 320 ms, jeda 80 ms bila beberapa, paling banyak 3 berurutan. */
  block: { duration: 320, stagger: 80, rise: 12, maxStagger: 3, leave: 260 },
  /** Isi layar masuk: pudar 240 ms. */
  screen: { duration: 240 },
  number: { duration: 160, shift: 6 },
  segment: { duration: 200 },
  sheet: { spring: { damping: 26, stiffness: 220 }, scrim: 220 },
  tab: { layout: 360, fade: 240 },
  coach: { duration: 280, halo: 2400 },
  voiceState: { duration: 300 },
  inti: { breath: 4200, swirl: 16000, thinking: 3200 },
  longPress: 300,
} as const;

// ---------------------------------------------------------------------------------------------------------------------
// Tema lengkap per mode

export type Scheme = 'light' | 'dark';

export interface ThemeTokens {
  scheme: Scheme;
  /** Warna netral dan brand. */
  c: Palette;
  /** Penanda kategori (titik, garis, ikon). */
  marker: Markers;
  /** Bayangan `boxShadow`. */
  shadow: Elevation;
  /** Resep `GradientField`. */
  field: Record<FieldRecipe, FieldLayer[]>;
  type: typeof typeScale;
  font: typeof FONT;
  radius: typeof radius;
  space: typeof space;
  motion: typeof motion;
  gradients: typeof gradients;
  onVoice: typeof onVoice;
}

const common = { type: typeScale, font: FONT, radius, space, motion, gradients, onVoice } as const;

export const lightTheme: ThemeTokens = {
  scheme: 'light',
  c: light,
  marker: markerLight,
  shadow: shadowLight,
  field: fieldLight,
  ...common,
};

export const darkTheme: ThemeTokens = {
  scheme: 'dark',
  c: dark,
  marker: markerDark,
  shadow: shadowDark,
  field: fieldDark,
  ...common,
};
