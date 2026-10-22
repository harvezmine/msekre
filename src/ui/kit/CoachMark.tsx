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
 * Petunjuk sekali-lihat (§6.3, §8): gelembung tinta dengan panah, muncul memudar sambil naik 6 dp (280 ms). Mengisi
 * seluruh induknya dengan lapisan tembus pandang: ketukan di mana pun menutupnya.
 * - `bottom`: jarak ujung bawah gelembung dari bawah induk; panahnya menunjuk ke bawah (sasaran di bawahnya).
 * - `top`: jarak ujung atas panah dari atas induk; panahnya menunjuk ke atas (Inti besar di atas Beranda).
 */
export function CoachMark({
  text,
  bottom,
  top,
  onDismiss,
}: {
  text: string;
  bottom?: number;
  top?: number;
  onDismiss: () => void;
}) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const up = top !== undefined;
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
        style={[
          { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
          up ? { top } : { bottom: bottom ?? 0 },
          style,
        ]}
      >
        {up ? <Arrow color={c.tip} up /> : null}
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
        {up ? null : <Arrow color={c.tip} />}
      </Animated.View>
    </Pressable>
  );
}

/** Panah: persegi kecil diputar 45°, setengahnya keluar dari bawah (atau atas) gelembung. */
function Arrow({ color, up = false }: { color: string; up?: boolean }) {
  return (
    <View
      style={{
        width: 16,
        height: 16,
        ...(up ? { marginBottom: -9, zIndex: 1 } : { marginTop: -9 }),
        borderRadius: 3,
        backgroundColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
  );
}
