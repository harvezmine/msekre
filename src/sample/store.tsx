import { createContext, use, useState, useSyncExternalStore, type Dispatch, type ReactNode } from 'react';
import { type SampleAction, type SampleState } from './reducer';
import { createSampleStore, type SampleStore } from './sampleStore';

export * from './types';
export * from './reducer';
export * from './selectors';
export * from './sampleStore';

// Dua konteks: komponen yang hanya mengirim aksi (useSampleDispatch) tidak ikut digambar ulang saat keadaan berubah.
const StateContext = createContext<SampleState | null>(null);
const DispatchContext = createContext<Dispatch<SampleAction> | null>(null);

/**
 * Penyimpanan contoh untuk layar. Tanpa `store`, memakai penyimpanan sendiri yang terpisah (`initial` untuk tes: mulai
 * dari keadaan tertentu). Dengan `store` (mode contoh: milik server tiruan, lihat `ApiSampleProvider`), layar melihat
 * data yang sama dengan server tiruan; `initial` tidak dipakai.
 */
export function SampleProvider({
  children,
  initial,
  store,
}: {
  children: ReactNode;
  initial?: SampleState;
  store?: SampleStore;
}) {
  const [own] = useState(() => createSampleStore(initial));
  const active = store ?? own;
  const state = useSyncExternalStore(active.subscribe, active.getState);
  return (
    <DispatchContext value={active.dispatch}>
      <StateContext value={state}>{children}</StateContext>
    </DispatchContext>
  );
}

export function useSampleState(): SampleState {
  const v = use(StateContext);
  if (!v) throw new Error('useSampleState dipakai di luar SampleProvider');
  return v;
}

/** Hanya `dispatch`: tidak digambar ulang saat keadaan berubah. */
export function useSampleDispatch(): Dispatch<SampleAction> {
  const v = use(DispatchContext);
  if (!v) throw new Error('useSampleDispatch dipakai di luar SampleProvider');
  return v;
}

/** Keadaan dan dispatch sekaligus. Komponen yang hanya mengirim aksi sebaiknya memakai `useSampleDispatch`. */
export function useSample(): { state: SampleState; dispatch: Dispatch<SampleAction> } {
  return { state: useSampleState(), dispatch: useSampleDispatch() };
}
