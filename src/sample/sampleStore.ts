import { initialSampleState, sampleReducer, type SampleAction, type SampleState } from './reducer';

/**
 * Penyimpanan contoh sebagai objek biasa (bukan React): `getState`, `dispatch`, `subscribe`. Dimiliki server tiruan
 * (`FakeTransport.sample`), jadi server tiruan dan layar yang belum pindah membaca dan menulis data yang SAMA.
 * Dipakai layar lewat `useSyncExternalStore` (lihat `SampleProvider`).
 */
export interface SampleStore {
  getState(): SampleState;
  /** Jalankan aksi dengan `sampleReducer`. Pendengar dipanggil saat itu juga, hanya kalau keadaannya benar-benar berubah. */
  dispatch(action: SampleAction): void;
  /** Daftarkan pendengar perubahan. Mengembalikan fungsi untuk berhenti. */
  subscribe(listener: () => void): () => void;
}

export function createSampleStore(initial: SampleState = initialSampleState): SampleStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch(action) {
      const next = sampleReducer(state, action);
      if (next === state) return;
      state = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
