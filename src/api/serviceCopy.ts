/**
 * Keterangan tampilan per layanan yang dibawa aplikasi sendiri: alamat halaman masuk resmi (dipajang di lembar
 * Sambungkan) dan kalimat sambutan di layar tersambung. Isi layanannya (nama, izin, catatan) datang dari server.
 */
const DOMAIN: Record<string, string> = {
  gcal: 'calendar.google.com',
  gmail: 'mail.google.com',
  wa: 'web.whatsapp.com',
  moka: 'backoffice.mokapos.com',
  bca: 'klikbca.com',
  kotak: 'kotak.sekretaris.ai',
  imou: 'imoulife.com',
  m365: 'login.microsoftonline.com',
  notion: 'notion.so',
  rapat: 'calendar.google.com',
  plaud: 'app.plaud.ai',
  github: 'github.com',
  tiktok: 'seller.tiktokshop.com',
  accurate: 'accurate.id',
  gdrive: 'drive.google.com',
  smartthings: 'account.smartthings.com',
  homeassistant: 'home-assistant.io',
};

const JOINED: Record<string, string> = {
  gcal: 'Mulai sekarang jadwal Anda ikut masuk ke agenda.',
  gmail: 'Mulai sekarang saya kabari email yang penting.',
  wa: 'Mulai sekarang saya kabari pesan yang perlu dijawab.',
  moka: 'Mulai sekarang saya kabari penjualan dan stok yang menipis.',
  bca: 'Mulai sekarang saya kabari uang yang masuk.',
  kotak: 'Mulai sekarang Kotak ikut mendengar dan membantu di rumah.',
  imou: 'Mulai sekarang saya kabari kalau kamera bermasalah.',
  m365: 'Mulai sekarang saya kabari email dan undangan yang penting.',
  notion: 'Mulai sekarang notulen dan catatan Anda bisa saya cari dan simpan.',
  rapat: 'Mulai sekarang saya siap mencatat rapat Anda.',
  plaud: 'Mulai sekarang rekaman Plaud Anda jadi notulen.',
  github: 'Mulai sekarang saya kabari permintaan yang perlu Anda tinjau.',
  tiktok: 'Mulai sekarang saya kabari pesanan baru dan yang perlu dikirim.',
  accurate: 'Mulai sekarang saya kabari tagihan yang jatuh tempo.',
  gdrive: 'Mulai sekarang berkas di Drive bisa saya cari dan ringkas.',
  smartthings: 'Mulai sekarang perangkat Samsung Anda ikut masuk ke Rumah.',
  homeassistant: 'Mulai sekarang perangkat di Home Assistant ikut masuk ke Rumah.',
};

export const serviceDomain = (id: string): string | undefined => DOMAIN[id];

export const serviceJoined = (id: string): string | undefined => JOINED[id];
