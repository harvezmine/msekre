import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import {
  createContext,
  createElement,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { useApi } from './ApiProvider';
import { isChatFocused } from './pushPresence';
import { canOpen, routeKind } from './routeAccess';
import { readSecure, writeSecure } from './secureStore';
import { useAuth } from './useAuth';

/** `undetermined`: belum pernah ditanya; `denied`: ditolak atau dimatikan di pengaturan HP. */
export type PushPermission = 'undetermined' | 'granted' | 'denied';

export interface Push {
  permission: PushPermission;
  /** Minta izin notifikasi ke sistem (Android 13+: POST_NOTIFICATIONS). Hasilnya status terbaru. */
  ask(): Promise<PushPermission>;
  /** Buka pengaturan notifikasi aplikasi di HP (untuk izin yang sudah ditolak). */
  openSettings(): void;
  /**
   * Dipanggil sekali selesai pengenalan: membuka lembar ajakan izin kalau belum pernah ditanya dan belum pernah
   * ditawarkan. Selebihnya tidak melakukan apa-apa, jadi tidak mengganggu berulang.
   */
  offerAfterOnboarding(): Promise<void>;
}

const INERT: Push = {
  permission: 'undetermined',
  ask: () => Promise.resolve('undetermined'),
  openSettings: () => {},
  offerAfterOnboarding: () => Promise.resolve(),
};

export const PushContext = createContext<Push>(INERT);

/** Saluran Android. Dibuat sekali; pembuatan ulang dengan id yang sama tidak mengubah pilihan pengguna. */
export const CHANNEL_PESAN = 'pesan';
export const CHANNEL_PENGINGAT = 'pengingat';

const ASKED_KEY = 'push.ditawari';
const tokenKey = (mode: string) => `push.token.${mode}`;
/** Layar yang boleh dibuka dari `data.route` di notifikasi. Selain ini membuka chat. */
const TAP_ROUTES = ['/chat', '/agenda', '/riwayat', '/akun', '/terhubung', '/perangkat'];

function toPermission(res: Notifications.NotificationPermissionsStatus): PushPermission {
  if (res.granted) return 'granted';
  return res.status === 'denied' ? 'denied' : 'undetermined';
}

/** Tujuan ketukan: `data.route` kalau layar aplikasi yang dikenal, selain itu chat. */
export function tapTarget(data: unknown): Href {
  const route = (data as { route?: unknown } | null | undefined)?.route;
  if (typeof route === 'string' && route.startsWith('/') && !route.startsWith('//')) {
    const path = route.split(/[?#]/)[0]!.replace(/\/+$/, '');
    const known = TAP_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));
    if (known && routeKind(path) === 'app') return route as Href;
  }
  return '/chat';
}

/** Ketukan yang sudah ditangani, supaya jawaban terakhir yang sama tidak membuka layar dua kali. */
let handledTap: string | null = null;
/** Apakah lembar ajakan izin sudah pernah ditawarkan (dibaca dari penyimpanan HP saat pertama dipakai). */
let offered: boolean | null = null;

/**
 * Notifikasi untuk seluruh aplikasi: saluran Android, penangan tampil (diredam selagi chat terbuka), izin, dan
 * pendaftaran token ke server. Ketukan notifikasi ditangani {@link PushTapHandler}. Di dalam `ApiProvider` dan
 * `AuthProvider`.
 */
export function PushProvider({ children }: { children: ReactNode }) {
  const { mode, transport } = useApi();
  const { status: authStatus } = useAuth();
  const [permission, setPermission] = useState<PushPermission>('undetermined');

  // Saluran dan penangan tampil: sekali.
  useEffect(() => {
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync(CHANNEL_PESAN, {
        name: 'Pesan dari Nadia',
        importance: AndroidImportance.HIGH,
      }).catch(() => {});
      void Notifications.setNotificationChannelAsync(CHANNEL_PENGINGAT, {
        name: 'Pengingat',
        importance: AndroidImportance.HIGH,
        sound: 'default',
      }).catch(() => {});
    }
    Notifications.setNotificationHandler({
      handleNotification: async () => {
        const quiet = isChatFocused();
        return { shouldShowBanner: !quiet, shouldShowList: !quiet, shouldPlaySound: !quiet, shouldSetBadge: false };
      },
    });
    return () => Notifications.setNotificationHandler(null);
  }, []);

  // Status izin: dibaca saat mulai dan tiap aplikasi kembali dibuka (pengguna bisa mengubahnya di pengaturan HP).
  useEffect(() => {
    let alive = true;
    const read = () =>
      Notifications.getPermissionsAsync()
        .then((res) => alive && setPermission(toPermission(res)))
        .catch(() => {});
    void read();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void read();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // Token ke server: setelah izin ada dan (mode server) sudah masuk; sekali per perubahan token. Token terakhir yang
  // terkirim diingat per mode. Keluar menghapus ingatannya, karena server mencabut token saat keluar.
  const sent = useRef(new Map<string, string>());
  useEffect(() => {
    if (mode === 'server' && authStatus === 'signedOut') {
      sent.current.delete(tokenKey(mode));
      void writeSecure(tokenKey(mode), null);
    }
  }, [mode, authStatus]);
  useEffect(() => {
    if (permission !== 'granted') return;
    if (mode === 'server' && authStatus !== 'signedIn') return;
    let alive = true;
    let running = false;
    const key = tokenKey(mode);
    const sync = async () => {
      if (running) return;
      running = true;
      try {
        const token = await Notifications.getDevicePushTokenAsync();
        if (!alive || (token.type !== 'android' && token.type !== 'ios') || typeof token.data !== 'string') return;
        const last = sent.current.get(key) ?? (await readSecure(key));
        if (!alive || last === token.data) return;
        await transport.registerPushToken({ pushToken: token.data, platform: token.type });
        sent.current.set(key, token.data);
        await writeSecure(key, token.data);
      } catch {
        // Tanpa Firebase atau tanpa sinyal: dicoba lagi saat token berubah atau aplikasi dibuka kembali.
      } finally {
        running = false;
      }
    };
    void sync();
    const tokenSub = Notifications.addPushTokenListener(() => void sync());
    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void sync();
    });
    return () => {
      alive = false;
      tokenSub.remove();
      appSub.remove();
    };
  }, [permission, mode, authStatus, transport]);

  const ask = useCallback(async () => {
    try {
      const next = toPermission(await Notifications.requestPermissionsAsync());
      setPermission(next);
      return next;
    } catch {
      return 'denied' as const;
    }
  }, []);
  const openSettings = useCallback(() => void Linking.openSettings().catch(() => {}), []);
  const offerAfterOnboarding = useCallback(async () => {
    if (offered === null) offered = (await readSecure(ASKED_KEY)) !== null;
    if (offered) return;
    let now: PushPermission;
    try {
      now = toPermission(await Notifications.getPermissionsAsync());
    } catch {
      return;
    }
    setPermission(now);
    if (now !== 'undetermined') return;
    offered = true;
    void writeSecure(ASKED_KEY, '1');
    router.push('/izin-notifikasi');
  }, []);

  const value = useMemo<Push>(
    () => ({ permission, ask, openSettings, offerAfterOnboarding }),
    [permission, ask, openSettings, offerAfterOnboarding],
  );
  return createElement(PushContext, { value }, children);
}

/** Izin notifikasi dan aksinya. Di luar {@link PushProvider} mengembalikan nilai kosong yang tidak berbuat apa-apa. */
export function usePush(): Push {
  return use(PushContext);
}

/**
 * Ketukan notifikasi membuka chat (atau `data.route`), juga saat aplikasi tertutup (jawaban terakhir yang disimpan
 * sistem). Dipasang di samping navigator, hanya saat navigator sudah tampil; selama sesi masih diperiksa atau
 * pengguna belum boleh membuka layar aplikasi (mode server, belum masuk), ketukan ditahan atau dibuang.
 */
export function useNotificationTap() {
  const { mode } = useApi();
  const { status } = useAuth();
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (mode === 'server' && status === 'checking') return;
    const id = `${response.notification.request.identifier}@${response.notification.date}`;
    if (handledTap === id) return;
    handledTap = id;
    if (!canOpen('app', mode, status)) return;
    const target = tapTarget(response.notification.request.content.data);
    // Setelah navigator selesai dipasang (ketukan yang membuka aplikasi dingin tiba bersamaan dengan pemasangannya).
    let fired = false;
    const t = setTimeout(() => {
      fired = true;
      router.navigate(target);
    }, 0);
    return () => {
      if (fired) return;
      // Dibatalkan sebelum jalan (pemasangan ulang): tandai belum ditangani.
      clearTimeout(t);
      if (handledTap === id) handledTap = null;
    };
  }, [response, mode, status]);
}

/** Memasang {@link useNotificationTap}. */
export function PushTapHandler() {
  useNotificationTap();
  return null;
}

/** Untuk tes: lupakan ketukan yang sudah ditangani. */
export function resetPushForTests() {
  handledTap = null;
  offered = null;
}
