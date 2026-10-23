import Constants from 'expo-constants';
import { readSecure, writeSecure } from './secureStore';

/**
 * Sumber data aplikasi:
 * - `contoh`: server tiruan di dalam aplikasi (`FakeTransport`), tanpa jaringan dan tanpa masuk;
 * - `akun`: akun asli pengguna (`HybridTransport`). Masuk dengan kode WhatsApp; chat, Mode Suara, dan Agenda memakai server
 *   asli, layar yang belum disediakan server (Perangkat, Usaha, Terhubung, Riwayat, sebagian Akun) memakai data contoh
 *   dengan penanda "Contoh". Bawaan build rilis (`apiUrl` diisi);
 * - `server`: semuanya dari server asli (`HttpTransport`), juga jalur yang masih dibalas 501. Hanya untuk pengembangan.
 * `akun` dan `server` hanya bisa dipakai kalau `apiUrl` diisi.
 */
export type DataMode = 'contoh' | 'akun' | 'server';
export const DATA_MODES: readonly DataMode[] = ['contoh', 'akun', 'server'];

const MODE_KEY = 'mode.data';

/** Nama mode untuk pengguna (baris Data di Akun, lembar mode pengembangan). */
export const MODE_LABEL: Record<DataMode, string> = { contoh: 'Contoh', akun: 'Akun Anda', server: 'Server' };

/** Mode yang memakai akun asli: layar aplikasi hanya setelah masuk dengan nomor WhatsApp. */
export function needsSignIn(mode: DataMode): boolean {
  return mode !== 'contoh';
}

/**
 * Layar di luar chat dan Mode Suara berisi data contoh (`contoh`, dan `akun` untuk layar yang belum disediakan server):
 * alur tiruan dipakai, misalnya menyambungkan layanan selesai sendiri dan kode lupa PIN boleh 6 angka apa saja.
 */
export function sampleDomains(mode: DataMode): boolean {
  return mode !== 'server';
}

/**
 * Alamat server dari `app.config.ts` `extra.apiUrl` (dari `EXPO_PUBLIC_API_URL`): asal saja (contoh `https://app.sekertaris.com`), tanpa `/app/v1`
 * dan tanpa garis miring di akhir. `null` kalau kosong atau bukan alamat http(s).
 */
export function readApiUrl(extra: Record<string, unknown> | undefined = Constants.expoConfig?.extra): string | null {
  const raw = extra?.apiUrl;
  if (typeof raw !== 'string') return null;
  const url = raw.trim().replace(/\/+$/, '');
  return /^https?:\/\/[^/\s]+/.test(url) ? url : null;
}

/**
 * Mode yang berlaku. Tanpa `apiUrl` selalu `contoh`. Dengan `apiUrl`: `contoh` kalau itu yang dipilih, `server` kalau
 * dipilih di build pengembangan, selain itu `akun` (juga pemasangan baru, yang belum pernah memilih).
 */
export function resolveMode(stored: string | null, apiUrl: string | null, dev: boolean = __DEV__): DataMode {
  if (!apiUrl) return 'contoh';
  if (stored === 'contoh') return 'contoh';
  if (stored === 'server' && dev) return 'server';
  return 'akun';
}

/** Pilihan mode yang tersimpan, sudah disesuaikan dengan `apiUrl`. */
export async function loadMode(apiUrl: string | null): Promise<DataMode> {
  return resolveMode(await readSecure(MODE_KEY), apiUrl);
}

/** Simpan pilihan mode. `akun` dan `server` tanpa `apiUrl` ditolak (`false`) dan tidak disimpan. */
export async function saveMode(mode: DataMode, apiUrl: string | null): Promise<boolean> {
  if (needsSignIn(mode) && !apiUrl) return false;
  await writeSecure(MODE_KEY, mode);
  return true;
}
