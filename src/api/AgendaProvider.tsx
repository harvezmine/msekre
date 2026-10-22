import { createContext, use, useEffect, useMemo, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useApi } from './ApiProvider';
import { needsSignIn } from './mode';
import { AgendaController } from './agendaController';
import { useAuth } from './useAuth';

export const AgendaContext = createContext<AgendaController | null>(null);

/**
 * Pemilik data Agenda untuk seluruh aplikasi, di dalam `ApiProvider` dan `AuthProvider` (aturan hidupnya sama dengan
 * `HomeProvider`): satu pengendali per transport, berjalan selama sudah masuk (mode `contoh` selalu), dihentikan saat
 * transport diganti atau keluar. Agenda dimuat ulang setiap aplikasi kembali ke depan.
 */
export function AgendaProvider({ children }: { children: ReactNode }) {
  const { transport, mode } = useApi();
  const { status } = useAuth();
  const active = !needsSignIn(mode) || status === 'signedIn';
  const running = useMemo(() => (active ? new AgendaController(transport) : null), [transport, active]);
  const idle = useMemo(() => new AgendaController(transport), [transport]);
  useEffect(() => {
    if (!running) return;
    running.start();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void running.load();
    });
    return () => {
      sub.remove();
      running.stop();
    };
  }, [running]);
  return <AgendaContext value={running ?? idle}>{children}</AgendaContext>;
}

/** Pengendali Agenda bersama, atau `null` di luar {@link AgendaProvider}. */
export function useAgendaControllerOptional(): AgendaController | null {
  return use(AgendaContext);
}
