import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Sakelar 52×32. hitSlop membuat area sentuhnya 56 dp. Geser dan warna berpindah 200 ms, getar `selection` saat diketuk.
 * Nyala = hijau (`active`), mati = `sunken2`; sama untuk perangkat dan pengaturan.
 */
export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  const { c, shadow } = useTheme();
  const off = c.sunken2;
  const on = c.brand;
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(value ? 1 : 0, { duration: 200 }));
  }, [value, p]);
  const trackStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.get(), [0, 1], [off, on]) }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: 20 * p.get() }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(!value);
      }}
      hitSlop={12}
      style={{ alignSelf: 'flex-start' }}
    >
      <Animated.View style={[{ width: 52, height: 32, borderRadius: 16, padding: 4 }, trackStyle]}>
        <Animated.View
          testID="sakelar-jempol"
          style={[
            { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', boxShadow: shadow.knob },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
