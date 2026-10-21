/** Berapa lama aplikasi di latar sebelum layar pembuka tampil lagi saat dibuka kembali (30 menit). */
export const RESUME_MIN_MS = 30 * 60 * 1000;

const ALARM = /^(?:[a-z][a-z0-9+.-]*:\/\/)?\/*alarm(?:[/?#]|$)/i;

/** Apakah alamat (tautan `sekretarisai://alarm?id=` atau jalur `/alarm`) menuju layar alarm. */
export function isAlarmTarget(target: string | null | undefined): boolean {
  return typeof target === 'string' && ALARM.test(target);
}

/**
 * Mulai dingin: layar pembuka dilewati kalau aplikasi dibuka dari alarm (tautan awal) atau dari ketukan notifikasi,
 * karena dua-duanya harus langsung sampai ke tujuannya.
 */
export function skipOnLaunch(input: {
  initialUrl: string | null | undefined;
  hasNotificationResponse: boolean;
}): boolean {
  return isAlarmTarget(input.initialUrl) || input.hasNotificationResponse;
}

/**
 * Kembali dari latar: tampil lagi hanya kalau di latar sedikitnya 30 menit (berpindah sebentar, misalnya menyalin
 * kode WhatsApp, tidak) dan layar alarm tidak sedang terbuka.
 */
export function showOnResume(input: {
  backgroundedAt: number | null;
  now: number;
  pathname: string | null | undefined;
}): boolean {
  if (input.backgroundedAt === null) return false;
  if (isAlarmTarget(input.pathname)) return false;
  return input.now - input.backgroundedAt >= RESUME_MIN_MS;
}
