import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ApiProvider, FAKE_LATENCY_MS, SESSION_KEYS, useApi, type ApiValue } from '@/api/ApiProvider';
import { FakeTransport } from '@/api/fake/FakeTransport';
import { HttpTransport } from '@/api/http';
import { HybridTransport } from '@/api/hybrid';
import { createMemorySession } from '@/api/session';

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

const API_URL = 'https://app.sekertaris.com';

/** Menampilkan mode yang berlaku dan menyimpan nilai `useApi` terakhir. */
function setupProbe() {
  const seen: { api: ApiValue | null } = { api: null };
  function Probe() {
    const api = useApi();
    seen.api = api;
    return <Text>{`mode ${api.mode}`}</Text>;
  }
  return { Probe, api: () => seen.api! };
}

test('bawaannya contoh dengan server tiruan; sesinya di kunci sendiri', async () => {
  const { Probe, api } = setupProbe();
  await render(
    <ApiProvider apiUrl={null} fallback={<Text>memuat</Text>}>
      <Probe />
    </ApiProvider>,
  );
  expect(await screen.findByText('mode contoh')).toBeTruthy();
  expect(api().transport).toBeInstanceOf(FakeTransport);
  expect(api().canUseServer).toBe(false);

  const started = api().transport.authStart({ phone: '6281220457781' });
  await jest.advanceTimersByTimeAsync(FAKE_LATENCY_MS);
  await started;
  const verifying = api().transport.authVerify({ phone: '6281220457781', code: '123456' });
  await jest.advanceTimersByTimeAsync(FAKE_LATENCY_MS);
  await verifying;
  expect(mockStore.get(SESSION_KEYS.contoh)).toMatch(/^contoh-/);
  expect(mockStore.has(SESSION_KEYS.server)).toBe(false);
});

test('mode akun dan server tidak bisa dipilih tanpa alamat server', async () => {
  const { Probe, api } = setupProbe();
  await render(
    <ApiProvider apiUrl={null}>
      <Probe />
    </ApiProvider>,
  );
  await screen.findByText('mode contoh');
  expect(await api().setMode('server')).toBe(false);
  expect(await api().setMode('akun')).toBe(false);
  expect(screen.getByText('mode contoh')).toBeTruthy();
  expect(mockStore.has('mode.data')).toBe(false);
});

test('alamat server diisi (build rilis), pemasangan baru: mode akun dengan sesi server asli', async () => {
  const { Probe, api } = setupProbe();
  await render(
    <ApiProvider apiUrl={API_URL}>
      <Probe />
    </ApiProvider>,
  );
  expect(await screen.findByText('mode akun')).toBeTruthy();
  const transport = api().transport as HybridTransport;
  expect(transport).toBeInstanceOf(HybridTransport);
  expect(transport.real).toBeInstanceOf(HttpTransport);
  expect(transport.fake).toBeInstanceOf(FakeTransport);
  expect(SESSION_KEYS.akun).toBe(SESSION_KEYS.server);
  // Belum ada pilihan yang disimpan: akun hanya bawaan.
  expect(mockStore.has('mode.data')).toBe(false);
});

test('akun ke contoh dan kembali: sesi akun tetap tersimpan, tidak perlu masuk lagi', async () => {
  const { Probe, api } = setupProbe();
  await render(
    <ApiProvider apiUrl={API_URL}>
      <Probe />
    </ApiProvider>,
  );
  await screen.findByText('mode akun');
  await act(() => api().session.set('tok-akun'));
  const hybrid = api().transport;
  const dispose = jest.spyOn(hybrid, 'dispose');

  expect(await act(() => api().setMode('contoh'))).toBe(true);
  expect(await screen.findByText('mode contoh')).toBeTruthy();
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(mockStore.get('mode.data')).toBe('contoh');
  // Sesi akun tidak dipakai di mode contoh, tapi tidak dihapus.
  expect(mockStore.get(SESSION_KEYS.akun)).toBe('tok-akun');
  expect(await api().session.get()).toBeNull();

  expect(await act(() => api().setMode('akun'))).toBe(true);
  expect(await screen.findByText('mode akun')).toBeTruthy();
  expect(await api().session.get()).toBe('tok-akun');
});

test('ganti ke server: HttpTransport, transport lama dilepas, pilihan bertahan setelah dibuka ulang', async () => {
  const { Probe, api } = setupProbe();
  const first = await render(
    <ApiProvider apiUrl={API_URL}>
      <Probe />
    </ApiProvider>,
  );
  await screen.findByText('mode akun');
  const hybrid = api().transport;
  const dispose = jest.spyOn(hybrid, 'dispose');
  expect(api().canUseServer).toBe(true);

  expect(await act(() => api().setMode('server'))).toBe(true);
  expect(await screen.findByText('mode server')).toBeTruthy();
  expect(api().transport).toBeInstanceOf(HttpTransport);
  expect(api().apiUrl).toBe(API_URL);
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(mockStore.get('mode.data')).toBe('server');

  // Memilih mode yang sama tidak membuat transport baru.
  const http = api().transport;
  expect(await api().setMode('server')).toBe(true);
  expect(api().transport).toBe(http);

  await first.unmount();
  const reopened = setupProbe();
  const second = await render(
    <ApiProvider apiUrl={API_URL}>
      <reopened.Probe />
    </ApiProvider>,
  );
  expect(await screen.findByText('mode server')).toBeTruthy();
  await second.unmount();

  // Alamat server dihapus dari app.json: kembali ke contoh.
  const noUrl = setupProbe();
  await render(
    <ApiProvider apiUrl={null}>
      <noUrl.Probe />
    </ApiProvider>,
  );
  expect(await screen.findByText('mode contoh')).toBeTruthy();
});

test('transport dari tes langsung dipakai', async () => {
  const session = createMemorySession('tok');
  const transport = new FakeTransport(session);
  const { Probe, api } = setupProbe();
  await render(
    <ApiProvider apiUrl={null} initial={{ mode: 'contoh', transport, session }} fallback={<Text>memuat</Text>}>
      <Probe />
    </ApiProvider>,
  );
  expect(screen.getByText('mode contoh')).toBeTruthy();
  expect(screen.queryByText('memuat')).toBeNull();
  expect(api().transport).toBe(transport);
  expect(api().session).toBe(session);
});

test('useApi di luar ApiProvider', async () => {
  const { Probe } = setupProbe();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(render(<Probe />)).rejects.toThrow('useApi dipakai di luar ApiProvider');
  jest.mocked(console.error).mockRestore();
});
