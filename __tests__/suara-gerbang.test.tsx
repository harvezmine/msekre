import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import Tambah from '../app/agenda/tambah';
import Chat from '../app/chat';
import Beranda from '../app/(tabs)/index';
import { TabBar } from '@/ui/TabBar';
import { createTestApi, renderWithProviders, toastNow } from './helpers';

const flush = () => act(async () => {});
const SOON = 'Mode Suara segera hadir.';

beforeEach(() => jest.clearAllMocks());

const server = (voice: boolean) => createTestApi({ mode: 'server', token: 'tok', voice });

function tabBarProps() {
  const routes = ['index', 'agenda', 'perangkat', 'usaha'].map((name) => ({ key: `${name}-k`, name }));
  return {
    state: { index: 0, routes },
    descriptors: {},
    emitter: { emit: jest.fn(() => ({ defaultPrevented: false })) },
    navigateToTab: jest.fn(),
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  } as unknown as BottomTabBarProps;
}

describe('akun tanpa Mode Suara di server: semua pintu masuk memberi catatan', () => {
  test('Inti di tab bar (tahan)', async () => {
    await renderWithProviders(<TabBar {...tabBarProps()} />, { api: server(false) });
    await flush();
    await fireEvent(screen.getByRole('button', { name: 'Bicara dengan Nadia' }), 'longPress');
    expect(router.navigate).not.toHaveBeenCalledWith('/suara');
    expect(toastNow()?.text).toBe(SOON);
  });

  test('Inti di Beranda (tahan)', async () => {
    await renderWithProviders(<Beranda />, { api: server(false) });
    await flush();
    await fireEvent(screen.getByRole('button', { name: 'Bicara dengan Nadia' }), 'longPress');
    expect(router.navigate).not.toHaveBeenCalledWith('/suara');
    expect(toastNow()?.text).toBe(SOON);
  });

  test('mic di kolom chat dan tombol Mode Suara di chat', async () => {
    await renderWithProviders(<Chat />, { api: server(false) });
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Bicara' }));
    expect(router.replace).not.toHaveBeenCalledWith('/suara');
    expect(toastNow()?.text).toBe(SOON);
    await fireEvent.press(screen.getByRole('button', { name: 'Mode Suara' }));
    expect(router.replace).not.toHaveBeenCalledWith('/suara');
  });

  test('Bicara di Agenda tambah', async () => {
    await renderWithProviders(<Tambah />, { api: server(false) });
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Bicara' }));
    expect(router.push).not.toHaveBeenCalledWith('/suara');
    expect(toastNow()?.text).toBe(SOON);
  });
});

describe('akun dengan Mode Suara', () => {
  test('Inti di tab bar membuka /suara', async () => {
    await renderWithProviders(<TabBar {...tabBarProps()} />, { api: server(true) });
    await flush();
    await fireEvent(screen.getByRole('button', { name: 'Bicara dengan Nadia' }), 'longPress');
    expect(Haptics.impactAsync).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith('/suara');
    expect(toastNow()).toBeNull();
  });
});
