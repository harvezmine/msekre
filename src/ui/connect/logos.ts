import type { ImageSourcePropType } from 'react-native';
import type { IconName } from '../icons';
import { LOGO_XML } from './logoXml';

/**
 * Satu tempat pemetaan layanan -> logo (Terhubung, Akun, Keamanan, Usaha). Logo asli dari landing dan Simple Icons
 * (lihat scripts/make-logos.mjs). Merek yang tidak punya logo bebas pakai: ubin huruf dengan warna mereknya.
 *
 * - `svg`: logo vektor (`SvgXml`). `mono`: warna merek logo satu warna (`currentColor`); di mode gelap logo itu memakai
 *   warna teks (versi putih), supaya merek bertinta gelap (GitHub, TikTok, LG, Samsung, Hue) tetap terbaca.
 * - `png`: logo gambar. `mono`: gambar hitam yang di mode gelap diwarnai ulang (tint) dengan warna teks.
 * - `mark`: tanda S Sekretaris AI (asisten sendiri dan Kotak).
 * - `stack`: beberapa logo kecil dalam satu ubin (pencatat rapat Zoom, Meet, Teams).
 * - `initial`: ubin berwarna merek dengan huruf putih (merek tanpa logo bebas pakai).
 * `scale`: luas logo di dalam ubin (pecahan sisi ubin), untuk menyamakan berat visual logo lebar atau penuh.
 */
export type LogoDef =
  | { kind: 'svg'; key: string; xml: string; scale: number; mono?: string }
  | { kind: 'png'; key: string; source: ImageSourcePropType; scale: number; mono?: boolean }
  | { kind: 'mark'; key: 'sekretaris'; scale: number }
  | { kind: 'stack'; key: string; parts: LogoDef[] }
  | { kind: 'initial'; key: string; text: string; color: string | null };

const svg = (key: string, file: keyof typeof LOGO_XML, scale = 0.62, mono?: string): LogoDef => ({
  kind: 'svg',
  key,
  xml: LOGO_XML[file],
  scale,
  ...(mono ? { mono } : {}),
});
const initial = (key: string, text: string, color: string): LogoDef => ({ kind: 'initial', key, text, color });

/** Semua logo yang dikenal aplikasi, menurut kuncinya (kunci = `testID` `logo-<kunci>`). */
export const LOGOS = {
  gcal: svg('gcal', 'google-calendar', 0.6),
  gmail: svg('gmail', 'gmail', 0.6),
  wa: svg('wa', 'whatsapp', 0.64),
  gdrive: svg('gdrive', 'google-drive', 0.62),
  meet: svg('meet', 'google-meet', 0.62),
  zoom: svg('zoom', 'zoom', 0.62),
  teams: svg('teams', 'microsoft-teams', 0.62),
  notion: svg('notion', 'notion', 0.6),
  m365: svg('m365', 'microsoft', 0.5),
  github: svg('github', 'github', 0.6, '#181717'),
  tiktok: svg('tiktok', 'tiktok', 0.64, '#000000'),
  instagram: svg('instagram', 'instagram', 0.6),
  shopee: svg('shopee', 'shopee', 0.62),
  gojek: svg('gojek', 'gojek', 0.6),
  grab: svg('grab', 'grab', 0.78),
  smartthings: svg('smartthings', 'smartthings', 0.62),
  homeassistant: svg('homeassistant', 'homeassistant', 0.62),
  imou: svg('imou', 'imou', 0.7),
  lg: svg('lg', 'lg', 0.66, '#A50034'),
  samsung: svg('samsung', 'samsung', 0.86, '#1428A0'),
  hue: svg('hue', 'philipshue', 0.7, '#0065D3'),
  plaud: { kind: 'png', key: 'plaud', source: require('../../../assets/logos/plaud.png'), scale: 0.74, mono: true },
  tokopedia: { kind: 'png', key: 'tokopedia', source: require('../../../assets/logos/tokopedia.png'), scale: 0.66 },
  sekretaris: { kind: 'mark', key: 'sekretaris', scale: 0.56 },
  // Tanpa logo bebas pakai: huruf putih di atas warna merek (diambil dari situs resminya).
  moka: initial('moka', 'm', '#0054A5'),
  accurate: initial('accurate', 'A', '#ED3B69'),
  bca: initial('bca', 'BCA', '#0060AF'),
  moota: initial('moota', 'M', '#4465F0'),
} satisfies Record<string, LogoDef>;

export type LogoKey = keyof typeof LOGOS;

const RAPAT: LogoDef = { kind: 'stack', key: 'rapat', parts: [LOGOS.zoom, LOGOS.meet, LOGOS.teams] };
/** Merek perangkat rumah (Tambah perangkat). */
const MEREK: LogoDef = { kind: 'stack', key: 'merek', parts: [LOGOS.lg, LOGOS.smartthings, LOGOS.hue] };

/** id layanan (dan nama lain yang mungkin dipakai server) -> logo. */
const BY_ID: Record<string, LogoDef> = {
  ...LOGOS,
  google_calendar: LOGOS.gcal,
  googlecalendar: LOGOS.gcal,
  google_mail: LOGOS.gmail,
  whatsapp: LOGOS.wa,
  google_drive: LOGOS.gdrive,
  drive: LOGOS.gdrive,
  google_meet: LOGOS.meet,
  microsoft: LOGOS.m365,
  microsoft365: LOGOS.m365,
  outlook: LOGOS.m365,
  tiktok_shop: LOGOS.tiktok,
  tiktokshop: LOGOS.tiktok,
  home_assistant: LOGOS.homeassistant,
  philipshue: LOGOS.hue,
  philips_hue: LOGOS.hue,
  gofood: LOGOS.gojek,
  grabfood: LOGOS.grab,
  kotak: LOGOS.sekretaris,
  rapat: RAPAT,
  meeting: RAPAT,
  merek: MEREK,
};

/** Kata di nama layanan -> logo, untuk id dari server yang belum dikenal aplikasi. Urutan penting (yang khusus dulu). */
const BY_NAME: [RegExp, LogoDef][] = [
  [/zoom.*meet|meet.*teams|pencatat rapat/i, RAPAT],
  [/kalender|calendar/i, LOGOS.gcal],
  [/gmail/i, LOGOS.gmail],
  [/whatsapp/i, LOGOS.wa],
  [/drive/i, LOGOS.gdrive],
  [/notion/i, LOGOS.notion],
  [/microsoft|outlook/i, LOGOS.m365],
  [/github/i, LOGOS.github],
  [/tiktok/i, LOGOS.tiktok],
  [/tokopedia/i, LOGOS.tokopedia],
  [/instagram/i, LOGOS.instagram],
  [/shopee/i, LOGOS.shopee],
  [/gofood|gojek/i, LOGOS.gojek],
  [/grab/i, LOGOS.grab],
  [/smartthings/i, LOGOS.smartthings],
  [/home assistant/i, LOGOS.homeassistant],
  [/imou/i, LOGOS.imou],
  [/philips|hue/i, LOGOS.hue],
  [/^lg\b/i, LOGOS.lg],
  [/samsung/i, LOGOS.samsung],
  [/plaud/i, LOGOS.plaud],
  [/moka/i, LOGOS.moka],
  [/accurate/i, LOGOS.accurate],
  [/moota/i, LOGOS.moota],
  [/\bbca\b/i, LOGOS.bca],
  [/kotak|sekretaris/i, LOGOS.sekretaris],
];

/** Huruf ubin cadangan: huruf pertama dua kata pertama ("Layanan Baru" -> "LB", "Notion" -> "No"). */
export function monoOf(name: string): string {
  const words = name.split(/[\s·&]+/).filter(Boolean);
  if (words.length >= 2) return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  return name.slice(0, 2);
}

/**
 * Logo satu layanan: menurut id dulu, lalu menurut namanya, lalu ubin huruf netral (warna huruf dari penanda kategori,
 * dipilih komponen menurut nama). Tidak pernah lingkaran abu-abu kosong.
 */
export function logoFor(id: string, name?: string): LogoDef {
  const key = id.trim().toLowerCase();
  const found = BY_ID[key] ?? BY_ID[key.replace(/[\s-]+/g, '_')];
  if (found) return found;
  if (name) {
    for (const [re, def] of BY_NAME) if (re.test(name)) return def;
  }
  return { kind: 'initial', key: 'huruf', text: monoOf(name || id), color: null };
}

/** Nama pendek di kartu Terhubung (nama lengkap tetap dibacakan pembaca layar). */
const CARD_NAME: Record<string, string> = {
  rapat: 'Pencatat rapat',
  tiktok: 'TikTok Shop',
  bca: 'Rekening BCA',
  imou: 'Imou CCTV',
  kotak: 'Kotak',
};

export const cardName = (id: string, name: string): string => CARD_NAME[id] ?? name;

/** Ikon kecil untuk satu kalimat "yang bisa dilakukan" (kata kunci sederhana; tidak dikenal = centang). */
const CAPABILITY_ICON: [RegExp, IconName][] = [
  [/email|surel/i, 'mail'],
  [/rapat|jadwal|kalender|agenda/i, 'calendar'],
  [/notulen|catatan|halaman/i, 'note'],
  [/rekam/i, 'mic'],
  [/berkas|dokumen|laporan|faktur/i, 'file'],
  [/pesanan|kirim barang|dikirim/i, 'bag'],
  [/stok|penjualan|kasir/i, 'receipt'],
  [/uang|bayar|pembayaran|mutasi|tagihan|rekening/i, 'bank'],
  [/kamera|cctv|gerakan/i, 'camera'],
  [/lampu|perangkat|rumah|colokan|ac\b/i, 'home'],
  [/pesan|balas|chat/i, 'chat'],
  [/ingat|kabar|beri tahu|memberi tahu/i, 'bell'],
  [/cari|temukan|menemukan/i, 'globe'],
];

export function capabilityIcon(line: string): IconName {
  for (const [re, icon] of CAPABILITY_ICON) if (re.test(line)) return icon;
  return 'check';
}
