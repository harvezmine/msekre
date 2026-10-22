import { createContext, use, useEffect, useMemo, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useApi } from './ApiProvider';
import { needsSignIn } from './mode';
import { BusinessController } from './businessController';
import { useAuth } from './useAuth';

export const BusinessContext = createContext<BusinessController | null>(null);

/**
 * Pemilik data Usaha untuk seluruh aplikasi, di dalam `ApiProvider` dan `AuthProvider` (aturan hidupnya sama dengan
 * `HomeProvider`): satu pengendali per transport, berjalan selama sudah masuk (mode `contoh` selalu), dihentikan saat
 * transport diganti atau keluar. Usaha dimuat ulang setiap aplikasi kembali ke depan.
 */
export function BusinessProvider({ children }: { children: ReactNode }) {
  const { transport, mode } = useApi();
  const { status } = useAuth();
  const active = !needsSignIn(mode) || status === 'signedIn';
  const running = useMemo(() => (active ? new BusinessController(transport) : null), [transport, active]);
  const idle = useMemo(() => new BusinessController(transport), [transport]);
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
  return <BusinessContext value={running ?? idle}>{children}</BusinessContext>;
}

/** Pengendali Usaha bersama, atau `null` di luar {@link BusinessProvider}. */
export function useBusinessControllerOptional(): BusinessController | null {
  return use(BusinessContext);
}
