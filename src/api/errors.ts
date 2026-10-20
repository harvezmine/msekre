import { isApiFailure } from './transport';

/** Teks gagal umum. Kode error tidak pernah ditampilkan. */
export const ERROR_TEXT = 'Lagi ada kendala, sudah dilaporkan ke tim. Coba lagi sebentar ya.';
export const WRONG_CODE_TEXT = 'Kodenya belum cocok. Coba cek lagi pesan WhatsApp-nya.';
export const BLOCKED_TEXT = 'Akun ini sedang tidak aktif. Hubungi tim Sekretaris AI lewat WhatsApp.';
export const UPGRADE_TEXT = 'Ada versi aplikasi yang lebih baru. Perbarui dulu ya.';
export const UNAVAILABLE_TEXT = 'Kendali perangkat dari chat segera hadir.';
export const NOT_REGISTERED_TEXT = 'Nomor ini belum memakai Sekretaris AI. Mulai dulu lewat WhatsApp ya.';
export const WRONG_PIN_TEXT = 'PIN belum cocok, coba lagi.';
export const TOO_OFTEN_TEXT = 'Tunggu sebentar ya, lalu coba lagi.';

/** "Tunggu sebentar ya, coba lagi dalam {n} detik." */
export const tooOftenText = (retryInSec: number) => `Tunggu sebentar ya, coba lagi dalam ${retryInSec} detik.`;

/** Teks ramah untuk kegagalan apa pun dari transport (atau error lain yang tidak terduga). */
export function friendlyError(e: unknown): string {
  if (!isApiFailure(e)) return ERROR_TEXT;
  switch (e.code) {
    case 'kode_salah':
      return WRONG_CODE_TEXT;
    case 'blocked':
      return BLOCKED_TEXT;
    case 'not_registered':
      return NOT_REGISTERED_TEXT;
    case 'pin_wrong':
      return WRONG_PIN_TEXT;
    case 'upgrade_required':
      return UPGRADE_TEXT;
    case 'unavailable':
      return UNAVAILABLE_TEXT;
    case 'rate_limited':
      return e.retryInSec === undefined ? TOO_OFTEN_TEXT : tooOftenText(Math.max(1, Math.ceil(e.retryInSec)));
    default:
      return ERROR_TEXT;
  }
}

/** Batalkan ditekan setelah kirimannya keluar. */
export const DRAFT_SENT_TEXT = 'Kirimannya sudah terkirim, jadi tidak bisa dibatalkan lagi.';
/** Aksi pada draf yang sudah berubah di tempat lain (WhatsApp, atau jam tahan habis). */
export const DRAFT_CHANGED_TEXT = 'Draf ini sudah berubah. Saya tampilkan keadaan terbarunya.';
/** Berkas gagal diunduh (sinyal, atau berkasnya sudah tidak ada). */
export const FILE_DOWNLOAD_TEXT = 'Berkasnya belum bisa diunduh. Coba lagi sebentar ya.';
/** HP tidak punya aplikasi yang bisa membuka jenis berkas ini (dan lembar bagikan pun tidak tersedia). */
export const FILE_NO_APP_TEXT = 'Tidak ada aplikasi di HP ini yang bisa membuka berkas ini.';
