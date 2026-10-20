import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { TabBar } from '@/ui/TabBar';

beforeEach(() => jest.clearAllMocks());

async function setup(index = 0) {
  const emitter = { emit: jest.fn(() => ({ defaultPrevented: false })) };
  const navigateToTab = jest.fn();
  const routes = ['index', 'agenda', 'perangkat', 'usaha'].map((name) => ({ key: `${name}-k`, name }));
  const props = {
    state: { index, routes },
    descriptors: {},
    emitter,
    navigateToTab,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  } as unknown as BottomTabBarProps;
  await render(<TabBar {...props} />);
  return { emitter, navigateToTab };
}

test('urutan tab sesuai desain, Inti di tengah', async () => {
  await setup();
  const tabs = screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel);
  expect(tabs).toEqual(['Beranda', 'Agenda', 'Perangkat', 'Usaha']);
  expect(screen.getByRole('button', { name: 'Bicara dengan Nadia' })).toBeTruthy();
});

test('ketuk Agenda pindah tab', async () => {
  const { emitter, navigateToTab } = await setup();
  await fireEvent.press(screen.getByRole('tab', { name: 'Agenda' }));
  expect(emitter.emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'agenda-k', canPreventDefault: true });
  expect(navigateToTab).toHaveBeenCalledWith('agenda-k');
});

test('ketuk tab yang sedang aktif tidak berpindah', async () => {
  const { navigateToTab } = await setup(0);
  await fireEvent.press(screen.getByRole('tab', { name: 'Beranda' }));
  expect(navigateToTab).not.toHaveBeenCalled();
});

test('ketuk Inti membuka chat, tahan Inti membuka Mode Suara dengan getar', async () => {
  await setup();
  const inti = screen.getByRole('button', { name: 'Bicara dengan Nadia' });
  await fireEvent.press(inti);
  expect(router.navigate).toHaveBeenCalledWith('/chat');
  await fireEvent(inti, 'longPress');
  expect(Haptics.impactAsync).toHaveBeenCalled();
  expect(router.navigate).toHaveBeenCalledWith('/suara');
});

test('pembaca layar: aksi Mode Suara membuka Mode Suara', async () => {
  await setup();
  const inti = screen.getByRole('button', { name: 'Bicara dengan Nadia' });
  await fireEvent(inti, 'accessibilityAction', { nativeEvent: { actionName: 'longpress' } });
  expect(router.navigate).toHaveBeenCalledWith('/suara');
});

test('daftar tab dibaca sebagai tablist', async () => {
  await setup();
  expect(screen.getAllByRole('tab')[0]!.parent?.props.accessibilityRole).toBe('tablist');
});
