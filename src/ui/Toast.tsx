import { useEffect } from 'react';
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
import { Txt } from './Txt';

export const TOAST_MS = 2600;
/** Tinggi tab bar tanpa bagian bawah layar, supaya toast duduk 16 dp di atasnya. */
const TAB_BAR = 88;

/** Bilah gelap di bawah, muncul memudar sambil naik 8 dp (sk-toast). Dibaca pembaca layar dengan sopan. */
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
      accessibilityLiveRegion="polite"
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

/** Dipasang sekali di akar aplikasi. Membaca `state.toast`, hilang sendiri setelah 2,6 detik. */
export function ToastHost() {
  const { state, dispatch } = useSample();
  const insets = useSafeAreaInsets();
  const text = state.toast;
  useEffect(() => {
    if (text === null) return;
    const t = setTimeout(() => dispatch({ type: 'hideToast' }), TOAST_MS);
    return () => clearTimeout(t);
  }, [text, dispatch]);
  if (text === null) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + TAB_BAR + 16 }}
    >
      <Toast key={text} text={text} />
    </Animated.View>
  );
}
