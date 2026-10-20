import { createContext, use, useReducer, type Dispatch, type ReactNode } from 'react';
import { initialSampleState, sampleReducer, type SampleAction, type SampleState } from './reducer';

export * from './types';
export * from './reducer';
export * from './selectors';

// Dua konteks: komponen yang hanya mengirim aksi (useSampleDispatch) tidak ikut digambar ulang saat keadaan berubah.
const StateContext = createContext<SampleState | null>(null);
const DispatchContext = createContext<Dispatch<SampleAction> | null>(null);

/** `initial` untuk tes: mulai dari keadaan tertentu. */
export function SampleProvider({ children, initial }: { children: ReactNode; initial?: SampleState }) {
  const [state, dispatch] = useReducer(sampleReducer, initial ?? initialSampleState);
  return (
    <DispatchContext value={dispatch}>
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
