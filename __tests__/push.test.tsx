import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import Akun from '../app/akun';
import Chat from '../app/chat';
import IzinNotifikasi from '../app/izin-notifikasi';
import Pilih from '../app/mulai/pilih';
import { createTestApi, renderWithProviders } from './helpers';
import { isChatFocused, setChatFocused } from '@/api/pushPresence';
import { FakeTransport } from '@/api/fake/FakeTransport';
import { PushProvider, PushTapHandler, resetPushForTests, tapTarget } from '@/api/usePush';
import { useAuth } from '@/api/useAuth';

// Ingatan di HP diganti peta di memori, supaya "sudah ditawari" dan "token terakhir" bisa dites antar pemasangan.
const mockStore = new Map<string, string>();
jest.mock('@/api/secureStore', () => ({
  readSecure: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
  writeSecure: jest.fn((key: string, value: string | null) => {
    if (value === null) mockStore.delete(key);
    else mockStore.set(key, value);
    return Promise.resolve(true);
  }),
}));

const N = jest.mocked(Notifications);
const GRANTED = { granted: true, status: 'granted', canAskAgain: true } as never;
const DENIED = { granted: false, status: 'denied', canAskAgain: false } as never;
const UNDETERMINED = { granted: false, status: 'undetermined', canAskAgain: true } as never;

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
async function settle() {
  for (let i = 0; i < 4; i++) await advance(0);
}

function response(data?: Record<string, unknown>, id = 'n1') {
  return {
    actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: { date: 1, request: { identifier: id, content: { data: data ?? {} } } },
  } as never;
}

let auth: ReturnType<typeof useAuth>;
function AuthProbe() {
  const a = useAuth();
  useEffect(() => {
    auth = a;
  });
  return null;
}
/** Pemasang ulang penangan ketukan, seperti render baru yang membaca jawaban notifikasi terbaru. */
let kick: () => void;
function Kick() {
  const [n, set] = useState(0);
  useEffect(() => {
    kick = () => set((v) => v + 1);
  });
  return <PushTapHandler key={n} />;
}

async function mount(ui: React.ReactElement = <></>, api = createTestApi()) {
  await renderWithProviders(
    <PushProvider>
      {ui}
      <AuthProbe />
      <Kick />
    </PushProvider>,
    { api },
  );
  await settle();
  return api;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  resetPushForTests();
  setChatFocused(false);
  N.getPermissionsAsync.mockResolvedValue(UNDETERMINED);
  N.requestPermissionsAsync.mockResolvedValue(GRANTED);
  N.getDevicePushTokenAsync.mockResolvedValue({ type: 'android', data: 'token-1' });
  N.useLastNotificationResponse.mockReturnValue(null);
  N.addPushTokenListener.mockReturnValue({ remove: jest.fn() });
});

describe('saluran dan penangan', () => {
  test('Android: saluran Pesan dari Nadia dan Pengingat dibuat, keduanya penting', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await mount();
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith('pesan', { name: 'Pesan dari Nadia', importance: 6 });
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith('pengingat', {
      name: 'Pengingat',
      importance: 6,
      sound: 'default',
    });
  });

  test('iOS: tidak ada saluran', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await mount();
    expect(N.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  test('notifikasi tampil bila chat tidak terbuka dan diredam selagi chat terbuka', async () => {
    await mount();
    const handler = N.setNotificationHandler.mock.calls[0]![0]!;
    const behavior = () => handler.handleNotification({} as never);
    expect(await behavior()).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
    setChatFocused(true);
    expect(await behavior()).toMatchObject({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false });
  });

  test('layar chat menandai dirinya terbuka, dan berhenti saat tidak terlihat atau ditutup', async () => {
    const view = await renderWithProviders(<Chat />);
    expect(isChatFocused()).toBe(true);
    await view.unmount();
    expect(isChatFocused()).toBe(false);
    // Layar lain menutupi chat (ia belum ditutup): notifikasi boleh tampil lagi.
    jest.mocked(useIsFocused).mockReturnValue(false);
    await renderWithProviders(<Chat />);
    expect(isChatFocused()).toBe(false);
    jest.mocked(useIsFocused).mockReturnValue(true);
  });
});

describe('ketukan notifikasi', () => {
  test('aplikasi terbuka: ketukan membuka chat', async () => {
    await mount();
    expect(router.navigate).not.toHaveBeenCalled();
    N.useLastNotificationResponse.mockReturnValue(response());
    await act(async () => kick());
    await advance(0);
    expect(router.navigate).toHaveBeenCalledWith('/chat');
    expect(router.navigate).toHaveBeenCalledTimes(1);
    // Jawaban yang sama tidak membuka layar dua kali.
    await act(async () => kick());
    await advance(0);
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  test('aplikasi tertutup (jawaban terakhir sudah ada saat mulai): chat dibuka', async () => {
    N.useLastNotificationResponse.mockReturnValue(response());
    await mount();
    expect(router.navigate).toHaveBeenCalledWith('/chat');
  });

  test('data.route yang dikenal dipakai; selain itu chat', async () => {
    N.useLastNotificationResponse.mockReturnValue(response({ route: '/agenda' }, 'a'));
    await mount();
    expect(router.navigate).toHaveBeenLastCalledWith('/agenda');
    expect(tapTarget({ route: '/mulai/masuk' })).toBe('/chat');
    expect(tapTarget({ route: 'https://contoh.com' })).toBe('/chat');
    expect(tapTarget({ route: '//contoh.com' })).toBe('/chat');
    expect(tapTarget({ route: '/rahasia' })).toBe('/chat');
    expect(tapTarget({ route: 42 })).toBe('/chat');
    expect(tapTarget(undefined)).toBe('/chat');
  });

  test('aksi selain ketukan biasa diabaikan', async () => {
    N.useLastNotificationResponse.mockReturnValue({ ...(response() as object), actionIdentifier: 'lain' } as never);
    await mount();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  test('mode server: ditahan selama sesi diperiksa, dibuka setelah masuk', async () => {
    N.useLastNotificationResponse.mockReturnValue(response());
    const api = createTestApi({ mode: 'server', token: 't', latencyMs: 50 });
    await mount(<></>, api);
    expect(router.navigate).not.toHaveBeenCalled();
    await advance(100);
    await settle();
    expect(auth.status).toBe('signedIn');
    expect(router.navigate).toHaveBeenCalledWith('/chat');
  });

  test('mode server tanpa sesi: ketukan dibuang, tidak membuka layar aplikasi', async () => {
    N.useLastNotificationResponse.mockReturnValue(response());
    await mount(<></>, createTestApi({ mode: 'server' }));
    expect(auth.status).toBe('signedOut');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

describe('token', () => {
  test('izin ada: token dikirim sekali, platform dari token', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    const api = await mount();
    const fake = api.transport as FakeTransport;
    expect(fake.registeredPushTokens).toEqual([{ pushToken: 'token-1', platform: 'android' }]);
    // Aplikasi dibuka kembali dengan token yang sama: tidak dikirim lagi.
    await act(async () => kick());
    await settle();
    expect(fake.registeredPushTokens).toHaveLength(1);
  });

  test('belum diizinkan atau ditolak: tidak ada token dikirim', async () => {
    const api = await mount();
    expect((api.transport as FakeTransport).registeredPushTokens).toEqual([]);
    expect(N.getDevicePushTokenAsync).not.toHaveBeenCalled();
  });

  test('token berubah: dikirim lagi; token yang sama dari pendengar: tidak', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    const api = await mount();
    const fake = api.transport as FakeTransport;
    const onToken = N.addPushTokenListener.mock.calls[0]![0] as () => void;
    await act(async () => onToken());
    await settle();
    expect(fake.registeredPushTokens).toHaveLength(1);
    N.getDevicePushTokenAsync.mockResolvedValue({ type: 'android', data: 'token-2' });
    await act(async () => onToken());
    await settle();
    expect(fake.registeredPushTokens.map((t) => t.pushToken)).toEqual(['token-1', 'token-2']);
  });

  test('token yang sudah terkirim diingat antar pemasangan', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    const first = await mount();
    expect((first.transport as FakeTransport).registeredPushTokens).toHaveLength(1);
    const second = await mount();
    expect((second.transport as FakeTransport).registeredPushTokens).toEqual([]);
  });

  test('gagal mengirim: dicoba lagi lain kali, tidak dilempar', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    const api = createTestApi();
    const register = jest.spyOn(api.transport, 'registerPushToken').mockRejectedValueOnce(new Error('putus'));
    await mount(<></>, api);
    expect(register).toHaveBeenCalledTimes(1);
    const onToken = N.addPushTokenListener.mock.calls[0]![0] as () => void;
    await act(async () => onToken());
    await settle();
    expect(register).toHaveBeenCalledTimes(2);
    expect((api.transport as FakeTransport).registeredPushTokens).toHaveLength(1);
  });

  test('mode server: baru dikirim setelah masuk, dan dikirim lagi setelah keluar lalu masuk', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    const api = await mount(<></>, createTestApi({ mode: 'server' }));
    const fake = api.transport as FakeTransport;
    expect(auth.status).toBe('signedOut');
    expect(fake.registeredPushTokens).toEqual([]);
    await act(async () => {
      await auth.start('6281220457781');
      await auth.verify('6281220457781', '123456');
    });
    await settle();
    expect(auth.status).toBe('signedIn');
    expect(fake.registeredPushTokens).toHaveLength(1);
    await act(async () => {
      await auth.logout();
    });
    await settle();
    await act(async () => {
      await auth.start('6281220457781');
      await auth.verify('6281220457781', '123456');
    });
    await settle();
    expect(fake.registeredPushTokens).toHaveLength(2);
  });
});

describe('lembar izin', () => {
  test('Izinkan meminta izin ke sistem lalu menutup', async () => {
    await mount(<IzinNotifikasi />);
    expect(screen.getByText('Biar pengingat dan kabar penting sampai')).toBeOnTheScreen();
    expect(screen.getByText('Izinkan notifikasi ya. Saya hanya mengirim yang perlu Anda tahu.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Izinkan' }));
    expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    await advance(300);
    expect(router.back).toHaveBeenCalledTimes(1);
    // Izin didapat: token ikut dikirim.
    expect(N.getDevicePushTokenAsync).toHaveBeenCalled();
  });

  test('Nanti saja menutup tanpa meminta izin', async () => {
    await mount(<IzinNotifikasi />);
    await fireEvent.press(screen.getByRole('button', { name: 'Nanti saja' }));
    await advance(300);
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  test('ditolak di HP: tombol membuka pengaturan HP', async () => {
    N.getPermissionsAsync.mockResolvedValue(DENIED);
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await mount(<IzinNotifikasi />);
    expect(screen.getByText('Notifikasi sedang dimatikan')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Buka pengaturan' }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  test('sudah aktif: hanya memberi tahu', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    await mount(<IzinNotifikasi />);
    expect(screen.getByText('Notifikasi sudah aktif')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Izinkan' })).toBeNull();
  });
});

describe('setelah pengenalan', () => {
  const finish = async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Lewati dulu' }));
    await settle();
  };

  test('ajakan izin muncul sekali, lalu tidak lagi', async () => {
    const first = await renderWithProviders(
      <PushProvider>
        <Pilih />
      </PushProvider>,
    );
    await settle();
    await finish();
    expect(router.push).toHaveBeenCalledWith('/izin-notifikasi');
    expect(router.push).toHaveBeenCalledTimes(1);
    await first.unmount();
    // Pengenalan diulang (misalnya lewat Coba): tidak menawari lagi.
    await renderWithProviders(
      <PushProvider>
        <Pilih />
      </PushProvider>,
    );
    await settle();
    await finish();
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  test('izin sudah ada atau sudah ditolak: tidak ditawari', async () => {
    N.getPermissionsAsync.mockResolvedValue(DENIED);
    await renderWithProviders(
      <PushProvider>
        <Pilih />
      </PushProvider>,
    );
    await settle();
    await finish();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('Akun', () => {
  test.each([
    [UNDETERMINED, 'Belum diizinkan'],
    [GRANTED, 'Aktif'],
    [DENIED, 'Dimatikan di pengaturan HP'],
  ])('baris Notifikasi menyebut keadaannya (%#)', async (permission, text) => {
    N.getPermissionsAsync.mockResolvedValue(permission);
    await mount(<Akun />);
    expect(screen.getByText(text)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Notifikasi/ }));
    expect(router.push).toHaveBeenCalledWith('/izin-notifikasi');
  });
});
