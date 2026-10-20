import Constants from 'expo-constants';
import { readSecure, writeSecure } from './secureStore';

/**
 * Sumber data aplikasi:
 * - `contoh`: server tiruan di dalam aplikasi (`FakeTransport`), tanpa jaringan. Bawaan.
 * - `server`: server asli di `apiUrl` (`HttpTransport`). Hanya bisa dipilih kalau `apiUrl` diisi.
 */
export type DataMode = 'contoh' | 'server';
export const DATA_MODES: readonly DataMode[] = ['contoh', 'server'];

const MODE_KEY = 'mode.data';

/**
 * Alamat server dari `app.json` `expo.extra.apiUrl`: asal saja (contoh `https://app.sekertaris.com`), tanpa `/app/v1`
 * dan tanpa garis miring di akhir. `null` kalau kosong atau bukan alamat http(s).
 */
export function readApiUrl(extra: Record<string, unknown> | undefined = Constants.expoConfig?.extra): string | null {
  const raw = extra?.apiUrl;
  if (typeof raw !== 'string') return null;
  const url = raw.trim().replace(/\/+$/, '');
  return /^https?:\/\/[^/\s]+/.test(url) ? url : null;
}

/** Mode yang berlaku: `server` hanya kalau dipilih dan `apiUrl` ada; selain itu `contoh`. */
export function resolveMode(stored: string | null, apiUrl: string | null): DataMode {
  return stored === 'server' && apiUrl ? 'server' : 'contoh';
}

/** Pilihan mode yang tersimpan, sudah disesuaikan dengan `apiUrl`. */
export async function loadMode(apiUrl: string | null): Promise<DataMode> {
  return resolveMode(await readSecure(MODE_KEY), apiUrl);
}

/** Simpan pilihan mode. `server` tanpa `apiUrl` ditolak (`false`) dan tidak disimpan. */
export async function saveMode(mode: DataMode, apiUrl: string | null): Promise<boolean> {
  if (mode === 'server' && !apiUrl) return false;
  await writeSecure(MODE_KEY, mode);
  return true;
}
