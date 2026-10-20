import { requireOptionalNativeModule } from 'expo';
import type * as SecureStoreModule from 'expo-secure-store';

let loaded: typeof SecureStoreModule | null | undefined;

/**
 * `expo-secure-store`, atau `null` kalau modul native-nya belum ada di build (development build lama). Dimuat saat
 * pertama dipakai, bukan saat aplikasi mulai, supaya build tanpa modul itu tetap terbuka: sesi dan pilihan mode
 * hanya tidak tersimpan setelah aplikasi ditutup.
 */
export function secureStore(): typeof SecureStoreModule | null {
  if (loaded === undefined) {
    try {
      if (!requireOptionalNativeModule('ExpoSecureStore')) loaded = null;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      else loaded = require('expo-secure-store') as typeof SecureStoreModule;
    } catch {
      loaded = null;
    }
  }
  return loaded;
}

let warnedMemory = false;

/** Sekali per proses, hanya saat pengembangan: tanpa modul native, sesi dan mode hanya hidup di memori. */
function warnMemoryFallback() {
  if (!__DEV__ || warnedMemory) return;
  warnedMemory = true;
  console.warn(
    'expo-secure-store tidak ada di build ini: sesi dan mode hanya disimpan di memori (hilang saat aplikasi ditutup).',
  );
}

/** Baca nilai; `null` kalau tidak ada, modulnya tidak ada, atau penyimpanan HP menolak. */
export async function readSecure(key: string): Promise<string | null> {
  const store = secureStore();
  if (!store) {
    warnMemoryFallback();
    return null;
  }
  try {
    // Nilai kosong ditulis {@link writeSecure} saat menghapus gagal: dianggap tidak ada.
    return (await store.getItemAsync(key)) || null;
  } catch {
    return null;
  }
}

/**
 * Tulis nilai (`null` menghapus). Gagal menyimpan tidak dilempar: nilainya hanya tidak bertahan setelah aplikasi
 * ditutup. Hasilnya `true` kalau tersimpan atau terhapus. Menghapus yang gagal diulang sekali; kalau masih gagal, nilai
 * lamanya ditimpa dengan teks kosong (dibaca sebagai tidak ada) supaya token lama tidak hidup lagi, dan hasilnya `false`.
 */
export async function writeSecure(key: string, value: string | null): Promise<boolean> {
  const store = secureStore();
  if (!store) {
    warnMemoryFallback();
    return false;
  }
  try {
    if (value === null) await deleteWithRetry(store, key);
    else await store.setItemAsync(key, value);
    return true;
  } catch {
    // Penyimpanan HP menolak (misalnya kunci rusak setelah pasang ulang); nilai tetap dipakai dari memori.
    if (__DEV__) console.warn(`secure-store: gagal ${value === null ? 'menghapus' : 'menyimpan'} "${key}"`);
    return false;
  }
}

async function deleteWithRetry(store: typeof SecureStoreModule, key: string) {
  try {
    await store.deleteItemAsync(key);
  } catch {
    try {
      await store.deleteItemAsync(key);
    } catch (e) {
      // Terakhir: timpa dengan kosong. Kalau ini pun gagal, kegagalannya dilaporkan lewat hasil `false`.
      await store.setItemAsync(key, '');
      throw e;
    }
  }
}
