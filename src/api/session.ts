import { readSecure, writeSecure } from './secureStore';

/**
 * Token sesi. `get` membaca dari memori setelah pembacaan pertama. `onChange` dipanggil setiap token berubah,
 * termasuk saat transport menghapusnya karena server membalas 401, supaya aplikasi bisa kembali ke layar masuk.
 */
export interface Session {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
  onChange(listener: (token: string | null) => void): () => void;
}

function createSession(load: () => Promise<string | null>, save: (token: string | null) => Promise<unknown>): Session {
  let token: string | null | undefined;
  let loading: Promise<string | null> | null = null;
  const listeners = new Set<(token: string | null) => void>();
  const change = async (next: string | null) => {
    const before = token;
    token = next;
    loading = null;
    await save(next);
    if (before !== next) for (const l of [...listeners]) l(next);
  };
  return {
    async get() {
      if (token !== undefined) return token;
      loading ??= load().then((value) => {
        // Bila set/clear terjadi selama membaca, nilai barunya yang berlaku.
        if (token === undefined) token = value;
        return token;
      });
      return loading;
    },
    set: (next) => change(next),
    clear: () => change(null),
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Sesi di `expo-secure-store` dengan kunci `key`. Tiap mode data memakai kuncinya sendiri. */
export function createSecureSession(key: string): Session {
  return createSession(
    () => readSecure(key),
    (token) => writeSecure(key, token),
  );
}

/** Sesi di memori saja, untuk tes. */
export function createMemorySession(initial: string | null = null): Session {
  return createSession(
    async () => initial,
    async () => {},
  );
}
