import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ApiProvider, useApi, type ApiValue } from '@/api/ApiProvider';
import type { AuthVerifyRes, Me } from '@/api/contract';
import { createMemorySession } from '@/api/session';
import { AuthProvider, useAuth, type Auth } from '@/api/useAuth';
import { createTestApi } from './helpers';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

beforeEach(() => mockStore.clear());

/** Mengambil `useApi` dan `useAuth` terkini dari dalam provider. */
function setup() {
  const seen: { api: ApiValue | null; auth: Auth | null } = { api: null, auth: null };
  function Probe() {
    seen.api = useApi();
    seen.auth = useAuth();
    return <Text>{`mode ${seen.api.mode} status ${seen.auth.status} me ${seen.auth.me?.name ?? '-'}`}</Text>;
  }
  return { Probe, seen };
}

/** Janji yang diselesaikan tes, untuk menahan jawaban transport lama. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('hasil terlambat dari transport yang sudah diganti', () => {
  async function renderSwitchable(token: string | null = null) {
    const first = createTestApi({ mode: 'server', token });
    const { Probe, seen } = setup();
    await render(
      <ApiProvider apiUrl="https://app.sekertaris.com" initial={first}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </ApiProvider>,
    );
    return { first, seen };
  }

  test('verify yang selesai sesudah mode diganti tidak membuat mode baru signedIn', async () => {
    const { first, seen } = await renderSwitchable();
    const me: Me = await first.transport.me();
    const verify = deferred<AuthVerifyRes>();
    jest.spyOn(first.transport, 'authVerify').mockReturnValue(verify.promise);
    let pending: Promise<unknown> = Promise.resolve();
    await act(async () => {
      pending = seen.auth!.verify('6281220457781', '123456');
    });
    await act(async () => {
      await seen.api!.setMode('contoh');
    });
    expect(await screen.findByText(/mode contoh status signedOut me -/)).toBeTruthy();
    await act(async () => {
      verify.resolve({ token: 'terlambat', user: { ...me, name: 'Orang Lain' } });
      await pending;
    });
    expect(screen.getByText(/mode contoh status signedOut me -/)).toBeTruthy();
  });

  test('refreshMe dan logout yang terlambat juga diabaikan', async () => {
    const { first, seen } = await renderSwitchable('token');
    expect(await screen.findByText(/mode server status signedIn me Rina/)).toBeTruthy();
    const me: Me = await first.transport.me();
    const slowMe = deferred<Me>();
    jest.spyOn(first.transport, 'me').mockReturnValue(slowMe.promise);
    const slowLogout = deferred<void>();
    jest.spyOn(first.transport, 'logout').mockReturnValue(slowLogout.promise);
    let refresh: Promise<unknown> = Promise.resolve();
    let leave: Promise<unknown> = Promise.resolve();
    await act(async () => {
      refresh = seen.auth!.refreshMe();
      leave = seen.auth!.logout();
    });
    await act(async () => {
      await seen.api!.setMode('contoh');
    });
    expect(await screen.findByText(/mode contoh status signedOut me -/)).toBeTruthy();
    // Sesi mode contoh baru: masuk di sana, lalu jawaban lama datang.
    await act(async () => {
      await seen.api!.session.set('contoh-baru');
    });
    await act(async () => {
      slowMe.resolve({ ...me, name: 'Lama' });
      slowLogout.resolve();
      await Promise.all([refresh, leave]);
    });
    expect(screen.queryByText(/Lama/)).toBeNull();
    expect(screen.getByText(/mode contoh/)).toBeTruthy();
    expect(screen.queryByText(/mode server/)).toBeNull();
  });
});

test('keluar dipanggil dua kali: sekali ke transport', async () => {
  const api = createTestApi({ token: 'token' });
  const logout = jest.spyOn(api.transport, 'logout');
  const { Probe, seen } = setup();
  await render(
    <ApiProvider apiUrl={null} initial={{ ...api, session: createMemorySession('token') }}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </ApiProvider>,
  );
  await act(async () => {
    await Promise.all([seen.auth!.logout(), seen.auth!.logout()]);
  });
  expect(logout).toHaveBeenCalledTimes(1);
});
