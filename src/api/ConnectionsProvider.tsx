import { createContext, use, useEffect, useMemo, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useApi } from './ApiProvider';
import { ConnectionsController } from './connectionsController';
import { useAuth } from './useAuth';

export const ConnectionsContext = createContext<ConnectionsController | null>(null);

/**
 * Pemilik data Terhubung untuk seluruh aplikasi, di dalam `ApiProvider` dan `AuthProvider` (aturan hidupnya sama dengan
 * `BusinessProvider`): satu pengendali per transport, berjalan selama sudah masuk (mode `contoh` selalu), dihentikan saat
 * transport diganti atau keluar. Daftar dimuat ulang setiap aplikasi kembali ke depan (misalnya setelah halaman masuk
 * resmi di luar aplikasi).
 */
export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const { transport, mode } = useApi();
  const { status } = useAuth();
  const active = mode === 'contoh' || status === 'signedIn';
  const running = useMemo(() => (active ? new ConnectionsController(transport) : null), [transport, active]);
  const idle = useMemo(() => new ConnectionsController(transport), [transport]);
  useEffect(() => {
    if (!running) return;
    running.start();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void running.reloadAll();
    });
    return () => {
      sub.remove();
      running.stop();
    };
  }, [running]);
  return <ConnectionsContext value={running ?? idle}>{children}</ConnectionsContext>;
}

/** Pengendali Terhubung bersama, atau `null` di luar {@link ConnectionsProvider}. */
export function useConnectionsControllerOptional(): ConnectionsController | null {
  return use(ConnectionsContext);
}
