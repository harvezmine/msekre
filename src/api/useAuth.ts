import { createContext, createElement, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { clearDocumentCache } from '@/files/documents';
import { useApi } from './ApiProvider';
import type { AuthStartRes, AuthVerifyRes, Me } from './contract';
import type { Transport } from './transport';

/**
 * - `checking`: sesi tersimpan sedang dibaca dan `GET /me` sedang dimuat;
 * - `signedOut`: tidak ada sesi (belum masuk, sudah keluar, atau server menolak token);
 * - `signedIn`: ada sesi. `me` bisa masih `null` kalau `GET /me` gagal karena sinyal; coba lagi lewat `refreshMe`.
 */
export type AuthStatus = 'checking' | 'signedOut' | 'signedIn';

export interface Auth {
  status: AuthStatus;
  me: Me | null;
  /** Minta kode masuk lewat WhatsApp. `phone` E.164 tanpa "+". Melempar `ApiFailure`. */
  start(phone: string): Promise<AuthStartRes>;
  /** Cocokkan kode; sesi tersimpan dan status menjadi `signedIn`. Melempar `ApiFailure` (`kode_salah`, jaringan, dst). */
  verify(phone: string, code: string): Promise<AuthVerifyRes>;
  /** Keluar: sesi dihapus dan status menjadi `signedOut`. Tidak pernah gagal. */
  logout(): Promise<void>;
  /** Muat ulang `GET /me`. `null` kalau gagal (sesi yang ditolak otomatis membuat status `signedOut`). */
  refreshMe(): Promise<Me | null>;
  /** Ganti `me` dengan yang sudah diketahui (misalnya nama asisten yang baru diubah di Akun), tanpa permintaan. Hanya saat masuk. */
  setMe(me: Me): void;
}

interface State {
  /** Transport pemilik keadaan ini. Transport baru (mode data diganti) membuat status kembali `checking`. */
  transport: Transport;
  status: AuthStatus;
  me: Me | null;
}

/** Keluar yang sedang berjalan per transport, supaya ketukan kedua tidak memulai yang kedua. */
const leaving = new WeakMap<Transport, Promise<void>>();

export const AuthContext = createContext<Auth | null>(null);

/**
 * Status masuk untuk seluruh aplikasi, di atas {@link useApi}. Sesi yang hilang di mana pun (401 dari request apa
 * pun, atau keluar) langsung membuat status `signedOut`, karena transport menghapus sesi lalu memberi tahu `onChange`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { transport, session } = useApi();
  const [state, setState] = useState<State>({ transport, status: 'checking', me: null });
  const current: State = state.transport === transport ? state : { transport, status: 'checking', me: null };

  /**
   * Hasil request yang datang terlambat hanya berlaku bila transport yang memulainya masih yang dipakai: mode data yang
   * sudah diganti tidak boleh ditimpa jawaban transport lama.
   */
  const apply = useCallback(
    (from: Transport, next: (prev: State) => State) =>
      setState((prev) => (prev.transport === from ? next(prev) : prev)),
    [],
  );

  useEffect(() => {
    let alive = true;
    const set = (status: AuthStatus, me: Me | null) => {
      if (alive) setState({ transport, status, me });
    };
    const off = session.onChange((token) => {
      if (token !== null) return;
      set('signedOut', null);
      // Dokumen yang diunduh akun ini tidak boleh tertinggal di HP setelah keluar (juga saat sesi dicabut server).
      clearDocumentCache();
    });
    void (async () => {
      if (!(await session.get())) return set('signedOut', null);
      try {
        set('signedIn', await transport.me());
      } catch {
        // Ditolak (401): sesi sudah dihapus dan pendengar di atas sudah mengubah status. Gagal lain (tanpa sinyal):
        // tetap masuk, `me` menyusul lewat refreshMe.
        if (await session.get()) set('signedIn', null);
      }
    })();
    return () => {
      alive = false;
      off();
    };
  }, [transport, session]);

  const start = useCallback((phone: string) => transport.authStart({ phone }), [transport]);
  const verify = useCallback(
    async (phone: string, code: string) => {
      const res = await transport.authVerify({ phone, code });
      apply(transport, () => ({ transport, status: 'signedIn', me: res.user }));
      return res;
    },
    [transport, apply],
  );
  const logout = useCallback(() => {
    // Ketukan kedua selagi keluar berjalan memakai proses yang sama.
    const running = leaving.get(transport);
    if (running) return running;
    const run = (async () => {
      try {
        // Sesi dihapus di HP lebih dulu; pemberitahuan ke server menyusul di belakang layar (transport.logout).
        await transport.logout();
        apply(transport, () => ({ transport, status: 'signedOut', me: null }));
      } finally {
        leaving.delete(transport);
      }
    })();
    leaving.set(transport, run);
    return run;
  }, [transport, apply]);
  const refreshMe = useCallback(async () => {
    try {
      const me = await transport.me();
      apply(transport, () => ({ transport, status: 'signedIn', me }));
      return me;
    } catch {
      return null;
    }
  }, [transport, apply]);

  const setMe = useCallback(
    (me: Me) => apply(transport, (prev) => (prev.status === 'signedIn' ? { ...prev, me } : prev)),
    [transport, apply],
  );

  // `me` yang belum terbaca (sinyal hilang saat dimuat): coba lagi saat stream terbuka dan saat aplikasi kembali dibuka.
  const missingMe = current.status === 'signedIn' && current.me === null;
  useEffect(() => {
    if (!missingMe) return;
    const retry = () => void refreshMe();
    // Status `open` (juga yang sudah terbuka saat mulai mendengar, karena stream chat dipakai bersama) memicu coba lagi.
    const off = transport.subscribe(
      () => {},
      (status) => {
        if (status === 'open') retry();
      },
    );
    const app = AppState.addEventListener('change', (next) => {
      if (next === 'active') retry();
    });
    return () => {
      off();
      app.remove();
    };
  }, [missingMe, transport, refreshMe]);

  const value = useMemo<Auth>(
    () => ({ status: current.status, me: current.me, start, verify, logout, refreshMe, setMe }),
    [current.status, current.me, start, verify, logout, refreshMe, setMe],
  );
  return createElement(AuthContext, { value }, children);
}

/** Status masuk. Hanya di dalam {@link AuthProvider}. */
export function useAuth(): Auth {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth dipakai di luar AuthProvider');
  return value;
}
