import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { useTabBarShown } from './tabBarShown';
import { Txt } from './Txt';

export const TOAST_MS = 2600;
/** Tinggi tab bar tanpa bagian bawah layar; toast duduk 16 dp di atasnya bila tab bar terlihat. */
const TAB_BAR = 88;

/** Bilah gelap di bawah, muncul memudar sambil naik 8 dp (sk-toast). Dibaca pembaca layar lewat pengumuman di ToastHost (satu kali). */
export function Toast({ text }: { text: string }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) p.set(withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }));
  }, [reduce, p]);
  const style = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ translateY: 8 * (1 - p.get()) }] }));
  return (
    <Animated.View
      testID="toast"
      accessibilityRole="alert"
      style={[
        {
          alignSelf: 'center',
          maxWidth: 420,
          marginHorizontal: 16,
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 16,
          backgroundColor: c.ink,
        },
        style,
      ]}
    >
      <Txt weight={500} color={c.paper} style={{ fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
        {text}
      </Txt>
    </Animated.View>
  );
}

/**
 * Dipasang sekali di akar aplikasi. Membaca `state.toast`, dibacakan pembaca layar, dan hilang sendiri setelah
 * 2,6 detik. Toast baru (juga dengan teks yang sama) memulai ulang waktunya dan dibacakan lagi.
 */
export function ToastHost() {
  const { state, dispatch } = useSample();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarShown();
  const id = state.toast?.id;
  const text = state.toast?.text;
  useEffect(() => {
    if (id === undefined || text === undefined) return;
    AccessibilityInfo.announceForAccessibility(text);
    const t = setTimeout(() => dispatch({ type: 'hideToast', id }), TOAST_MS);
    return () => clearTimeout(t);
  }, [id, text, dispatch]);
  if (id === undefined || text === undefined) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 16 + (tabBar ? TAB_BAR : 0) }}
    >
      <Toast key={id} text={text} />
    </Animated.View>
  );
}
