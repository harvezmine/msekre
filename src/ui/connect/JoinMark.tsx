import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { ServiceLogo, type LogoStatus } from '../kit/ServiceLogo';

/** `idle`: dua ubin dengan titik-titik di antaranya; `working`: titik hijau mengalir; `joined`: garis hijau + centang. */
export type JoinState = 'idle' | 'working' | 'joined';

/** Waktu gerak bergabung (ms): logo meluncur, garis tergambar, lalu centang muncul. */
export const JOIN_MS = { slide: 520, lineDelay: 360, line: 420, tickDelay: 740, tick: 360, travel: 1300 } as const;

const DOTS = 6;

/**
 * Logo layanan dan tanda S asisten berdampingan, dihubungkan garis lembut (lembar Masuk dan layar Tersambung). Saat
 * `animate`, logo layanan meluncur pelan ke arah tanda S, garisnya tergambar dari kiri, lalu centang hijau muncul di
 * tengah garis (sekali per sambungan). "Kurangi gerakan": langsung keadaan akhir, tanpa titik yang mengalir.
 */
export function JoinMark({
  id,
  name,
  size = 56,
  state,
  animate = false,
  status,
  testID,
}: {
  id: string;
  name: string;
  size?: number;
  state: JoinState;
  /** Gerak bergabung dari awal (Tersambung, sekali per sambungan). */
  animate?: boolean;
  /** Keadaan logo layanan (segera hadir = redup). */
  status?: LogoStatus;
  testID?: string;
}) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const still = reduce || !animate;
  const joined = state === 'joined';
  const gap = Math.round(size * 1.3);
  const tickSize = Math.max(22, Math.round(size * 0.4));

  const enter = useSharedValue(still ? 1 : 0);
  const link = useSharedValue(joined && still ? 1 : 0);
  const tick = useSharedValue(joined && still ? 1 : 0);
  const travel = useSharedValue(0);

  useEffect(() => {
    if (still) {
      enter.set(1);
      link.set(joined ? 1 : 0);
      tick.set(joined ? 1 : 0);
      return;
    }
    const out = Easing.out(Easing.cubic);
    enter.set(withTiming(1, { duration: JOIN_MS.slide, easing: out }));
    if (joined) {
      link.set(withDelay(JOIN_MS.lineDelay, withTiming(1, { duration: JOIN_MS.line, easing: out })));
      tick.set(
        withDelay(JOIN_MS.tickDelay, withTiming(1, { duration: JOIN_MS.tick, easing: Easing.out(Easing.back(1.6)) })),
      );
    } else {
      link.set(0);
      tick.set(0);
    }
  }, [still, joined, enter, link, tick]);

  const flowing = state === 'working' && !reduce;
  useEffect(() => {
    if (!flowing) {
      cancelAnimation(travel);
      travel.set(0);
      return;
    }
    travel.set(0);
    travel.set(withRepeat(withTiming(1, { duration: JOIN_MS.travel, easing: Easing.inOut(Easing.quad) }), -1, false));
    return () => cancelAnimation(travel);
  }, [flowing, travel]);

  const slide = size * 0.6;
  const serviceStyle = useAnimatedStyle(() => ({
    opacity: enter.get(),
    transform: [{ translateX: -slide * (1 - enter.get()) }],
  }));
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: link.get() }] }));
  const dotsStyle = useAnimatedStyle(() => ({ opacity: 1 - link.get() }));
  const tickStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, tick.get()),
    transform: [{ scale: 0.5 + 0.5 * tick.get() }],
  }));
  const travelStyle = useAnimatedStyle(() => {
    const t = travel.get();
    return { opacity: Math.sin(Math.PI * t), transform: [{ translateX: (gap - 8) * t }] };
  });

  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Animated.View testID="sambungan-layanan" style={[{ zIndex: 1 }, serviceStyle]}>
        <ServiceLogo id={id} name={name} size={size} status={status} />
      </Animated.View>
      <View style={{ width: gap, height: size, justifyContent: 'center' }}>
        <Animated.View
          style={[{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 }, dotsStyle]}
        >
          {Array.from({ length: DOTS }, (_, i) => (
            <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.faint }} />
          ))}
        </Animated.View>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: (size - 2.5) / 2,
              left: 6,
              right: 6,
              height: 2.5,
              borderRadius: 2,
              backgroundColor: c.brand,
              transformOrigin: 'left',
            },
            lineStyle,
          ]}
        />
        {flowing ? (
          <Animated.View
            testID="sambungan-titik"
            style={[
              {
                position: 'absolute',
                top: (size - 8) / 2,
                left: 0,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: c.brand,
              },
              travelStyle,
            ]}
          />
        ) : null}
        {joined ? (
          <Animated.View
            testID="sambungan-centang"
            style={[
              {
                position: 'absolute',
                top: (size - tickSize) / 2,
                left: (gap - tickSize) / 2,
                width: tickSize,
                height: tickSize,
                borderRadius: tickSize / 2,
                borderWidth: 3,
                borderColor: c.bg,
                backgroundColor: c.brand,
                alignItems: 'center',
                justifyContent: 'center',
              },
              tickStyle,
            ]}
          >
            <Icon name="check" size={Math.round(tickSize * 0.56)} color={c.onBrand} strokeWidth={3} />
          </Animated.View>
        ) : null}
      </View>
      <ServiceLogo id="sekretaris" name="Sekretaris AI" size={size} />
    </View>
  );
}
