import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { ApiProvider, type Api } from '@/api/ApiProvider';
import { FakeTransport, type FakeOptions } from '@/api/fake/FakeTransport';
import { createMemorySession } from '@/api/session';
import { AuthProvider } from '@/api/useAuth';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialSampleState, SampleProvider, sampleReducer, type SampleAction, type SampleState } from '@/sample/store';
import { ThemeProvider, type Scheme } from '@/theme/ThemeProvider';

interface Options {
  /** Mulai dari keadaan ini. */
  state?: SampleState;
  /** Aksi yang dijalankan lebih dulu pada keadaan awal, sebelum layar tampil. */
  actions?: SampleAction[];
  scheme?: Scheme;
  /** Sumber data; bawaannya server tiruan di memori (mode contoh) tanpa sesi. */
  api?: Api;
}

/** Sumber data tiruan di memori untuk tes. `mode` menjadi label `Api.mode` dan `Transport.mode`; isinya selalu FakeTransport. */
export function createTestApi(options: FakeOptions & { token?: string | null } = {}) {
  const { token = null, mode = 'contoh', ...fake } = options;
  const session = createMemorySession(token);
  const transport = new FakeTransport(session, { ...fake, mode });
  return { mode, session, transport } satisfies Api;
}

export function stateAfter(actions: SampleAction[], from: SampleState = initialSampleState): SampleState {
  return actions.reduce(sampleReducer, from);
}

/** Render dengan tema dan penyimpanan contoh, seperti di akar aplikasi. */
export async function renderWithProviders(ui: ReactElement, { state, actions = [], scheme, api }: Options = {}) {
  return render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider scheme={scheme}>
        <SampleProvider initial={stateAfter(actions, state)}>
          <ApiProvider initial={api ?? createTestApi()} apiUrl={null}>
            <AuthProvider>{ui}</AuthProvider>
          </ApiProvider>
        </SampleProvider>
      </ThemeProvider>
    </GestureHandlerRootView>,
  );
}
