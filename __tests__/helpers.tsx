import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AgendaProvider } from '@/api/AgendaProvider';
import { ApiProvider, type Api } from '@/api/ApiProvider';
import { ChatProvider } from '@/api/ChatProvider';
import { ApiSampleProvider } from '@/api/ApiSampleProvider';
import { DevicesProvider } from '@/api/DevicesProvider';
import { HomeProvider } from '@/api/HomeProvider';
import { FakeTransport, type FakeOptions } from '@/api/fake/FakeTransport';
import { createMemorySession } from '@/api/session';
import { AuthProvider } from '@/api/useAuth';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialSampleState, sampleReducer, type SampleAction, type SampleState } from '@/sample/store';
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
  // Mode contoh: keadaan awal dipasang di penyimpanan milik server tiruan (itu yang dilihat layar dan skenario).
  const seeded = stateAfter(actions, state);
  return render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider scheme={scheme}>
        <ApiProvider initial={api ?? createTestApi({ sample: seeded })} apiUrl={null}>
          <ApiSampleProvider initial={seeded}>
            <AuthProvider>
              <ChatProvider>
                <HomeProvider>
                  <AgendaProvider>
                    <DevicesProvider>{ui}</DevicesProvider>
                  </AgendaProvider>
                </HomeProvider>
              </ChatProvider>
            </AuthProvider>
          </ApiSampleProvider>
        </ApiProvider>
      </ThemeProvider>
    </GestureHandlerRootView>,
  );
}
