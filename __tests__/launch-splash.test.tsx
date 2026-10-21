import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { usePathname } from 'expo-router';
import * as Reanimated from 'react-native-reanimated';
import { AppState, Linking } from 'react-native';
import { ThemeProvider, type Scheme } from '@/theme/ThemeProvider';
import { dark, light } from '@/theme/tokens';
import { LaunchSplash, useLaunchSplash } from '@/ui/LaunchSplash';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  const useReducedMotion = jest.fn(() => false);
  // Proxy, bukan salinan: ekspor reanimated berupa getter (termasuk `default`).
  return new Proxy(actual, { get: (target, key) => (key === 'useReducedMotion' ? useReducedMotion : target[key]) });
});

let handler: ((s: string) => void) | undefined;

function Host({ nativeHidden = true }: { nativeHidden?: boolean }) {
  const splash = useLaunchSplash();
  const { onNativeHidden } = splash;
  useEffect(() => {
    if (nativeHidden) onNativeHidden();
  }, [nativeHidden, onNativeHidden]);
  return <LaunchSplash state={splash} />;
}

async function mount(scheme: Scheme = 'light') {
  const r = await render(
    <ThemeProvider scheme={scheme}>
      <Host />
    </ThemeProvider>,
  );
  await act(async () => {});
  return r;
}
const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });
const shown = () => screen.queryByTestId('launch-splash') !== null;
const setApp = (s: string) =>
  act(async () => {
    handler?.(s);
  });

beforeEach(() => {
  handler = undefined;
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
    handler = h;
    return { remove: jest.fn() };
  }) as never);
  jest.mocked(Notifications.useLastNotificationResponse).mockReturnValue(null);
  jest.mocked(usePathname).mockReturnValue('/');
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
});

describe('layar pembuka', () => {
  test('tampil saat mulai dingin lalu hilang setelah animasi', async () => {
    await mount();
    expect(shown()).toBe(true);
    expect(screen.getByLabelText('Sekretaris AI')).toBeTruthy();
    await advance(1100);
    expect(shown()).toBe(true);
    await advance(300);
    expect(shown()).toBe(false);
  });

  test('bingkai pertama: warna latar dan tanda sama dengan layar pembuka asli', async () => {
    await mount();
    expect(screen.getByTestId('launch-splash')).toHaveStyle({ backgroundColor: light.paper, opacity: 1 });
    expect(screen.getByTestId('launch-splash-mark', { includeHiddenElements: true })).toHaveStyle({
      width: 120,
      height: 132,
    });
  });

  test('mode gelap memakai warna gelap', async () => {
    await mount('dark');
    expect(screen.getByTestId('launch-splash')).toHaveStyle({ backgroundColor: dark.paper });
  });

  test('menunggu layar asli hilang sebelum bergerak', async () => {
    await render(
      <ThemeProvider>
        <Host nativeHidden={false} />
      </ThemeProvider>,
    );
    await act(async () => {});
    await advance(5000);
    expect(shown()).toBe(true);
  });

  test('ketuk melewati', async () => {
    await mount();
    await fireEvent.press(screen.getByLabelText('Sekretaris AI'));
    await advance(200);
    expect(shown()).toBe(false);
  });

  test('gerak dikurangi: diam 400 ms lalu memudar', async () => {
    jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
    await mount();
    await advance(350);
    expect(shown()).toBe(true);
    await advance(400);
    expect(shown()).toBe(false);
  });

  test('dilewati saat dibuka dari alarm', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('sekretarisai://alarm?id=a1');
    await mount();
    expect(shown()).toBe(false);
  });

  test('dilewati saat dibuka dari ketukan notifikasi', async () => {
    jest.mocked(Notifications.useLastNotificationResponse).mockReturnValue({ actionIdentifier: 'x' } as never);
    await mount();
    expect(shown()).toBe(false);
  });

  test('tampil lagi setelah 30 menit di latar, tidak setelah 5 menit', async () => {
    await mount();
    await advance(1500);
    expect(shown()).toBe(false);
    await setApp('background');
    await advance(5 * 60_000);
    await setApp('active');
    expect(shown()).toBe(false);
    await setApp('background');
    await advance(30 * 60_000);
    await setApp('active');
    expect(shown()).toBe(true);
    await advance(1500);
    expect(shown()).toBe(false);
  });

  test('tidak tampil lagi saat layar alarm terbuka, dan menutup diri bila alarm terbuka', async () => {
    jest.mocked(usePathname).mockReturnValue('/alarm');
    await mount();
    expect(shown()).toBe(false);
    await setApp('background');
    await advance(40 * 60_000);
    await setApp('active');
    expect(shown()).toBe(false);
  });

  test('alarm terbuka saat layar pembuka tampil: menutup, dan tidak muncul lagi setelah alarm selesai', async () => {
    const r = await mount();
    expect(shown()).toBe(true);
    jest.mocked(usePathname).mockReturnValue('/alarm');
    await r.rerender(
      <ThemeProvider>
        <Host />
      </ThemeProvider>,
    );
    expect(shown()).toBe(false);
    jest.mocked(usePathname).mockReturnValue('/');
    await r.rerender(
      <ThemeProvider>
        <Host />
      </ThemeProvider>,
    );
    expect(shown()).toBe(false);
  });
});
