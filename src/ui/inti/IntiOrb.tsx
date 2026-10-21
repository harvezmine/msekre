import { useEffect, useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { gradients, motion } from '@/theme/tokens';

const SWEEP = require('../../../assets/brand/inti-sapuan.png');
const S_MARK = require('../../../assets/brand/s-mono-light.png');

/** Kurva napas papan desain: cubic-bezier(.45, 0, .55, 1). */
const BREATH = Easing.bezier(0.45, 0, 0.55, 1);

/**
 * Cahaya di sekitar Inti (§1.4): tiga lingkaran radial teal, biru, limau dalam kotak 2,1 × ukuran, masing-masing memudar
 * sampai sisi terdekatnya (`closest-side`), sama dengan papan desain.
 */
const GLOW = [
  { x: 0.4, y: 0.44, r: 0.4, color: '#19B3A6', opacity: 0.55 },
  { x: 0.62, y: 0.58, r: 0.38, color: '#3B6FE0', opacity: 0.4 },
  { x: 0.5, y: 0.32, r: 0.32, color: gradients.inti.highlight, opacity: 0.45 },
] as const;

/** Sorot di atas sapuan: putih kiri atas, limau di atas, bayangan biru tua di bawah (jari-jari pecahan ukuran). */
const SHINE = [
  { x: 0.32, y: 0.2, r: 0.441, color: '#FFFFFF', opacity: 0.42 },
  { x: 0.62, y: 0.12, r: 0.366, color: gradients.inti.highlight, opacity: 0.55 },
  { x: 0.7, y: 0.96, r: 0.689, color: '#061224', opacity: 0.42 },
] as const;

interface Props {
  /** Garis tengah bola, dp (92 Beranda, 76 layar pendek, 48 di bilah tab). */
  size: number;
  /** Cincin halo yang mengembang pelan: Inti sedang ditunjuk petunjuk pertama. */
  halo?: boolean;
  /** Layar tak terlihat atau aplikasi di latar: napas dan putaran berhenti. */
  paused?: boolean;
}

/**
 * Inti v2: bola tenang bergradasi brand dengan tanda S putih. Cahayanya bernapas (4,2 detik), sapuan warnanya berputar
 * sangat pelan (16 detik). "Kurangi gerakan" atau `paused`: diam, tampilan tetap sama. Hiasan saja: sentuhan dan
 * aksesibilitas diurus pembungkusnya (`IntiButton`).
 */
export function IntiOrb({ size, halo = false, paused = false }: Props) {
  const reduce = useReducedMotion();
  const still = reduce || paused;
  const glow = size * 2.1;
  return (
    <View
      testID="inti-bola"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Glow size={glow} offset={(glow - size) / 2} still={still} />
      {halo ? <Halo size={size} still={still} /> : null}
      <View
        style={{
          ...StyleSheet.absoluteFill,
          borderRadius: size / 2,
          boxShadow: '0 14px 30px -10px rgba(20,90,70,0.7)',
        }}
      >
        <View style={{ flex: 1, borderRadius: size / 2, overflow: 'hidden' }}>
          <Sweep size={size} still={still} />
          <Shine size={size} />
          <View
            style={{
              ...StyleSheet.absoluteFill,
              borderRadius: size / 2,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
            }}
          />
        </View>
      </View>
      <Image
        source={S_MARK}
        resizeMode="contain"
        style={{
          position: 'absolute',
          left: size * 0.28,
          top: size * 0.25,
          width: size * 0.44,
          height: size * 0.5,
          tintColor: '#FFFFFF',
        }}
      />
    </View>
  );
}

function Glow({ size, offset, still }: { size: number; offset: number; still: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const t = useSharedValue(0.5);
  useEffect(() => {
    if (still) {
      cancelAnimation(t);
      t.set(0.5);
      return;
    }
    t.set(0);
    t.set(withRepeat(withTiming(1, { duration: motion.inti.breath / 2, easing: BREATH }), -1, true));
    return () => cancelAnimation(t);
  }, [still, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.62 + 0.38 * t.get(),
    transform: [{ scale: 0.9 + 0.16 * t.get() }],
  }));
  return (
    <Animated.View
      testID="inti-cahaya"
      style={[{ position: 'absolute', left: -offset, top: -offset, width: size, height: size }, style]}
    >
      <Svg width={size} height={size}>
        <Defs>
          {GLOW.map((g, i) => (
            <RadialGradient
              key={i}
              id={`ig${uid}${i}`}
              cx={g.x * size}
              cy={g.y * size}
              r={g.r * size}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={g.color} stopOpacity={g.opacity} />
              <Stop offset="1" stopColor={g.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {GLOW.map((g, i) => (
          <Circle key={i} cx={g.x * size} cy={g.y * size} r={g.r * size} fill={`url(#ig${uid}${i})`} />
        ))}
      </Svg>
    </Animated.View>
  );
}

/** Sapuan warna yang berputar pelan; gambar 1,1 × ukuran supaya tepi bola selalu tertutup saat berputar. */
function Sweep({ size, still }: { size: number; still: boolean }) {
  const turn = useSharedValue(0);
  useEffect(() => {
    if (still) {
      cancelAnimation(turn);
      return;
    }
    turn.set(0);
    turn.set(withRepeat(withTiming(360, { duration: motion.inti.swirl, easing: Easing.linear }), -1));
    return () => cancelAnimation(turn);
  }, [still, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));
  const d = size * 1.1;
  return (
    <Animated.Image
      source={SWEEP}
      style={[{ position: 'absolute', left: (size - d) / 2, top: (size - d) / 2, width: d, height: d }, style]}
    />
  );
}

function Shine({ size }: { size: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Defs>
        {SHINE.map((g, i) => (
          <RadialGradient
            key={i}
            id={`is${uid}${i}`}
            cx={g.x * size}
            cy={g.y * size}
            r={g.r * size}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={g.color} stopOpacity={g.opacity} />
            <Stop offset="1" stopColor={g.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {SHINE.map((g, i) => (
        <Circle key={i} cx={g.x * size} cy={g.y * size} r={g.r * size} fill={`url(#is${uid}${i})`} />
      ))}
    </Svg>
  );
}

/** Cincin halo petunjuk (§5): 0,92 → 1,25 sambil memudar, 2,4 detik berulang. Diam: cincin tipis tetap. */
function Halo({ size, still }: { size: number; still: boolean }) {
  const { c } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    if (still) {
      cancelAnimation(t);
      t.set(0);
      return;
    }
    t.set(withRepeat(withTiming(1, { duration: motion.coach.halo, easing: Easing.out(Easing.ease) }), -1));
    return () => cancelAnimation(t);
  }, [still, t]);
  const style = useAnimatedStyle(() =>
    still
      ? { opacity: 0.5, transform: [{ scale: 1 }] }
      : { opacity: 0.6 * (1 - t.get()), transform: [{ scale: 0.92 + 0.33 * t.get() }] },
  );
  const d = size + 24;
  return (
    <Animated.View
      testID="inti-halo"
      style={[
        {
          position: 'absolute',
          left: -12,
          top: -12,
          width: d,
          height: d,
          borderRadius: d / 2,
          borderWidth: 2,
          borderColor: c.brand,
        },
        style,
      ]}
    />
  );
}
