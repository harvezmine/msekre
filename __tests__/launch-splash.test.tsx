import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { usePathname } from 'expo-router';
import * as Reanimated from 'react-native-reanimated';
import { AppState, Linking, StyleSheet, Text } from 'react-native';
import { ThemeProvider, type Scheme } from '@/theme/ThemeProvider';
import { dark, light } from '@/theme/tokens';
import { LaunchSplash, useLaunchSplash } from '@/ui/LaunchSplash';
import { SplashShell } from '@/ui/SplashShell';
import { createToastStore, ToastProvider } from '@/ui/toastStore';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  const useReducedMotion = jest.fn(() => false);
  // Proxy, bukan salinan: ekspor reanimated berupa getter (termasuk `default`).
  return new Proxy(actual, { get: (target, key) => (key === 'useReducedMotion' ? useReducedMotion : target[key]) });
});

let handler: ((s: string) => void) | undefined;
let urlHandler: ((e: { url: string }) => void) | undefined;

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
  urlHandler = undefined;
  jest.spyOn(Linking, 'addEventListener').mockImplementation(((_: string, h: (e: { url: string }) => void) => {
    urlHandler = h;
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

describe('buka kembali dari latar karena notifikasi atau tautan alarm', () => {
  const tapped = { actionIdentifier: 'default', notification: { date: 1 } } as never;
  const rerender = (r: Awaited<ReturnType<typeof mount>>) =>
    r.rerender(
      <ThemeProvider>
        <Host />
      </ThemeProvider>,
    );

  async function idle() {
    const r = await mount();
    await advance(1500);
    expect(shown()).toBe(false);
    await setApp('background');
    await advance(40 * 60_000);
    return r;
  }

  test('ketukan notifikasi tiba sebelum aplikasi aktif: tidak tampil', async () => {
    const r = await idle();
    jest.mocked(Notifications.useLastNotificationResponse).mockReturnValue(tapped);
    await rerender(r);
    await setApp('active');
    expect(shown()).toBe(false);
  });

  test('ketukan notifikasi tiba sesudah aplikasi aktif: layar pembuka langsung menutup', async () => {
    const r = await idle();
    await setApp('active');
    expect(shown()).toBe(true);
    jest.mocked(Notifications.useLastNotificationResponse).mockReturnValue(tapped);
    await rerender(r);
    expect(shown()).toBe(false);
  });

  test('tautan alarm saat aplikasi hidup: tidak tampil, sebelum maupun sesudah aktif', async () => {
    await idle();
    await act(async () => urlHandler?.({ url: 'sekretarisai://alarm?id=a1' }));
    await setApp('active');
    expect(shown()).toBe(false);

    await setApp('background');
    await advance(40 * 60_000);
    await setApp('active');
    expect(shown()).toBe(true);
    await act(async () => urlHandler?.({ url: 'sekretarisai://alarm?id=a2' }));
    expect(shown()).toBe(false);
  });

  test('tautan biasa tidak mengubah apa-apa; latar berikutnya tanpa ketukan tampil lagi', async () => {
    const r = await idle();
    jest.mocked(Notifications.useLastNotificationResponse).mockReturnValue(tapped);
    await rerender(r);
    await setApp('active');
    expect(shown()).toBe(false);
    await setApp('background');
    await advance(40 * 60_000);
    await setApp('active');
    expect(shown()).toBe(true);
  });
});

describe('susunan akar', () => {
  function Shell({ ready }: { ready: boolean }) {
    const splash = useLaunchSplash();
    const { onNativeHidden } = splash;
    useEffect(() => onNativeHidden(), [onNativeHidden]);
    return (
      <SplashShell ready={ready} paper="#fff" splash={splash}>
        <Text>isi aplikasi</Text>
      </SplashShell>
    );
  }
  const store = createToastStore();
  const tree = (ready: boolean) => (
    <ThemeProvider>
      <ToastProvider store={store}>
        <Shell ready={ready} />
      </ToastProvider>
    </ThemeProvider>
  );

  test('layar pembuka tidak dipasang ulang saat sesi selesai diperiksa', async () => {
    const r = await render(tree(false));
    await act(async () => {});
    expect(screen.queryByText('isi aplikasi')).toBeNull();
    await advance(900);
    // Pergantian ke siap di tengah gerakan: gerakan yang sama berlanjut dan selesai pada waktunya (1,2 detik sejak awal).
    await r.rerender(tree(true));
    expect(screen.getByText('isi aplikasi', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(shown()).toBe(true);
    await advance(400);
    expect(shown()).toBe(false);
  });

  test('isi aplikasi disembunyikan dari pembaca layar selama layar pembuka tampil', async () => {
    await render(tree(true));
    await act(async () => {});
    expect(screen.queryByText('isi aplikasi')).toBeNull();
    expect(screen.getByText('isi aplikasi', { includeHiddenElements: true })).toBeOnTheScreen();
    await advance(1500);
    expect(screen.getByText('isi aplikasi')).toBeOnTheScreen();
  });

  test('toast tampil di atas layar pembuka', async () => {
    await render(tree(false));
    await act(async () => {});
    await act(async () => store.show('Halo'));
    expect(screen.getByText('Halo')).toBeOnTheScreen();
    let node = screen.getByTestId('toast').parent;
    let z: number | undefined;
    while (node && z === undefined) {
      z = StyleSheet.flatten(node.props.style as never)?.zIndex;
      node = node.parent;
    }
    expect(z).toBeGreaterThan(0);
    expect(shown()).toBe(true);
  });
});
