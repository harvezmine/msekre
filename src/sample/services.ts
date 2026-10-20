import { MAIN_AC_ID } from './devices';
import type { Service } from './types';

/** Layanan tersambung, desain 2h. */
export const initialServices: Service[] = [
  {
    id: 'gcal',
    name: 'Google Kalender',
    icon: 'calendar',
    note: 'terakhir dibaca 5 menit lalu',
    permission: 'act',
    reachable: true,
    ring: { key: 'gcal', icon: 'calendar', label: 'Google Kalender' },
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: 'mail',
    note: 'terakhir dibaca 2 menit lalu',
    permission: 'act',
    reachable: true,
    ring: { key: 'gmail', icon: 'mail', label: 'Gmail' },
  },
  {
    id: 'wa',
    name: 'WhatsApp',
    icon: 'chat',
    note: 'pesan masuk langsung terbaca',
    permission: 'act',
    reachable: true,
    ring: { key: 'wa', icon: 'chat', label: 'WhatsApp' },
  },
  {
    id: 'moka',
    name: 'Moka',
    icon: 'receipt',
    note: 'terakhir dibaca 1 menit lalu',
    permission: 'read',
    reachable: true,
    ring: { key: 'kasir', icon: 'receipt', label: 'Kasir Kopi Rindang' },
  },
  {
    id: 'bca',
    name: 'Mutasi rekening BCA',
    icon: 'bank',
    note: 'terakhir dibaca 10 menit lalu',
    permission: 'read',
    reachable: true,
    ring: { key: 'bank', icon: 'bank', label: 'Bank' },
  },
  {
    id: 'kotak',
    name: 'Kotak Sekretaris AI',
    icon: 'box',
    note: 'di ruang tamu',
    permission: 'act',
    reachable: true,
  },
  {
    id: 'imou',
    name: 'Imou · CCTV',
    icon: 'camera',
    permission: 'read',
    reachable: false,
    unreachableSince: '10.12',
    ring: { key: 'cctv', icon: 'camera', label: 'CCTV' },
  },
];

export type RingSource = { service: string } | { device: string };

/**
 * Urutan simpul cincin Beranda seperti desain 1a: Google Kalender, Gmail, WhatsApp, AC kamar, CCTV, Kasir, Bank.
 * Layanan lain yang punya simpul (yang disambungkan kemudian) menyusul di belakang, sesuai urutan sambungnya.
 */
export const RING_ORDER: RingSource[] = [
  { service: 'gcal' },
  { service: 'gmail' },
  { service: 'wa' },
  { device: MAIN_AC_ID },
  { service: 'imou' },
  { service: 'moka' },
  { service: 'bca' },
];

const fresh = (s: Omit<Service, 'note' | 'permission' | 'reachable'>): Service => ({
  ...s,
  note: 'baru tersambung',
  permission: 'read',
  reachable: true,
});

/** Layanan yang bisa disambungkan (desain 2h), dalam keadaan setelah tersambung. */
export const serviceCatalog: Record<string, Service> = {
  m365: fresh({
    id: 'm365',
    name: 'Microsoft 365',
    icon: 'mail',
    ring: { key: 'm365', icon: 'mail', label: 'Microsoft 365' },
  }),
  notion: fresh({ id: 'notion', name: 'Notion', icon: 'note', ring: { key: 'notion', icon: 'note', label: 'Notion' } }),
  rapat: fresh({
    id: 'rapat',
    name: 'Pencatat rapat Zoom, Meet, Teams',
    icon: 'camera',
    ring: { key: 'rapat', icon: 'camera', label: 'Pencatat rapat' },
  }),
  plaud: fresh({ id: 'plaud', name: 'Plaud', icon: 'mic', ring: { key: 'plaud', icon: 'mic', label: 'Plaud' } }),
  github: fresh({
    id: 'github',
    name: 'GitHub',
    icon: 'globe',
    ring: { key: 'github', icon: 'globe', label: 'GitHub' },
  }),
  tiktok: fresh({
    id: 'tiktok',
    name: 'TikTok Shop & Tokopedia',
    icon: 'bag',
    ring: { key: 'tiktok', icon: 'bag', label: 'TikTok Shop' },
  }),
  accurate: fresh({
    id: 'accurate',
    name: 'Accurate',
    icon: 'bank',
    ring: { key: 'accurate', icon: 'bank', label: 'Accurate' },
  }),
};

/** Layanan menurut id, baik yang sedang tersambung maupun yang ada di katalog 2h. */
export function serviceDef(id: string): Service | undefined {
  return serviceCatalog[id] ?? initialServices.find((s) => s.id === id);
}

/** Keterangan tampilan satu layanan: ikon huruf, alamat halaman masuk, isi "Yang bisa Nadia lakukan", dan kalimat sambutan. */
export interface ServiceInfo {
  /** Huruf di ubin daftar "Sambungkan" (desain 2h). */
  mono: string;
  /** Alamat halaman masuk resmi (desain 2j). */
  domain: string;
  /** Tiga hal yang bisa dilakukan (desain 2i). */
  can: [string, string, string];
  /** Kalimat izin "Boleh bertindak" yang menyebut apa yang boleh diubah. */
  act: string;
  /** Kalimat di bawah judul layar tersambung (desain 2k). */
  joined: string;
}

export const serviceInfo: Record<string, ServiceInfo> = {
  gcal: {
    mono: 'GK',
    domain: 'calendar.google.com',
    can: [
      'Membaca jadwal Anda supaya agenda hari ini selalu lengkap.',
      'Mengingatkan Anda sebelum rapat dimulai.',
      'Menambah atau memindah jadwal, kalau Anda minta.',
    ],
    act: 'Nadia boleh menambah dan memindah jadwal, selalu dengan persetujuan Anda.',
    joined: 'Mulai sekarang jadwal Anda ikut masuk ke agenda.',
  },
  gmail: {
    mono: 'Gm',
    domain: 'mail.google.com',
    can: [
      'Membaca surel masuk dan memberi tahu yang penting.',
      'Meringkas surel yang panjang.',
      'Menyiapkan balasan untuk Anda setujui.',
    ],
    act: 'Nadia boleh mengirim balasan, selalu dengan persetujuan Anda.',
    joined: 'Mulai sekarang saya kabari surel yang penting.',
  },
  wa: {
    mono: 'WA',
    domain: 'web.whatsapp.com',
    can: [
      'Membaca pesan masuk dan memberi tahu yang perlu dijawab.',
      'Menyiapkan balasan untuk Anda setujui.',
      'Mengirim pesan ke kontak yang Anda minta.',
    ],
    act: 'Nadia boleh mengirim pesan, selalu dengan persetujuan Anda.',
    joined: 'Mulai sekarang saya kabari pesan yang perlu dijawab.',
  },
  moka: {
    mono: 'Mk',
    domain: 'backoffice.mokapos.com',
    can: [
      'Melihat penjualan tiap kedai, kapan saja Anda tanya.',
      'Memberi tahu Anda kalau stok mulai menipis.',
      'Membuat laporan penjualan harian dan mingguan.',
    ],
    act: 'Nadia boleh mengubah stok dan harga, selalu dengan persetujuan Anda.',
    joined: 'Mulai sekarang saya kabari penjualan dan stok yang menipis.',
  },
  bca: {
    mono: 'BCA',
    domain: 'klikbca.com',
    can: [
      'Membaca uang masuk dan keluar di rekening Anda.',
      'Memberi tahu Anda kalau ada pembayaran besar yang masuk.',
      'Mencocokkan pembayaran dengan pesanan.',
    ],
    act: 'Nadia boleh menyiapkan pembayaran, selalu dengan persetujuan dan PIN Anda.',
    joined: 'Mulai sekarang saya kabari uang yang masuk.',
  },
  kotak: {
    mono: 'Kt',
    domain: 'kotak.sekretaris.ai',
    can: [
      'Mendengar perintah suara di ruangan tempat Kotak berada.',
      'Mengatur AC dan perangkat dengan inframerah.',
      'Menyuarakan pengingat dan alarm.',
    ],
    act: 'Nadia boleh mengatur perangkat lewat Kotak, kecuali yang dijaga PIN.',
    joined: 'Mulai sekarang Kotak ikut mendengar dan membantu di rumah.',
  },
  imou: {
    mono: 'Im',
    domain: 'imoulife.com',
    can: [
      'Memberi tahu Anda kalau kamera tidak terjangkau.',
      'Memberi tahu Anda kalau ada gerakan yang tidak biasa.',
      'Menampilkan keadaan kamera, kalau Anda tanya.',
    ],
    act: 'Nadia boleh menyalakan dan mematikan kamera, dengan PIN Anda.',
    joined: 'Mulai sekarang saya kabari kalau kamera bermasalah.',
  },
  m365: {
    mono: 'M',
    domain: 'login.microsoftonline.com',
    can: [
      'Membaca surel dan jadwal Outlook Anda.',
      'Memberi tahu Anda surel dan undangan yang penting.',
      'Menyiapkan balasan untuk Anda setujui.',
    ],
    act: 'Nadia boleh membalas surel dan menjawab undangan, selalu dengan persetujuan Anda.',
    joined: 'Mulai sekarang saya kabari surel dan undangan yang penting.',
  },
  notion: {
    mono: 'N',
    domain: 'notion.so',
    can: [
      'Membaca catatan dan halaman yang Anda bagikan.',
      'Menemukan catatan lama kalau Anda tanya.',
      'Menyimpan notulen rapat ke halaman Anda.',
    ],
    act: 'Nadia boleh membuat dan mengubah halaman, selalu dengan persetujuan Anda.',
    joined: 'Mulai sekarang notulen dan catatan Anda bisa saya cari dan simpan.',
  },
  rapat: {
    mono: 'Rp',
    domain: 'calendar.google.com',
    can: [
      'Ikut rapat Zoom, Meet, atau Teams dan mencatatnya.',
      'Membuat notulen dan daftar tugas setelah rapat.',
      'Mengirim ringkasan rapat kepada Anda.',
    ],
    act: 'Nadia boleh bergabung ke rapat atas nama Anda, selalu dengan persetujuan Anda.',
    joined: 'Mulai sekarang saya siap mencatat rapat Anda.',
  },
  plaud: {
    mono: 'P',
    domain: 'app.plaud.ai',
    can: [
      'Menerima rekaman dari Plaud Anda.',
      'Mengubah rekaman menjadi notulen yang rapi.',
      'Menemukan isi rekaman lama kalau Anda tanya.',
    ],
    act: 'Nadia boleh menyimpan notulen ke layanan lain, selalu dengan persetujuan Anda.',
    joined: 'Mulai sekarang rekaman Plaud Anda jadi notulen.',
  },
  github: {
    mono: 'GH',
    domain: 'github.com',
    can: [
      'Membaca kemajuan di repositori yang Anda pilih.',
      'Memberi tahu Anda kalau ada permintaan yang perlu ditinjau.',
      'Meringkas perubahan terbaru.',
    ],
    act: 'Nadia boleh menulis komentar, selalu dengan persetujuan Anda.',
    joined: 'Mulai sekarang saya kabari permintaan yang perlu Anda tinjau.',
  },
  tiktok: {
    mono: 'TT',
    domain: 'seller.tiktokshop.com',
    can: [
      'Memberi tahu Anda kalau ada pesanan baru.',
      'Mengingatkan pesanan yang perlu dikirim.',
      'Membuat ringkasan penjualan harian.',
    ],
    act: 'Nadia boleh membalas pembeli dan mengubah stok, selalu dengan persetujuan Anda.',
    joined: 'Mulai sekarang saya kabari pesanan baru dan yang perlu dikirim.',
  },
  accurate: {
    mono: 'Ac',
    domain: 'accurate.id',
    can: [
      'Membaca faktur dan pembayaran yang masuk.',
      'Memberi tahu Anda kalau ada tagihan yang jatuh tempo.',
      'Membuat ringkasan keuangan bulanan.',
    ],
    act: 'Nadia boleh menyiapkan faktur, selalu dengan persetujuan Anda.',
    joined: 'Mulai sekarang saya kabari tagihan yang jatuh tempo.',
  },
};

/** Kelompok "Sambungkan" di daftar Terhubung (desain 2h). */
export const serviceGroups: { title: string; ids: string[] }[] = [
  { title: 'Kerja', ids: ['m365', 'notion', 'rapat', 'plaud', 'github'] },
  { title: 'Usaha', ids: ['tiktok', 'accurate'] },
];
