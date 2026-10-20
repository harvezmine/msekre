import { createContext, createElement, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
}

interface State {
  /** Transport pemilik keadaan ini. Transport baru (mode data diganti) membuat status kembali `checking`. */
  transport: Transport;
  status: AuthStatus;
  me: Me | null;
}

export const AuthContext = createContext<Auth | null>(null);

/**
 * Status masuk untuk seluruh aplikasi, di atas {@link useApi}. Sesi yang hilang di mana pun (401 dari request apa
 * pun, atau keluar) langsung membuat status `signedOut`, karena transport menghapus sesi lalu memberi tahu `onChange`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { transport, session } = useApi();
  const [state, setState] = useState<State>({ transport, status: 'checking', me: null });
  const current: State = state.transport === transport ? state : { transport, status: 'checking', me: null };

  useEffect(() => {
    let alive = true;
    const set = (status: AuthStatus, me: Me | null) => {
      if (alive) setState({ transport, status, me });
    };
    const off = session.onChange((token) => {
      if (token === null) set('signedOut', null);
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
      setState({ transport, status: 'signedIn', me: res.user });
      return res;
    },
    [transport],
  );
  const logout = useCallback(async () => {
    await transport.logout();
    setState({ transport, status: 'signedOut', me: null });
  }, [transport]);
  const refreshMe = useCallback(async () => {
    try {
      const me = await transport.me();
      setState({ transport, status: 'signedIn', me });
      return me;
    } catch {
      return null;
    }
  }, [transport]);

  const value = useMemo<Auth>(
    () => ({ status: current.status, me: current.me, start, verify, logout, refreshMe }),
    [current.status, current.me, start, verify, logout, refreshMe],
  );
  return createElement(AuthContext, { value }, children);
}

/** Status masuk. Hanya di dalam {@link AuthProvider}. */
export function useAuth(): Auth {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth dipakai di luar AuthProvider');
  return value;
}
