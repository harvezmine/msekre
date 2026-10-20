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

/** Baca nilai; `null` kalau tidak ada, modulnya tidak ada, atau penyimpanan HP menolak. */
export async function readSecure(key: string): Promise<string | null> {
  try {
    return (await secureStore()?.getItemAsync(key)) ?? null;
  } catch {
    return null;
  }
}

/** Tulis nilai (`null` menghapus). Gagal menyimpan tidak dilempar: nilainya hanya tidak bertahan setelah aplikasi ditutup. */
export async function writeSecure(key: string, value: string | null): Promise<void> {
  const store = secureStore();
  if (!store) return;
  try {
    if (value === null) await store.deleteItemAsync(key);
    else await store.setItemAsync(key, value);
  } catch {
    // Penyimpanan HP menolak (misalnya kunci rusak setelah pasang ulang); nilai tetap dipakai dari memori.
  }
}
