/**
 * Penanda "halaman masuk resmi sedang terbuka". Di Android alamat kembali (`sekretarisai://terhubung/tersambung?...`)
 * sampai dua kali ke aplikasi yang sudah berjalan: sebagai hasil `openAuthSessionAsync` dan sebagai tautan masuk ke
 * router. `app/+native-intent.tsx` membuang yang kedua selama penanda ini menyala, jadi hanya `connect()` yang
 * menyelesaikan alur. Setelah sesi berakhir penanda bertahan sebentar (tautan bisa tiba sesudah hasilnya). Aplikasi
 * yang dimulai dingin oleh tautan itu (proses dibunuh saat di Custom Tab) tidak punya penanda dan tetap diarahkan ke
 * layar Tersambung.
 */
export const AUTH_GRACE_MS = 2000;

let active = 0;
let graceUntil = 0;

export function beginAuthSession() {
  active += 1;
}

export function endAuthSession(now: number = Date.now()) {
  active = Math.max(0, active - 1);
  graceUntil = now + AUTH_GRACE_MS;
}

export function isAuthSessionPending(now: number = Date.now()): boolean {
  return active > 0 || now < graceUntil;
}

/** Hanya untuk tes. */
export function resetAuthSession() {
  active = 0;
  graceUntil = 0;
}
