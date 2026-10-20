import { isApiFailure } from './transport';

/** Teks gagal umum. Kode error tidak pernah ditampilkan. */
export const ERROR_TEXT = 'Lagi ada kendala, sudah dilaporkan ke tim. Coba lagi sebentar ya.';
export const WRONG_CODE_TEXT = 'Kodenya belum cocok. Coba cek lagi pesan WhatsApp-nya.';

/** Teks ramah untuk kegagalan apa pun dari transport (atau error lain yang tidak terduga). */
export function friendlyError(e: unknown): string {
  if (isApiFailure(e) && e.code === 'kode_salah') return WRONG_CODE_TEXT;
  return ERROR_TEXT;
}
