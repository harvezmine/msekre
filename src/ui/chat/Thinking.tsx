import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

/** Tanda berpikir: tiga titik naik dan terang bergantian (jeda 180 ms, satu siklus 1,2 detik) seperti Inti. Dengan gerak dikurangi, titik diam. */
export function Thinking({ paused = false }: { paused?: boolean }) {
  const { c } = useTheme();
  const reduce = useReducedMotion() || paused;
  return (
    <View
      testID="berpikir"
      accessibilityLabel="Sedang berpikir"
      accessibilityLiveRegion="polite"
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
        height: 56,
        paddingHorizontal: 18,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
        borderBottomLeftRadius: 6,
      }}
    >
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} pulse={!reduce} color={c.green} />
      ))}
    </View>
  );
}

function Dot({ index, pulse, color }: { index: number; pulse: boolean; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(
      pulse
        ? withDelay(
            index * 180,
            withRepeat(
              withSequence(
                withTiming(1, { duration: 420 }),
                withTiming(0, { duration: 420 }),
                withTiming(0, { duration: 360 }),
              ),
              -1,
            ),
          )
        : 0,
    );
  }, [pulse, index, t]);
  const style = useAnimatedStyle(() =>
    pulse
      ? { opacity: 0.35 + 0.65 * t.get(), transform: [{ translateY: -3 * t.get() }] }
      : { opacity: 1, transform: [{ translateY: 0 }] },
  );
  return (
    <Animated.View
      testID={`berpikir-titik-${index}`}
      style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }, style]}
    />
  );
}
