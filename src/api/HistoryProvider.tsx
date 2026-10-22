import { createContext, use, useEffect, useMemo, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useApi } from './ApiProvider';
import { needsSignIn } from './mode';
import { HistoryController } from './historyController';
import { useAuth } from './useAuth';

export const HistoryContext = createContext<HistoryController | null>(null);

/**
 * Pemilik data Riwayat untuk seluruh aplikasi, di dalam `ApiProvider` dan `AuthProvider` (aturan hidupnya sama dengan
 * `ConnectionsProvider`): satu pengendali per transport, berjalan selama sudah masuk (mode `contoh` selalu), dihentikan saat
 * transport diganti atau keluar. Daftar yang pernah dibuka dimuat ulang setiap aplikasi kembali ke depan.
 */
export function HistoryProvider({ children }: { children: ReactNode }) {
  const { transport, mode } = useApi();
  const { status } = useAuth();
  const active = !needsSignIn(mode) || status === 'signedIn';
  const running = useMemo(() => (active ? new HistoryController(transport) : null), [transport, active]);
  const idle = useMemo(() => new HistoryController(transport), [transport]);
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
  return <HistoryContext value={running ?? idle}>{children}</HistoryContext>;
}

/** Pengendali Riwayat bersama, atau `null` di luar {@link HistoryProvider}. */
export function useHistoryControllerOptional(): HistoryController | null {
  return use(HistoryContext);
}
