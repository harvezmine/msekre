import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialSampleState, SampleProvider, sampleReducer, type SampleAction, type SampleState } from '@/sample/store';
import { ThemeProvider, type Scheme } from '@/theme/ThemeProvider';

interface Options {
  /** Mulai dari keadaan ini. */
  state?: SampleState;
  /** Aksi yang dijalankan lebih dulu pada keadaan awal, sebelum layar tampil. */
  actions?: SampleAction[];
  scheme?: Scheme;
}

export function stateAfter(actions: SampleAction[], from: SampleState = initialSampleState): SampleState {
  return actions.reduce(sampleReducer, from);
}

/** Render dengan tema dan penyimpanan contoh, seperti di akar aplikasi. */
export async function renderWithProviders(ui: ReactElement, { state, actions = [], scheme }: Options = {}) {
  return render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider scheme={scheme}>
        <SampleProvider initial={stateAfter(actions, state)}>{ui}</SampleProvider>
      </ThemeProvider>
    </GestureHandlerRootView>,
  );
}
