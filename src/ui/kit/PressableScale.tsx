import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '@/theme/tokens';
import { haptic, type HapticKind } from './haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Skala saat ditekan; bawaan 0,97 (tombol remote 0,94). */
  scaleTo?: number;
  /** Getar saat ditekan; bawaan tanpa getar. */
  haptic?: HapticKind;
  /** Getar sudah saat jari menyentuh (remote), bukan saat dilepas. */
  hapticOnPressIn?: boolean;
}

/**
 * Pressable yang mengecil dengan pegas saat ditekan (§4: 0,97, damping 18, stiffness 320, mass 0,6) dan bisa bergetar.
 * Peran dan label aksesibilitas diteruskan apa adanya. Dengan "kurangi gerakan" tidak mengecil; getar tetap.
 * Tahan (`onLongPress`) bawaannya 300 ms.
 */
export function PressableScale({
  children,
  style,
  scaleTo = motion.press.scale,
  haptic: hapticKind,
  hapticOnPressIn = false,
  onPress,
  onPressIn,
  onPressOut,
  delayLongPress = motion.longPress,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      delayLongPress={delayLongPress}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      onPressIn={(e) => {
        if (!reduce) scale.set(withSpring(scaleTo, motion.press.spring));
        if (hapticOnPressIn) haptic(hapticKind);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(reduce ? 1 : withSpring(1, motion.press.spring));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (!hapticOnPressIn) haptic(hapticKind);
        onPress?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
