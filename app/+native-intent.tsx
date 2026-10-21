import { isAuthSessionPending } from '@/api/authSession';

/**
 * Tautan yang masuk dari sistem. Alamat kembali halaman masuk resmi yang tiba saat aplikasi sudah berjalan dan sesi
 * masuknya masih dinanti dibuang (mengembalikan `null` = tetap di layar sekarang): `connect()` yang menyelesaikan alur
 * dari hasil sesinya, jadi layar Tersambung tidak dibuka dua kali. Mulai dingin (`initial`) dan semua tautan lain
 * tetap diteruskan.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  if (!initial && isAuthSessionPending() && /\/terhubung\/tersambung(\?|#|$)/.test(path)) return null;
  return path;
}
