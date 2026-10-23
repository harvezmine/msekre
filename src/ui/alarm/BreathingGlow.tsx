import { useEffect, useId } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { gradients } from '@/theme/tokens';

/** Satu tarikan napas cahaya (masuk lalu keluar), pelan supaya menenangkan, bukan mengagetkan. */
const BREATH_MS = 2400;

/**
 * Cahaya bernapas di belakang jam alarm: dua elips gradasi brand (hijau dan toska) yang memudar ke tepi, membesar dan
 * menerang pelan lalu kembali. Diam (napas setengah) dengan gerak dikurangi atau saat `paused`. Tidak menangkap
 * sentuhan dan tidak dibaca pembaca layar.
 */
export function BreathingGlow({
  size,
  paused = false,
  style,
}: {
  size: number;
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion() || paused;
  const t = useSharedValue(0.5);
  useEffect(() => {
    t.set(
      reduce
        ? 0.5
        : withRepeat(
            withSequence(
              withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }),
              withTiming(0, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
          ),
    );
  }, [reduce, t]);
  const breath = useAnimatedStyle(() => {
    const v = Math.min(1, Math.max(0, t.get()));
    return { opacity: 0.5 + 0.5 * v, transform: [{ scale: 0.9 + 0.1 * v }] };
  });
  // Id unik per gambar (beberapa SVG di satu halaman web berbagi ruang id); tanpa ":" supaya aman di url(#...).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const half = size / 2;
  return (
    <Animated.View
      testID="alarm-cahaya"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size }, style, breath]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`ag${uid}a`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={gradients.waves.green} stopOpacity={0.55} />
            <Stop offset="1" stopColor={gradients.waves.green} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`ag${uid}b`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={gradients.waves.teal} stopOpacity={0.35} />
            <Stop offset="1" stopColor={gradients.waves.teal} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={half} cy={half} rx={half} ry={half * 0.82} fill={`url(#ag${uid}a)`} />
        <Ellipse cx={half * 1.12} cy={half * 0.9} rx={half * 0.62} ry={half * 0.5} fill={`url(#ag${uid}b)`} />
      </Svg>
    </Animated.View>
  );
}
