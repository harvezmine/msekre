import { render } from '@testing-library/react-native';
import { useSyncExternalStore, type ReactElement } from 'react';
import { AccountProvider } from '@/api/AccountProvider';
import { AgendaProvider } from '@/api/AgendaProvider';
import { ApiProvider, useApi, type Api } from '@/api/ApiProvider';
import { ChatProvider } from '@/api/ChatProvider';
import { BusinessProvider } from '@/api/BusinessProvider';
import { ConnectionsProvider } from '@/api/ConnectionsProvider';
import { DevicesProvider } from '@/api/DevicesProvider';
import { HistoryProvider } from '@/api/HistoryProvider';
import { HomeProvider } from '@/api/HomeProvider';
import { FakeTransport, type FakeOptions } from '@/api/fake/FakeTransport';
import { createMemorySession } from '@/api/session';
import { AuthProvider } from '@/api/useAuth';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  createSampleStore,
  initialSampleState,
  sampleReducer,
  type SampleAction,
  type SampleState,
} from '@/sample/store';
import { createToastStore, ToastProvider } from '@/ui/toastStore';
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

/** Toast yang dipakai semua tes: dikosongkan tiap `renderWithProviders`. */
export const testToasts = createToastStore();
/** Toast yang sedang tampil (atau `null`). */
export const toastNow = () => testToasts.get();

const none = createSampleStore();

/** Keadaan penyimpanan contoh milik server tiruan (hanya bila sumber datanya FakeTransport), untuk menengok isinya di tes. */
export function useSample(): { state: SampleState } {
  const { transport } = useApi();
  // Sumber data bukan server tiruan (HttpTransport): tidak ada penyimpanan contoh untuk ditengok.
  const store = transport instanceof FakeTransport ? transport.sample : none;
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { state };
}

/** Render dengan tema dan penyimpanan contoh, seperti di akar aplikasi. */
export async function renderWithProviders(ui: ReactElement, { state, actions = [], scheme, api }: Options = {}) {
  // Mode contoh: keadaan awal dipasang di penyimpanan milik server tiruan (itu yang dilihat layar dan skenario).
  const seeded = stateAfter(actions, state);
  testToasts.hide();
  return render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider scheme={scheme}>
        <ToastProvider store={testToasts}>
          <ApiProvider initial={api ?? createTestApi({ sample: seeded })} apiUrl={null}>
            <AuthProvider>
              <ChatProvider>
                <HomeProvider>
                  <AgendaProvider>
                    <DevicesProvider>
                      <BusinessProvider>
                        <ConnectionsProvider>
                          <HistoryProvider>
                            <AccountProvider>{ui}</AccountProvider>
                          </HistoryProvider>
                        </ConnectionsProvider>
                      </BusinessProvider>
                    </DevicesProvider>
                  </AgendaProvider>
                </HomeProvider>
              </ChatProvider>
            </AuthProvider>
          </ApiProvider>
        </ToastProvider>
      </ThemeProvider>
    </GestureHandlerRootView>,
  );
}
