import { createContext, use, useMemo, useSyncExternalStore, type ReactNode } from 'react';

/** Toast yang sedang tampil. `id` baru setiap kali, jadi teks yang sama dua kali tetap tampil dan dibacakan ulang. */
export interface ToastState {
  id: number;
  text: string;
}

/** Penyimpanan toast sebagai objek biasa, tidak terkait data apa pun. Satu per `ToastProvider`. */
export interface ToastStore {
  get(): ToastState | null;
  show(text: string): void;
  /** Dengan `id`: hanya menutup toast itu, bukan toast yang lebih baru. */
  hide(id?: number): void;
  subscribe(listener: () => void): () => void;
}

export function createToastStore(): ToastStore {
  let current: ToastState | null = null;
  let seq = 0;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of [...listeners]) l();
  };
  return {
    get: () => current,
    show(text) {
      seq += 1;
      current = { id: seq, text };
      emit();
    },
    hide(id) {
      if (current === null || (id !== undefined && id !== current.id)) return;
      current = null;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const ToastContext = createContext<ToastStore | null>(null);

/** Dipasang sekali di akar (dan di tes). Hanya `ToastHost` yang menampilkannya. */
export function ToastProvider({ children, store }: { children: ReactNode; store?: ToastStore }) {
  const value = useMemo(() => store ?? createToastStore(), [store]);
  return <ToastContext value={value}>{children}</ToastContext>;
}

/** Fungsi pemunculan toast; tetap sama antar render. Tanpa `ToastProvider` tidak berbuat apa-apa. */
export function useToast(): (text: string) => void {
  const store = use(ToastContext);
  return useMemo(() => (text: string) => store?.show(text), [store]);
}

/** Toast yang sedang tampil dan fungsi menutupnya (untuk `ToastHost`). */
export function useToastState(): { toast: ToastState | null; hide: (id?: number) => void } {
  const store = use(ToastContext);
  const toast = useSyncExternalStore(store ? store.subscribe : noSubscribe, store ? store.get : getNone);
  const hide = useMemo(() => (id?: number) => store?.hide(id), [store]);
  return { toast, hide };
}

const noSubscribe = () => () => {};
const getNone = () => null;
