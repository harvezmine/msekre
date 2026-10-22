import { createContext, use, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { AccountController } from './accountController';
import { useApi } from './ApiProvider';
import { needsSignIn } from './mode';
import { useAuth } from './useAuth';

export const AccountContext = createContext<AccountController | null>(null);

/** Nama asisten menurut Akun (yang terbaru, juga yang baru diubah); `null` sebelum Akun terbaca. Dibaca `useProfile`. */
export const AssistantNameContext = createContext<string | null>(null);

/**
 * Pemilik data Akun untuk seluruh aplikasi, di dalam `ApiProvider` dan `AuthProvider` (aturan hidupnya sama dengan
 * `ConnectionsProvider`): satu pengendali per transport, berjalan selama sudah masuk (mode `contoh` selalu), dihentikan saat
 * transport diganti atau keluar. Nama asisten yang diubah langsung dibawa ke seluruh aplikasi: `useAssistantName`
 * membacanya dari sini, dan `me` (dipakai nama saluran notifikasi) ikut diperbarui.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const { transport, mode } = useApi();
  const { status, me, setMe } = useAuth();
  const active = !needsSignIn(mode) || status === 'signedIn';
  const running = useMemo(() => (active ? new AccountController(transport) : null), [transport, active]);
  const idle = useMemo(() => new AccountController(transport), [transport]);
  const controller = running ?? idle;
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
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const account = state.data;
  const name = account?.assistant.name ?? null;
  const meName = me?.assistantName;
  useEffect(() => {
    if (account && meName !== undefined && meName !== account.assistant.name)
      setMe({ ...me!, assistantName: account.assistant.name });
  }, [account, meName, me, setMe]);
  return (
    <AccountContext value={controller}>
      <AssistantNameContext value={name}>{children}</AssistantNameContext>
    </AccountContext>
  );
}

/** Pengendali Akun bersama, atau `null` di luar {@link AccountProvider}. */
export function useAccountControllerOptional(): AccountController | null {
  return use(AccountContext);
}
