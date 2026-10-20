import type { AuthStatus } from './useAuth';
import type { DataMode } from './mode';

/**
 * Siapa yang boleh membuka sebuah layar, dipakai `app/_layout.tsx` (lewat `Stack.Protected`) dan tiruan navigasi di tes:
 * - `entry`: sapaan dan masuk (`/mulai`, `/mulai/masuk`); hanya untuk yang belum masuk;
 * - `open`: selalu terbuka, juga tanpa sesi (`/mode`: jalan keluar dari mode server yang tidak bisa dipakai);
 * - `app`: selebihnya, termasuk `/mulai/pilih` yang baru terbuka setelah kode cocok.
 */
export type RouteKind = 'app' | 'entry' | 'open';

export function routeKind(pathname: string): RouteKind {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/mulai' || path === '/mulai/masuk') return 'entry';
  if (path === '/mode') return 'open';
  return 'app';
}

/**
 * Mode `contoh` tidak memaksa masuk: semua layar terbuka. Mode `server`: layar aplikasi hanya setelah masuk, layar masuk
 * hanya sebelumnya. Selama sesi diperiksa (`checking`) tidak ada yang terbuka; akar aplikasi menahan tampilan dulu.
 */
export function canOpen(kind: RouteKind, mode: DataMode, status: AuthStatus): boolean {
  if (mode !== 'server' || kind === 'open') return true;
  if (kind === 'entry') return status === 'signedOut';
  return status === 'signedIn';
}

/** Layar tujuan bila layar yang dituju ditolak atau ditutup karena status masuk berubah. */
export const REDIRECT_APP = '/mulai';
export const REDIRECT_ENTRY = '/';
