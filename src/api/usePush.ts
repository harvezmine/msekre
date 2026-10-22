import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { useLastNotificationResponse } from './notificationResponse';
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
import { DEFAULT_ASSISTANT } from '@/brand';
import { useApi } from './ApiProvider';
import { needsSignIn } from './mode';
import { isChatFocused } from './pushPresence';
import { canOpen, routeKind } from './routeAccess';
import { readSecure, writeSecure } from './secureStore';
import { useAuth } from './useAuth';

/** `undetermined`: belum pernah ditanya; `denied`: ditolak atau dimatikan di pengaturan HP. */
export type PushPermission = 'undetermined' | 'granted' | 'denied';

export interface Push {
  permission: PushPermission;
  /**
   * Apakah sistem masih mau menampilkan jendela izin. Android 13+: penolakan pertama masih boleh ditanya lagi
   * (`denied` dengan `canAskAgain`); setelah itu hanya pengaturan HP yang bisa menyalakannya.
   */
  canAskAgain: boolean;
  /** Minta izin notifikasi ke sistem (Android 13+: POST_NOTIFICATIONS). Hasilnya status terbaru. */
  ask(): Promise<PushPermission>;
  /** Buka pengaturan notifikasi aplikasi di HP (untuk izin yang sudah ditolak dan tidak bisa ditanya lagi). */
  openSettings(): void;
  /**
   * Dipanggil sekali selesai pengenalan: membuka lembar ajakan izin kalau belum pernah ditanya dan belum pernah
   * ditawarkan. Selebihnya tidak melakukan apa-apa, jadi tidak mengganggu berulang.
   */
  offerAfterOnboarding(): Promise<void>;
}

const INERT: Push = {
  permission: 'undetermined',
  canAskAgain: true,
  ask: () => Promise.resolve('undetermined'),
  openSettings: () => {},
  offerAfterOnboarding: () => Promise.resolve(),
};

export const PushContext = createContext<Push>(INERT);

/**
 * Saluran Android. Dibuat tiap aplikasi mulai; pembuatan ulang dengan id yang sama hanya memperbarui nama (pilihan
 * pengguna seperti suara tidak berubah). Jenis notifikasi dari server: `data.kind` = `pesan` (balasan asisten) atau
 * `pengingat`; tanpa `data.kind`, saluran notifikasinya yang menentukan.
 */
export const CHANNEL_PESAN = 'pesan';
export const CHANNEL_PENGINGAT = 'pengingat';

const ASKED_KEY = 'push.ditawari';
/** Token terakhir yang terkirim ke server, per mode. */
const tokenKey = (mode: string) => `push.token.${mode}`;
/** Token yang harus dicabut dari server (daftar JSON), per mode: keluar saat tidak ada sinyal, dicoba lagi nanti. */
const pendingKey = (mode: string) => `push.cabut.${mode}`;
/** Layar yang boleh dibuka dari `data.route` di notifikasi, persis seperti tertulis. Selain ini membuka chat. */
const TAP_ROUTES: readonly string[] = ['/chat', '/agenda', '/riwayat', '/akun', '/terhubung', '/perangkat'];

interface PermissionState {
  permission: PushPermission;
  canAskAgain: boolean;
}

function toState(res: Notifications.NotificationPermissionsStatus): PermissionState {
  const permission: PushPermission = res.granted ? 'granted' : res.status === 'denied' ? 'denied' : 'undetermined';
  return { permission, canAskAgain: res.canAskAgain !== false };
}

/**
 * Tujuan ketukan: `data.route` kalau persis salah satu layar aplikasi yang diizinkan, selain itu chat. Jalur dengan
 * `..`, `//`, garis miring terbalik, query, hash, atau karakter di luar huruf kecil dan `/` ditolak.
 */
export function tapTarget(data: unknown): Href {
  const route = (data as { route?: unknown } | null | undefined)?.route;
  if (
    typeof route === 'string' &&
    /^\/[a-z/]*$/.test(route) &&
    !route.includes('..') &&
    !route.includes('//') &&
    TAP_ROUTES.includes(route) &&
    routeKind(route) === 'app'
  ) {
    return route as Href;
  }
  return '/chat';
}

/** Apakah ini pesan chat (bukan pengingat): `data.kind` kalau ada, selain itu saluran notifikasinya. */
function isChatMessage(notification: Notifications.Notification | undefined): boolean {
  const request = notification?.request;
  const kind = (request?.content?.data as { kind?: unknown } | null | undefined)?.kind;
  if (typeof kind === 'string') return kind === 'pesan';
  const trigger = request?.trigger as
    { channelId?: unknown; remoteMessage?: { notification?: { channelId?: unknown } } } | null | undefined;
  return (trigger?.channelId ?? trigger?.remoteMessage?.notification?.channelId) === CHANNEL_PESAN;
}

async function readList(key: string): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse((await readSecure(key)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string' && t !== '') : [];
  } catch {
    return [];
  }
}

async function writeList(key: string, list: string[]) {
  await writeSecure(key, list.length ? JSON.stringify(list) : null);
}

/** Lupakan jawaban terakhir di sistem, supaya muat ulang JS atau pembaruan OTA tidak memutarnya lagi. */
function clearTapResponse() {
  try {
    Notifications.clearLastNotificationResponse();
  } catch {
    // Modul lama tanpa fungsi ini: `handledTap` tetap mencegah pengulangan selama proses hidup.
  }
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
  const { status: authStatus, me } = useAuth();
  const [state, setState] = useState<PermissionState>({ permission: 'undetermined', canAskAgain: true });
  const { permission } = state;
  const assistantName = me?.assistantName?.trim() || DEFAULT_ASSISTANT;

  // Saluran: tiap aplikasi mulai, dan nama saluran pesan mengikuti nama asisten (Android boleh mengubah nama saluran).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void Notifications.setNotificationChannelAsync(CHANNEL_PESAN, {
      name: `Pesan dari ${assistantName}`,
      importance: AndroidImportance.HIGH,
      lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
    }).catch(() => {});
    void Notifications.setNotificationChannelAsync(CHANNEL_PENGINGAT, {
      name: 'Pengingat',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    }).catch(() => {});
  }, [assistantName]);

  // Penangan tampil: sekali. Selagi chat terbuka hanya pesan chat yang diredam; pengingat selalu tampil.
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const quiet = isChatFocused() && isChatMessage(notification);
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
        .then((res) => alive && setState(toState(res)))
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

  // Token ke server: setelah izin ada dan (mode akun dan server) sudah masuk. Dikirim sekali per proses aplikasi (setiap
  // mulai dari keadaan mati, supaya pendaftaran yang hilang pulih) dan tiap token berubah; `sent` mencegah kiriman
  // berulang selama aplikasi hidup. Token terakhir juga disimpan di HP, hanya untuk dicabut saat keluar.
  const sent = useRef(new Map<string, string>());
  useEffect(() => {
    if (permission !== 'granted') return;
    if (needsSignIn(mode) && authStatus !== 'signedIn') return;
    let alive = true;
    let running = false;
    const key = tokenKey(mode);
    const sync = async () => {
      if (running) return;
      running = true;
      try {
        const token = await Notifications.getDevicePushTokenAsync();
        if (!alive || (token.type !== 'android' && token.type !== 'ios') || typeof token.data !== 'string') return;
        if (sent.current.get(key) === token.data) return;
        // Token yang akan didaftarkan tidak boleh ikut dicabut oleh sisa keluar sebelumnya.
        const pending = await readList(pendingKey(mode));
        if (pending.includes(token.data))
          await writeList(
            pendingKey(mode),
            pending.filter((t) => t !== token.data),
          );
        if (!alive) return;
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

  // Keluar (mode akun dan server): token yang tadi terkirim dicabut dari server. Pemberitahuan `auth/logout` bisa tidak sampai
  // (tanpa sinyal), jadi tokennya dicatat dulu sebagai "belum dicabut" dan dicoba lagi tiap aplikasi dibuka atau
  // kembali aktif selama masih keluar, sampai server menjawab.
  useEffect(() => {
    if (!needsSignIn(mode) || authStatus !== 'signedOut') return;
    const key = tokenKey(mode);
    const pend = pendingKey(mode);
    let running = false;
    const flush = async () => {
      if (running) return;
      running = true;
      try {
        const last = sent.current.get(key) ?? (await readSecure(key));
        sent.current.delete(key);
        const list = await readList(pend);
        if (last) {
          if (!list.includes(last)) list.push(last);
          await writeList(pend, list);
          await writeSecure(key, null);
        }
        const failed: string[] = [];
        for (const pushToken of list) {
          try {
            await transport.unregisterPushToken({ pushToken });
          } catch {
            failed.push(pushToken);
          }
        }
        // Yang berhasil dicabut dihapus; token yang baru ditambahkan selama menunggu (masuk lagi) tidak ikut terhapus.
        const now = await readList(pend);
        await writeList(
          pend,
          now.filter((t) => failed.includes(t) || !list.includes(t)),
        );
      } finally {
        running = false;
      }
    };
    void flush();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void flush();
    });
    return () => sub.remove();
  }, [mode, authStatus, transport]);

  const ask = useCallback(async () => {
    try {
      const next = toState(await Notifications.requestPermissionsAsync());
      setState(next);
      return next.permission;
    } catch {
      return 'denied' as const;
    }
  }, []);
  const openSettings = useCallback(() => void Linking.openSettings().catch(() => {}), []);
  const offerAfterOnboarding = useCallback(async () => {
    if (offered === null) offered = (await readSecure(ASKED_KEY)) !== null;
    if (offered) return;
    let now: PermissionState;
    try {
      now = toState(await Notifications.getPermissionsAsync());
    } catch {
      return;
    }
    setState(now);
    if (now.permission !== 'undetermined') return;
    offered = true;
    void writeSecure(ASKED_KEY, '1');
    router.push('/izin-notifikasi');
  }, []);

  const value = useMemo<Push>(
    () => ({ permission, canAskAgain: state.canAskAgain, ask, openSettings, offerAfterOnboarding }),
    [permission, state.canAskAgain, ask, openSettings, offerAfterOnboarding],
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
 * pengguna belum boleh membuka layar aplikasi (mode akun atau server, belum masuk), ketukan ditahan atau dibuang.
 */
export function useNotificationTap() {
  const { mode } = useApi();
  const { status } = useAuth();
  const response = useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (needsSignIn(mode) && status === 'checking') return;
    const id = `${response.notification.request.identifier}@${response.notification.date}`;
    if (handledTap === id) return;
    handledTap = id;
    if (!canOpen('app', mode, status)) return clearTapResponse();
    const target = tapTarget(response.notification.request.content.data);
    // Setelah navigator selesai dipasang (ketukan yang membuka aplikasi dingin tiba bersamaan dengan pemasangannya).
    let fired = false;
    const t = setTimeout(() => {
      fired = true;
      router.navigate(target);
      clearTapResponse();
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
