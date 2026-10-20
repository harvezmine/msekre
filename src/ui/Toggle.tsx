import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

/** Sakelar 52×32 seperti di desain. hitSlop membuat area sentuhnya 48dp. Geser dan warna berpindah 200 ms. */
export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  const { c } = useTheme();
  const off = c.track;
  const on = c.green;
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
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={{ alignSelf: 'flex-start' }}
    >
      <Animated.View style={[{ width: 52, height: 32, borderRadius: 16, padding: 4 }, trackStyle]}>
        <Animated.View
          testID="sakelar-jempol"
          style={[{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' }, thumbStyle]}
        />
      </Animated.View>
    </Pressable>
  );
}
