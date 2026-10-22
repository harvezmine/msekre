import { act, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import Tersambung from '../app/terhubung/tersambung';
import { clearJoinAnimated } from '@/api/joinSeen';
import type { JoinState } from '@/ui/connect/JoinMark';
import { createTestApi, renderWithProviders } from './helpers';

const mockJoin = jest.fn();
jest.mock('@/ui/connect/JoinMark', () => ({
  JoinMark: (props: { id: string; state: JoinState; animate?: boolean }) => {
    mockJoin(props);
    return null;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  clearJoinAnimated('gmail');
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'gmail' });
});
afterAll(() => jest.mocked(useLocalSearchParams).mockReturnValue({}));

const last = () => mockJoin.mock.calls.at(-1)?.[0] as { id: string; state: JoinState; animate?: boolean } | undefined;

test('logo layanan bergabung dengan tanda S tanpa menunggu cincin Beranda (yang tidak lagi dipakai di sini)', async () => {
  const api = createTestApi({ mode: 'server', token: 'tok' });
  const home = await api.transport.home();
  // Beranda dari server belum memuat simpul 'gmail' (event home menyusul): tidak berpengaruh lagi.
  jest.spyOn(api.transport, 'home').mockResolvedValue({
    ...home,
    ring: { nodes: home.ring.nodes.filter((n) => n.key !== 'gmail') },
  });
  await renderWithProviders(<Tersambung />, { api });
  await act(async () => {});
  expect(await screen.findByText('Gmail sudah terhubung')).toBeOnTheScreen();
  expect(last()).toMatchObject({ id: 'gmail', state: 'joined', animate: true });
});

test('dianimasikan sekali per sambungan; layar yang sama terbuka lagi untuk sambungan itu tidak mengulang', async () => {
  const api = createTestApi({ mode: 'server', token: 'tok' });
  await renderWithProviders(<Tersambung />, { api });
  await act(async () => {});
  expect(await screen.findByText('Gmail sudah terhubung')).toBeOnTheScreen();
  expect(last()?.animate).toBe(true);
  // Layar kedua (lembar masuk dan alamat kembali sama-sama membuka Tersambung): tidak menganimasikan dua kali.
  mockJoin.mockClear();
  await renderWithProviders(<Tersambung />, { api });
  await act(async () => {});
  expect(last()).toMatchObject({ id: 'gmail', state: 'joined', animate: false });
  // Alur baru (lembar masuk membersihkan tandanya): bergerak lagi.
  clearJoinAnimated('gmail');
  mockJoin.mockClear();
  await renderWithProviders(<Tersambung />, { api });
  await act(async () => {});
  expect(last()?.animate).toBe(true);
});
