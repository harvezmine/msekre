import { useSyncExternalStore } from 'react';

// Bendera kecil: tata letak tab menyatakan bilah tab sedang terlihat, supaya toast (di akar, di luar tab) tahu
// berapa tinggi yang harus ia hindari.
let shown = false;
const listeners = new Set<() => void>();

export function setTabBarShown(next: boolean) {
  if (shown === next) return;
  shown = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Benar selama bilah tab terlihat (tab sedang fokus). */
export function useTabBarShown(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => shown,
    () => false,
  );
}
