import type { AuthStatus } from './useAuth';
import { needsSignIn, type DataMode } from './mode';

/**
 * Siapa yang boleh membuka sebuah layar, dipakai `app/_layout.tsx` (lewat `Stack.Protected`) dan tiruan navigasi di tes:
 * - `entry`: sapaan dan masuk (`/mulai`, `/mulai/masuk`); hanya untuk yang belum masuk;
 * - `open`: selalu terbuka, juga tanpa sesi (`/mode`: jalan keluar dari mode server yang tidak bisa dipakai; `/alarm`:
 *   alarm yang sedang berbunyi harus bisa dimatikan walau sesi habis, dengan judul dan Tunda/Matikan saja);
 * - `app`: selebihnya, termasuk `/mulai/pilih` yang baru terbuka setelah kode cocok.
 */
export type RouteKind = 'app' | 'entry' | 'open';

export function routeKind(pathname: string): RouteKind {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/mulai' || path === '/mulai/masuk') return 'entry';
  if (path === '/mode' || path === '/alarm') return 'open';
  return 'app';
}

/**
 * Mode `contoh` tidak memaksa masuk: semua layar terbuka. Mode `akun` dan `server`: layar aplikasi hanya setelah masuk,
 * layar masuk hanya sebelumnya. Selama sesi diperiksa (`checking`) tidak ada yang terbuka; akar aplikasi menahan tampilan
 * dulu.
 */
export function canOpen(kind: RouteKind, mode: DataMode, status: AuthStatus): boolean {
  if (!needsSignIn(mode) || kind === 'open') return true;
  if (kind === 'entry') return status === 'signedOut';
  return status === 'signedIn';
}

/** Layar tujuan bila layar yang dituju ditolak atau ditutup karena status masuk berubah. */
export const REDIRECT_APP = '/mulai';
export const REDIRECT_ENTRY = '/';
