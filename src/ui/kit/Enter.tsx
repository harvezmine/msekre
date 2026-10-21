import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@/theme/tokens';

/** Jeda masuk blok ke-`index`: 80 ms per blok, paling banyak 3 blok berurutan (§5). */
export function enterDelay(index: number): number {
  return Math.min(Math.max(0, index), motion.block.maxStagger) * motion.block.stagger;
}

/**
 * Gaya blok yang muncul (§5): memudar dan naik 12 dp dalam 320 ms (`Easing.out(cubic)`), berurutan per `index`. Dengan
 * "kurangi gerakan" (atau `disabled`) langsung tampil. Untuk blok yang bergeser saat blok lain muncul/hilang, pakai
 * `blockLayout` sebagai prop `layout` Animated.View.
 */
export function useEnterAnimation(index = 0, { disabled = false }: { disabled?: boolean } = {}) {
  const reduce = useReducedMotion();
  const still = reduce || disabled;
  const p = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) {
      p.set(1);
      return;
    }
    p.set(
      withDelay(
        enterDelay(index),
        withTiming(1, { duration: motion.block.duration, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [still, index, p]);
  const rise = motion.block.rise;
  return useAnimatedStyle(() => ({
    opacity: p.get(),
    transform: [{ translateY: rise * (1 - p.get()) }],
  }));
}

/** Transisi tata letak blok di bawahnya saat blok muncul/hilang: 320 ms (Reanimated menghormati "kurangi gerakan"). */
export const blockLayout = LinearTransition.duration(motion.block.duration);

/**
 * Animasi masuk blok untuk prop `entering` (blok yang muncul atau berganti): pudar + naik 12 dp, 320 ms, jeda 80 ms per
 * urutan. "Kurangi gerakan": langsung tampil.
 */
export function blockEntering(index = 0) {
  return FadeInDown.duration(motion.block.duration)
    .delay(enterDelay(index))
    .easing(Easing.out(Easing.cubic))
    .withInitialValues({ opacity: 0, transform: [{ translateY: motion.block.rise }] });
}

/** Blok pergi (persetujuan terkirim): memudar 260 ms; blok di bawahnya naik lewat `blockLayout`. */
export const blockExiting = FadeOut.duration(motion.block.leave);

/** Pembungkus `useEnterAnimation`: `<Enter index={2}>…</Enter>`. */
export function Enter({
  index = 0,
  disabled,
  children,
  style,
  testID,
}: {
  index?: number;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const enter = useEnterAnimation(index, { disabled });
  return (
    <Animated.View testID={testID} style={[style, enter]}>
      {children}
    </Animated.View>
  );
}
