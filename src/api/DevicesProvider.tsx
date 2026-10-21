import { createContext, use, useEffect, useMemo, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useApi } from './ApiProvider';
import { DevicesController } from './devicesController';
import { useAuth } from './useAuth';

export const DevicesContext = createContext<DevicesController | null>(null);

/**
 * Pemilik data Perangkat untuk seluruh aplikasi, di dalam `ApiProvider` dan `AuthProvider` (aturan hidupnya sama dengan
 * `HomeProvider`): satu pengendali per transport, berjalan selama sudah masuk (mode `contoh` selalu), dihentikan saat
 * transport diganti atau keluar. Perangkat dimuat ulang setiap aplikasi kembali ke depan.
 */
export function DevicesProvider({ children }: { children: ReactNode }) {
  const { transport, mode } = useApi();
  const { status } = useAuth();
  const active = mode === 'contoh' || status === 'signedIn';
  const running = useMemo(() => (active ? new DevicesController(transport) : null), [transport, active]);
  const idle = useMemo(() => new DevicesController(transport), [transport]);
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
  return <DevicesContext value={running ?? idle}>{children}</DevicesContext>;
}

/** Pengendali Perangkat bersama, atau `null` di luar {@link DevicesProvider}. */
export function useDevicesControllerOptional(): DevicesController | null {
  return use(DevicesContext);
}
