import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';
import { Txt } from '../Txt';

/**
 * Petunjuk sekali-lihat (§6.3, §8): gelembung tinta dengan panah ke bawah, muncul memudar sambil naik 6 dp (280 ms).
 * Mengisi seluruh induknya dengan lapisan tembus pandang: ketukan di mana pun menutupnya. `bottom` = jarak ujung bawah
 * gelembung dari bawah induk, supaya panahnya menunjuk sasaran di bawahnya (Inti).
 */
export function CoachMark({ text, bottom, onDismiss }: { text: string; bottom: number; onDismiss: () => void }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) p.set(withTiming(1, { duration: motion.coach.duration, easing: Easing.out(Easing.cubic) }));
  }, [reduce, p]);
  const style = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ translateY: 6 * (1 - p.get()) }] }));
  return (
    <Pressable
      testID="petunjuk"
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint="Ketuk untuk menutup petunjuk"
      onPress={onDismiss}
      style={StyleSheet.absoluteFill}
    >
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', left: 16, right: 16, bottom, alignItems: 'center' }, style]}
      >
        <View
          style={{
            backgroundColor: c.tip,
            borderRadius: 18,
            paddingVertical: 14,
            paddingHorizontal: 18,
            boxShadow: '0 12px 30px -8px rgba(0,0,0,0.35)',
          }}
        >
          <Txt weight={600} color={c.onTip} style={{ fontSize: 15, lineHeight: 20, textAlign: 'center' }}>
            {text}
          </Txt>
        </View>
        {/* Panah: persegi kecil diputar 45°, setengahnya keluar dari bawah gelembung. */}
        <View
          style={{
            width: 16,
            height: 16,
            marginTop: -9,
            borderRadius: 3,
            backgroundColor: c.tip,
            transform: [{ rotate: '45deg' }],
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
