import { useIsFocused } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import type { AccountController, AccountState, LoadStatus } from './accountController';
import { useAccountControllerOptional } from './AccountProvider';
import type { Account } from './contract';

export interface AccountApi {
  /** Akun dari server, atau `null` sebelum terbaca. */
  account: Account | null;
  status: LoadStatus;
  /** Teks ramah, kalau `status` `error`. */
  error: string | null;
  /** Muat ulang ("Coba lagi"). */
  retry: () => Promise<void>;
  setAssistant: AccountController['setAssistant'];
  setGreeting: AccountController['setGreeting'];
  setNotifications: AccountController['setNotifications'];
  removePhone: AccountController['removePhone'];
  /** Bagian yang sedang disimpan. */
  busy: { assistant: boolean; greeting: boolean; notifications: boolean; phone: (id: string) => boolean };
}

const EMPTY: AccountState = { data: null, status: 'loading', error: null, busy: new Set() };
const noSubscribe = () => () => {};
const noState = () => EMPTY;
const nothing = async () => {};
const noAction = async () => ({ ok: false as const, message: '' });

/**
 * Akun untuk layar: paket, asisten, sapaan, notifikasi, keamanan, HP, dan privasi dari `GET /account`, dengan ubah-ubah
 * yang tampil dulu lalu dikembalikan bila server menolak. Sama di mode `contoh` dan `server`. Di luar provider kosong.
 */
export function useAccount(): AccountApi {
  const controller = useAccountControllerOptional();
  const state = useSyncExternalStore(controller?.subscribe ?? noSubscribe, controller?.getState ?? noState);
  // Dimuat saat layar dibuka dan setiap kali kembali ke layar ini (dari layar lain di atasnya).
  const focused = useIsFocused();
  useEffect(() => {
    if (focused) void controller?.load();
  }, [controller, focused]);
  return {
    account: state.data,
    status: state.status,
    error: state.error,
    retry: controller?.load ?? nothing,
    setAssistant: controller?.setAssistant ?? noAction,
    setGreeting: controller?.setGreeting ?? noAction,
    setNotifications: controller?.setNotifications ?? noAction,
    removePhone: controller?.removePhone ?? noAction,
    busy: {
      assistant: state.busy.has('assistant'),
      greeting: state.busy.has('greeting'),
      notifications: state.busy.has('notifications'),
      phone: (id) => state.busy.has(`phone:${id}`),
    },
  };
}
