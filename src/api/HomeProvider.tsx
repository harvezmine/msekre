import { createContext, use, useEffect, useMemo, type ReactNode } from 'react';
import { useApi } from './ApiProvider';
import { HomeController } from './homeController';
import { useAuth } from './useAuth';

export const HomeContext = createContext<HomeController | null>(null);

/**
 * Pemilik data Beranda untuk seluruh aplikasi, di dalam `ApiProvider` dan `AuthProvider` (aturan hidupnya sama dengan
 * `ChatProvider`): satu pengendali per transport, berjalan selama sudah masuk (mode `contoh` selalu), dihentikan saat
 * transport diganti atau keluar, jadi data satu pengguna tidak bocor ke pengguna berikutnya.
 */
export function HomeProvider({ children }: { children: ReactNode }) {
  const { transport, mode } = useApi();
  const { status } = useAuth();
  const active = mode === 'contoh' || status === 'signedIn';
  const running = useMemo(() => (active ? new HomeController(transport) : null), [transport, active]);
  const idle = useMemo(() => new HomeController(transport), [transport]);
  useEffect(() => {
    if (!running) return;
    running.start();
    return () => running.stop();
  }, [running]);
  return <HomeContext value={running ?? idle}>{children}</HomeContext>;
}

/** Pengendali Beranda bersama, atau `null` di luar {@link HomeProvider}. */
export function useHomeControllerOptional(): HomeController | null {
  return use(HomeContext);
}
