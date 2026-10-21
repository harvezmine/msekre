/**
 * Pilihan pratinjau dari alamat halaman, hanya saat pengembangan (`scripts/shots.mjs`):
 * - `contoh=baru`: data contoh pengguna baru (belum ada perangkat, agenda, kiriman, atau usaha);
 * - `petunjuk=0|1`: petunjuk Inti dianggap sudah dilihat atau belum.
 */
export function devQuery(): Record<string, string> {
  if (!__DEV__ || typeof window === 'undefined' || !window.location) return {};
  return Object.fromEntries(new URLSearchParams(window.location.search));
}
