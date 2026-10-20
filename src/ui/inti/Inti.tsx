import { useEffect, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { DOT_X, DOT_Y, intiSize } from './size';

export type IntiState = 'idle' | 'listen' | 'think' | 'speak' | 'off';

const RIBBON = require('../../../assets/brand/s-ribbon.png');
const RIBBON_LIGHT = require('../../../assets/brand/s-ribbon-light.png');
const SAGE = '#81C084';
const LISTEN_SCALE = [1.07, 1.02, 1.1, 1.03, 1.06, 1];
const LISTEN_MS = [210, 210, 252, 196, 252, 280];

interface Props {
  size: number;
  state?: IntiState;
  /** Di latar gelap (mode gelap, Mode Suara, alarm) pitanya hijau muda supaya tetap terbaca. */
  onDark?: boolean;
}

type Frame = { position: 'absolute'; left: number; top: number; width: number; height: number; borderRadius: number };

export function Inti({ size, state = 'idle', onDark = false }: Props) {
  const reduce = useReducedMotion();
  const { w, h, dot } = intiSize(size);
  const circle = (D: number): Frame => ({
    position: 'absolute',
    left: w / 2 - D / 2,
    top: h / 2 - D / 2,
    width: D,
    height: D,
    borderRadius: D / 2,
  });
  return (
    <View testID="inti" style={{ width: w, height: h }}>
      {state === 'listen' && (
        <>
          <Ring id={0} frame={circle(size * 1.22)} border={2} opacity={0.85} delay={0} reduce={reduce} />
          <Ring id={1} frame={circle(size * 1.48)} border={1.5} opacity={0.35} delay={250} reduce={reduce} />
        </>
      )}
      {state === 'speak' && [0, 1, 2].map((i) => <Wave key={i} index={i} frame={circle(size * 1.08)} reduce={reduce} />)}
      <View testID="inti-inti" style={[StyleSheet.absoluteFill, { opacity: state === 'off' ? 0.35 : 1 }]}>
        <Breath active={(state === 'idle' || state === 'speak') && !reduce}>
          <Image source={onDark ? RIBBON_LIGHT : RIBBON} style={{ width: w, height: h }} resizeMode="contain" />
          {DOT_X.map((x, i) => (
            <Dot
              key={i}
              index={i}
              left={x * w - dot / 2}
              top={DOT_Y * h - dot / 2}
              d={dot}
              color={onDark ? '#C9E6C7' : '#2A8A5C'}
              pulse={state === 'think' && !reduce}
            />
          ))}
        </Breath>
      </View>
    </View>
  );
}

/** Napas: skala 1,00 → 1,04 selama 4 detik, bolak-balik. */
function Breath({ active, children }: { active: boolean; children: ReactNode }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.set(
      active
        ? withRepeat(withTiming(1.04, { duration: 4000, easing: Easing.inOut(Easing.ease) }), -1, true)
        : withTiming(1, { duration: 200 }),
    );
  }, [active, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '50% 55%' }, style]}>{children}</Animated.View>;
}

/** Berpikir: tiap titik naik dan terang bergantian, jeda 180 ms, satu siklus 1,2 detik. */
function Dot({ index, left, top, d, color, pulse }: { index: number; left: number; top: number; d: number; color: string; pulse: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(
      pulse
        ? withDelay(
            index * 180,
            withRepeat(
              withSequence(withTiming(1, { duration: 420 }), withTiming(0, { duration: 420 }), withTiming(0, { duration: 360 })),
              -1,
            ),
          )
        : withTiming(0, { duration: 0 }),
    );
  }, [pulse, index, t]);
  const style = useAnimatedStyle(() =>
    pulse
      ? { opacity: 0.35 + 0.65 * t.get(), transform: [{ translateY: -0.3 * d * t.get() }] }
      : { opacity: 1, transform: [{ translateY: 0 }] },
  );
  return (
    <Animated.View
      testID={`inti-titik-${index}`}
      style={[{ position: 'absolute', left, top, width: d, height: d, borderRadius: d / 2, backgroundColor: color }, style]}
    />
  );
}

/** Mendengar: cincin berdenyut tak beraturan, satu siklus 1,4 detik. */
function Ring({ id, frame, border, opacity, delay, reduce }: { id: number; frame: Frame; border: number; opacity: number; delay: number; reduce: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    s.set(withDelay(delay, withRepeat(withSequence(...LISTEN_SCALE.map((v, i) => withTiming(v, { duration: LISTEN_MS[i] }))), -1)));
  }, [reduce, delay, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <Animated.View
      testID={`inti-cincin-${id}`}
      style={[frame, { borderWidth: border, borderColor: SAGE, opacity }, style]}
    />
  );
}

/** Berbicara: gelombang membesar 1 → 1,5 dan memudar, 2,4 detik, jeda 0,8 detik antar gelombang. */
function Wave({ index, frame, reduce }: { index: number; frame: Frame; reduce: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.set(withDelay(index * 800, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }), -1)));
  }, [reduce, index, t]);
  const first = index === 0;
  const style = useAnimatedStyle(() =>
    reduce
      ? { opacity: first ? 0.4 : 0, transform: [{ scale: 1.2 }] }
      : { opacity: 0.55 * (1 - t.get()), transform: [{ scale: 1 + 0.5 * t.get() }] },
  );
  return (
    <Animated.View
      testID={`inti-gelombang-${index}`}
      style={[frame, { borderWidth: 1.5, borderColor: SAGE }, style]}
    />
  );
}
