import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import Akun from '../app/akun';
import Notifikasi from '../app/akun/notifikasi';
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
const DENIED_ASK = { granted: false, status: 'denied', canAskAgain: true } as never;
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
  test('Android: saluran Pesan dari Nadia dan Kabar penting (push pengingat server) dibuat, keduanya penting', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await mount();
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith('pesan', {
      name: 'Pesan dari Nadia',
      importance: 6,
      lockscreenVisibility: 2,
    });
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith('pengingat', {
      name: 'Kabar penting',
      importance: 6,
      sound: 'default',
    });
  });

  test('nama saluran pesan mengikuti nama asisten, juga saat berubah', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const api = createTestApi({ token: 't' });
    const meSpy = jest.spyOn(api.transport, 'me');
    meSpy.mockResolvedValue({ id: 'u', name: 'Rina', assistantName: 'Sari', plan: null, phone: '6281' } as never);
    await mount(<></>, api);
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith(
      'pesan',
      expect.objectContaining({ name: 'Pesan dari Sari' }),
    );
    meSpy.mockResolvedValue({ id: 'u', name: 'Rina', assistantName: 'Dewi', plan: null, phone: '6281' } as never);
    await act(async () => {
      await auth.refreshMe();
    });
    await settle();
    expect(N.setNotificationChannelAsync).toHaveBeenLastCalledWith(
      'pengingat',
      expect.objectContaining({ name: 'Kabar penting' }),
    );
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith(
      'pesan',
      expect.objectContaining({ name: 'Pesan dari Dewi' }),
    );
  });

  test('iOS: tidak ada saluran', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await mount();
    expect(N.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  test('notifikasi tampil bila chat tidak terbuka dan diredam selagi chat terbuka', async () => {
    await mount();
    const handler = N.setNotificationHandler.mock.calls[0]![0]!;
    const behavior = () => handler.handleNotification({ request: { content: { data: { kind: 'pesan' } } } } as never);
    expect(await behavior()).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
    setChatFocused(true);
    expect(await behavior()).toMatchObject({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false });
  });

  test('selagi chat terbuka hanya pesan chat yang diredam; pengingat selalu tampil', async () => {
    await mount();
    const handler = N.setNotificationHandler.mock.calls[0]![0]!;
    const behave = (data: Record<string, unknown>, trigger?: unknown) =>
      handler.handleNotification({ request: { content: { data }, trigger } } as never);
    const shown = { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true };
    const muted = { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false };
    setChatFocused(true);
    expect(await behave({ kind: 'pesan' })).toMatchObject(muted);
    expect(await behave({}, { type: 'push', remoteMessage: { notification: { channelId: 'pesan' } } })).toMatchObject(
      muted,
    );
    expect(await behave({}, { type: 'channel', channelId: 'pesan' })).toMatchObject(muted);
    expect(await behave({ kind: 'pengingat' })).toMatchObject(shown);
    expect(
      await behave({}, { type: 'push', remoteMessage: { notification: { channelId: 'pengingat' } } }),
    ).toMatchObject(shown);
    // Pengingat di saluran pesan tetap tampil kalau ditandai pengingat.
    expect(await behave({ kind: 'pengingat' }, { type: 'channel', channelId: 'pesan' })).toMatchObject(shown);
    setChatFocused(false);
    expect(await behave({ kind: 'pesan' })).toMatchObject(shown);
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
    for (const bad of [
      '/agenda/../mulai/masuk',
      '/agenda/..',
      '/agenda//x',
      '/agenda\\..\\masuk',
      '/agenda?x=1',
      '/agenda#x',
      '/agenda/',
      '/agenda/detail',
      '/%2e%2e/agenda',
      '/Agenda',
      ' /agenda',
      '/agenda ',
    ]) {
      expect(tapTarget({ route: bad })).toBe('/chat');
    }
    for (const ok of ['/chat', '/agenda', '/riwayat', '/akun', '/terhubung', '/perangkat']) {
      expect(tapTarget({ route: ok })).toBe(ok);
    }
    expect(tapTarget({ route: '/rahasia' })).toBe('/chat');
    expect(tapTarget({ route: 42 })).toBe('/chat');
    expect(tapTarget(undefined)).toBe('/chat');
  });

  test('ketukan yang sudah ditangani dihapus dari sistem, supaya muat ulang tidak memutarnya lagi', async () => {
    N.useLastNotificationResponse.mockReturnValue(response());
    await mount();
    expect(router.navigate).toHaveBeenCalledWith('/chat');
    expect(N.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  });

  test('ketukan yang dibuang (belum masuk) juga dihapus; yang ditahan belum', async () => {
    N.useLastNotificationResponse.mockReturnValue(response());
    await mount(<></>, createTestApi({ mode: 'server', token: 't', latencyMs: 50 }));
    expect(N.clearLastNotificationResponse).not.toHaveBeenCalled();
    await advance(100);
    await settle();
    expect(N.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
    N.clearLastNotificationResponse.mockClear();
    resetPushForTests();
    await mount(<></>, createTestApi({ mode: 'server' }));
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(N.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
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
    // Aplikasi dibuka kembali dari latar depan dengan token yang sama (selama proses hidup): tidak dikirim lagi.
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

  test('setiap mulai dari keadaan mati token dikirim lagi, walau tidak berubah', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    const first = await mount();
    expect((first.transport as FakeTransport).registeredPushTokens).toHaveLength(1);
    const second = await mount();
    expect((second.transport as FakeTransport).registeredPushTokens).toEqual([
      { pushToken: 'token-1', platform: 'android' },
    ]);
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

describe('mencabut token saat keluar', () => {
  const signIn = async () => {
    await act(async () => {
      await auth.start('6281220457781');
      await auth.verify('6281220457781', '123456');
    });
    await settle();
  };
  const signOut = async () => {
    await act(async () => {
      await auth.logout();
    });
    await settle();
  };

  test('keluar dengan sinyal: token dicabut dari server dan dilupakan di HP', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    const api = await mount(<></>, createTestApi({ mode: 'server' }));
    const fake = api.transport as FakeTransport;
    await signIn();
    expect(mockStore.get('push.token.server')).toBe('token-1');
    await signOut();
    expect(fake.unregisteredPushTokens).toEqual(['token-1']);
    expect(mockStore.has('push.token.server')).toBe(false);
    expect(mockStore.has('push.cabut.server')).toBe(false);
  });

  test('keluar tanpa sinyal: dicatat, lalu dicabut saat aplikasi dibuka lagi', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    const first = await mount(<></>, createTestApi({ mode: 'server' }));
    const fake = first.transport as FakeTransport;
    await signIn();
    fake.drop();
    await signOut();
    expect(auth.status).toBe('signedOut');
    expect(fake.unregisteredPushTokens).toEqual([]);
    expect(JSON.parse(mockStore.get('push.cabut.server')!)).toEqual(['token-1']);
    // Aplikasi dimulai lagi, sinyal ada: dicabut.
    const second = await mount(<></>, createTestApi({ mode: 'server' }));
    expect((second.transport as FakeTransport).unregisteredPushTokens).toEqual(['token-1']);
    expect(mockStore.has('push.cabut.server')).toBe(false);
  });

  test('masih tanpa sinyal: tetap dicatat; dicoba lagi saat aplikasi kembali aktif', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    const listeners: ((s: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, l) => {
      const listener = l as (s: string) => void;
      listeners.push(listener);
      return { remove: () => void listeners.splice(listeners.indexOf(listener), 1) };
    });
    const api = await mount(<></>, createTestApi({ mode: 'server' }));
    const fake = api.transport as FakeTransport;
    await signIn();
    fake.drop();
    await signOut();
    await act(async () => listeners.forEach((l) => l('active')));
    await settle();
    expect(fake.unregisteredPushTokens).toEqual([]);
    expect(mockStore.has('push.cabut.server')).toBe(true);
    fake.restore();
    await act(async () => listeners.forEach((l) => l('active')));
    await settle();
    expect(fake.unregisteredPushTokens).toEqual(['token-1']);
    expect(mockStore.has('push.cabut.server')).toBe(false);
  });

  test('masuk lagi dengan token yang sama: tidak lagi dicabut', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    const api = await mount(<></>, createTestApi({ mode: 'server' }));
    const fake = api.transport as FakeTransport;
    await signIn();
    fake.drop();
    await signOut();
    fake.restore();
    expect(mockStore.has('push.cabut.server')).toBe(true);
    await signIn();
    expect(fake.registeredPushTokens).toHaveLength(2);
    expect(mockStore.has('push.cabut.server')).toBe(false);
    expect(fake.unregisteredPushTokens).toEqual([]);
  });

  test('mode contoh: tidak ada pencabutan', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    const api = await mount();
    expect((api.transport as FakeTransport).unregisteredPushTokens).toEqual([]);
    expect(mockStore.has('push.cabut.contoh')).toBe(false);
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

  test('ditolak tapi masih boleh ditanya lagi (Android 13+): tombol meminta izin lagi, bukan membuka pengaturan', async () => {
    N.getPermissionsAsync.mockResolvedValue(DENIED_ASK);
    N.requestPermissionsAsync.mockResolvedValue(GRANTED);
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await mount(<IzinNotifikasi />);
    expect(screen.queryByText('Notifikasi sedang dimatikan')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Buka pengaturan' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Izinkan' }));
    expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    await advance(300);
    expect(router.back).toHaveBeenCalledTimes(1);
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
    [UNDETERMINED, 'Perlu izin'],
    [GRANTED, 'Nyala'],
    [DENIED, 'Perlu izin'],
    [DENIED_ASK, 'Perlu izin'],
  ])('baris Pemberitahuan menyebut keadaannya dalam satu-dua kata (%#)', async (permission, text) => {
    N.getPermissionsAsync.mockResolvedValue(permission);
    await mount(<Akun />);
    await fireEvent.press(screen.getByRole('button', { name: `Pemberitahuan. ${text}` }));
    expect(router.push).toHaveBeenCalledWith('/akun/notifikasi');
  });

  test('izin ada tetapi semua jenis kabar dimatikan: Mati', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    const api = createTestApi();
    await api.transport.setNotifications({
      pesan: false,
      pengingat: false,
      ringkasanHarian: false,
      rumah: false,
      usaha: false,
    });
    await mount(<Akun />, api);
    expect(screen.getByRole('button', { name: 'Pemberitahuan. Mati' })).toBeOnTheScreen();
  });

  test('halaman Pemberitahuan: izin HP yang sudah ada cukup dibaca, tidak membuka apa-apa', async () => {
    N.getPermissionsAsync.mockResolvedValue(GRANTED);
    await mount(<Notifikasi />);
    expect(screen.getByText('Nyala')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Izin HP/ })).toBeNull();
  });

  test('halaman Pemberitahuan: izin ditolak membuka lembar izin (yang mengarah ke pengaturan HP)', async () => {
    N.getPermissionsAsync.mockResolvedValue(DENIED);
    await mount(<Notifikasi />);
    await fireEvent.press(screen.getByRole('button', { name: 'Izin HP. Perlu izin' }));
    expect(router.push).toHaveBeenCalledWith('/izin-notifikasi');
  });
});
