import * as Notifications from 'expo-notifications';
import { usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { APP_NAME } from '@/brand';
import { useTheme } from '@/theme/ThemeProvider';
import { isAlarmTarget, showOnResume, skipOnLaunch } from './launchSplashGate';
import { Txt } from './Txt';

const MARK = require('../../assets/brand/s-mark.png');
const MARK_LIGHT = require('../../assets/brand/s-mark-light.png');

/** Sama dengan layar pembuka asli (app.config.ts): lebar 120 dp, gambar 282×310, tepat di tengah. */
const MARK_W = 120;
const MARK_H = Math.round((MARK_W * 310) / 282);
/** Gerak penuh: masuk 950 ms lalu memudar 250 ms (total 1,2 detik). */
const ENTER_MS = 950;
const FADE_MS = 250;
/** Gerak dikurangi: tanda dan nama diam 400 ms lalu memudar. */
const REDUCED_HOLD_MS = 400;
const SKIP_FADE_MS = 150;

interface HostState {
  visible: boolean;
  /** Dipakai untuk memulai ulang animasi tiap kali layar tampil. */
  run: number;
  /** Boleh mulai bergerak: layar pembuka asli sudah menghilang (atau ini bukan mulai dingin). */
  started: boolean;
  /** Keputusan mulai dingin (tampil atau dilewati) sudah diambil. */
  resolved: boolean;
  /** Dipanggil setelah layar pembuka asli disembunyikan. */
  onNativeHidden(): void;
  dismiss(): void;
}

/**
 * Kapan layar pembuka tampil: tiap mulai dingin (kecuali dari alarm atau ketukan notifikasi) dan saat aplikasi
 * kembali dibuka setelah 30 menit di latar. Tertutup sendiri bila layar alarm terbuka.
 */
export function useLaunchSplash(): HostState {
  const pathname = usePathname();
  const response = Notifications.useLastNotificationResponse();
  const [wanted, setWanted] = useState(true);
  const [run, setRun] = useState(0);
  const [cold, setCold] = useState(true);
  const [nativeHidden, setNativeHidden] = useState(false);
  const [initialUrl, setInitialUrl] = useState<string | null | undefined>(undefined);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let alive = true;
    Linking.getInitialURL().then(
      (u) => alive && setInitialUrl(u ?? null),
      () => alive && setInitialUrl(null),
    );
    return () => {
      alive = false;
    };
  }, []);

  // Keputusan mulai dingin, sekali, setelah tautan awal dan jawaban notifikasi diketahui.
  if (!resolved && initialUrl !== undefined && response !== undefined) {
    setResolved(true);
    if (skipOnLaunch({ initialUrl, hasNotificationResponse: response !== null })) setWanted(false);
  }

  // Layar alarm terbuka: layar pembuka tidak boleh menutupinya.
  const alarmOpen = isAlarmTarget(pathname);
  if (alarmOpen && wanted) setWanted(false);
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let backgroundedAt: number | null = null;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        backgroundedAt ??= Date.now();
      } else if (next === 'active') {
        const show = showOnResume({ backgroundedAt, now: Date.now(), pathname: pathRef.current });
        backgroundedAt = null;
        if (show) {
          setCold(false);
          setRun((r) => r + 1);
          setWanted(true);
        }
      }
    });
    return () => sub.remove();
  }, []);

  const onNativeHidden = useCallback(() => setNativeHidden(true), []);
  const dismiss = useCallback(() => setWanted(false), []);
  return { visible: wanted && !alarmOpen, run, started: !cold || nativeHidden, resolved, onNativeHidden, dismiss };
}

/**
 * Layar pembuka animasi di atas navigator. Bingkai pertamanya sama dengan layar pembuka asli (warna latar, tanda S,
 * ukuran, tengah), supaya tidak ada loncatan. Ketuk di mana saja untuk melewati.
 */
export function LaunchSplash({ state }: { state: HostState }) {
  if (!state.visible) return null;
  return <Overlay key={state.run} started={state.started} onDone={state.dismiss} />;
}

function Overlay({ started, onDone }: { started: boolean; onDone(): void }) {
  const { c, scheme } = useTheme();
  const reduce = useReducedMotion();
  const enter = useSharedValue(reduce ? 1 : 0);
  const out = useSharedValue(1);
  const skipped = useRef(false);

  useEffect(() => {
    if (!started) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const hold = reduce ? REDUCED_HOLD_MS : ENTER_MS;
    if (!reduce) enter.set(withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }));
    const fade = setTimeout(() => {
      if (skipped.current) return;
      out.set(withTiming(0, { duration: FADE_MS }));
      t = setTimeout(onDone, FADE_MS);
    }, hold);
    return () => {
      clearTimeout(fade);
      clearTimeout(t);
    };
  }, [started, reduce, enter, out, onDone]);

  const skip = () => {
    if (skipped.current) return;
    skipped.current = true;
    out.set(withTiming(0, { duration: SKIP_FADE_MS }));
    setTimeout(onDone, SKIP_FADE_MS);
  };

  const root = useAnimatedStyle(() => ({ opacity: out.get() }));
  const mark = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.06 * enter.get() }] }));
  const ring = useAnimatedStyle(() => ({
    opacity: 0.32 * (1 - enter.get()) * (reduce ? 0 : 1),
    transform: [{ scale: 0.9 + 0.55 * enter.get() }],
  }));
  const word = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (enter.get() - 0.2) / 0.5));
    return { opacity: reduce ? 1 : p, transform: [{ translateY: reduce ? 0 : 10 * (1 - p) }] };
  });

  return (
    <Animated.View testID="launch-splash" style={[StyleSheet.absoluteFill, { backgroundColor: c.paper }, root]}>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={APP_NAME}
        accessibilityHint="Ketuk untuk melanjutkan"
        onPress={skip}
        style={styles.center}
      >
        <Animated.View
          testID="launch-splash-ring"
          style={[styles.ring, { borderColor: scheme === 'dark' ? c.sage : c.leaf }, ring]}
        />
        <Animated.View style={mark}>
          <Image
            testID="launch-splash-mark"
            source={scheme === 'dark' ? MARK_LIGHT : MARK}
            style={{ width: MARK_W, height: MARK_H }}
            accessibilityElementsHidden
          />
        </Animated.View>
        <Animated.View style={[styles.word, word]}>
          <Txt weight={700} color={c.ink} style={{ fontSize: 26, lineHeight: 32, letterSpacing: -0.5 }}>
            {APP_NAME}
          </Txt>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const RING = 168;
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
  },
  // Di bawah tanda; posisinya mutlak supaya tanda tetap tepat di tengah layar.
  word: { position: 'absolute', top: '50%', marginTop: MARK_H / 2 + 28, alignItems: 'center' },
});
