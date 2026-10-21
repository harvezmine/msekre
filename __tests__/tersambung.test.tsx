import { act, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import Tersambung from '../app/terhubung/tersambung';
import { clearJoinAnimated } from '@/api/joinSeen';
import type { OrbitNode } from '@/ui/orbit/types';
import { createTestApi, renderWithProviders } from './helpers';

const mockOrbit = jest.fn();
jest.mock('@/ui/orbit/Orbit', () => ({
  Orbit: (props: { nodes: OrbitNode[]; joinKey?: string }) => {
    mockOrbit(props);
    return null;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  clearJoinAnimated('gmail');
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'gmail' });
});
afterAll(() => jest.mocked(useLocalSearchParams).mockReturnValue({}));

const lastJoinKey = () => mockOrbit.mock.calls.at(-1)?.[0].joinKey;

test('simpul bergabung dicari dengan kunci = id layanan; tidak ada: tidak menganimasikan apa pun (tanpa "simpul terakhir")', async () => {
  const api = createTestApi({ mode: 'server', token: 'tok' });
  const home = await api.transport.home();
  // Beranda dari server belum memuat simpul 'gmail' (event home menyusul).
  jest.spyOn(api.transport, 'home').mockResolvedValue({
    ...home,
    ring: { nodes: home.ring.nodes.filter((n) => n.key !== 'gmail') },
  });
  await renderWithProviders(<Tersambung />, { api });
  await act(async () => {});
  expect(await screen.findByText('Gmail sudah terhubung')).toBeOnTheScreen();
  expect(lastJoinKey()).toBeUndefined();
});

test('simpul ada di cincin: dianimasikan sekali; layar yang sama terbuka lagi untuk sambungan itu tidak mengulang', async () => {
  const api = createTestApi({ mode: 'server', token: 'tok' });
  await renderWithProviders(<Tersambung />, { api });
  await act(async () => {});
  expect(await screen.findByText('Gmail sudah terhubung')).toBeOnTheScreen();
  expect(lastJoinKey()).toBe('gmail');
  // Layar kedua (lembar masuk dan alamat kembali sama-sama membuka Tersambung): tidak menganimasikan dua kali.
  mockOrbit.mockClear();
  await renderWithProviders(<Tersambung />, { api });
  await act(async () => {});
  expect(lastJoinKey()).toBeUndefined();
});
