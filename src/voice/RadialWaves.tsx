import { useCallback, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type FrameInfo, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { advanceClock } from '@/ui/beranda/webMath';
import { FrameClock } from '@/ui/FrameClock';
import {
  advancePhase,
  goalPace,
  goalPresence,
  goalSpread,
  RADIAL_LOOP,
  radialTarget,
  RING_COUNT,
  ringAlpha,
  ringPhase,
  ringScale,
  stillRingAlpha,
} from './radialMath';
import { approach, frameSeconds, smoothLevel } from './waveMath';

/** Warna gelombang per mode tema: gradasi brand (hijau, teal, biru), lebih terang di mode gelap. */
const INK = {
  light: ['#1D7550', '#19B3A6', '#3B6FE0'],
  dark: ['#2FBF7F', '#19D3C0', '#4F86FF'],
} as const;

/** Nilai bersama yang menggerakkan gelombang; ditulis Mode Suara di tempat (`InPlaceVoice`). */
export interface RadialDrive {
  /** Mode `radialMath` (0 tersembunyi, 1 mendengar, 2 berpikir, 3 menjawab, 4 tenang). */
  mode: SharedValue<number>;
  /** Level mikrofon mentah 0..1. */
  level: SharedValue<number>;
  /** 0..1: jari digeser menjauh untuk membatalkan. */
  cancel: SharedValue<number>;
  /** Level yang sudah dihaluskan (ditulis di sini), untuk cahaya Inti. */
  smooth: SharedValue<number>;
}

/**
 * Gelombang suara di sekitar Inti besar Beranda (Mode Suara di tempat), seperti sinyal radio: empat cincin tipis bergradasi
 * brand yang berangkat dari tepi Inti, melambat ke luar, dan memudar (jangkauan dan terang mengikuti level mikrofon yang
 * dihaluskan). Berpikir: cincin merapat dan melambat; menjawab: mengikuti selubung bicara tiruan; digeser batal: meredup.
 *
 * Hanya `transform`/`opacity` yang berubah (SVG di dalamnya diam). Satu jam frame di utas UI, hanya terpasang selama
 * berjalan (`FrameClock`); "kurangi gerakan" atau `paused`: satu cincin diam yang terangnya mengikuti mode.
 */
export function RadialWaves({ size, drive, still }: { size: number; drive: RadialDrive; still: boolean }) {
  const { scheme } = useTheme();
  const ink = INK[scheme === 'dark' ? 'dark' : 'light'];
  const { mode, level, cancel, smooth } = drive;
  const clock = useSharedValue(0);
  const phase = useSharedValue(0);
  const pace = useSharedValue(1);
  const presence = useSharedValue(0);
  const spread = useSharedValue(1);
  const cancelMix = useSharedValue(0);

  const tick = useCallback(
    (info: FrameInfo) => {
      'worklet';
      const dt = frameSeconds(info.timeSincePreviousFrame);
      const m = mode.get();
      clock.set(advanceClock(clock.get(), info.timeSincePreviousFrame, RADIAL_LOOP));
      pace.set(approach(pace.get(), goalPace(m), dt, 400));
      phase.set(advancePhase(phase.get(), dt, pace.get()));
      presence.set(approach(presence.get(), goalPresence(m), dt, 360));
      spread.set(approach(spread.get(), goalSpread(m), dt, 420));
      smooth.set(smoothLevel(smooth.get(), radialTarget(m, clock.get(), level.get()), dt));
      cancelMix.set(approach(cancelMix.get(), cancel.get(), dt, 160));
    },
    [mode, level, cancel, smooth, clock, phase, pace, presence, spread, cancelMix],
  );

  // Kotak gambar 2 × Inti, berpusat di Inti (pembungkusnya di titik pusat Inti, jadi kotaknya digeser setengah kotak,
  // bukan setengah Inti); cincin ber-skala 1 = garis tengah Inti.
  const box = size * 2;
  const r = size / 2;
  const stroke = Math.max(1.2, size / 96);
  return (
    <View
      testID="suara-cincin"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: -box / 2, top: -box / 2, width: box, height: box }}
    >
      {still ? null : <FrameClock onFrame={tick} />}
      {still ? (
        <StillRing box={box} r={r} stroke={stroke} mode={mode} color={ink[1]} />
      ) : (
        <>
          {Array.from({ length: RING_COUNT }, (_, i) => (
            <Ring
              key={i}
              index={i}
              box={box}
              r={r}
              stroke={stroke}
              colors={ink}
              phase={phase}
              spread={spread}
              presence={presence}
              smooth={smooth}
              cancel={cancelMix}
            />
          ))}
        </>
      )}
    </View>
  );
}

function Ring({
  index,
  box,
  r,
  stroke,
  colors,
  phase,
  spread,
  presence,
  smooth,
  cancel,
}: {
  index: number;
  box: number;
  r: number;
  stroke: number;
  colors: readonly [string, string, string];
  phase: SharedValue<number>;
  spread: SharedValue<number>;
  presence: SharedValue<number>;
  smooth: SharedValue<number>;
  cancel: SharedValue<number>;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const style = useAnimatedStyle(() => {
    const u = ringPhase(phase.get(), index, RING_COUNT);
    return {
      opacity: ringAlpha(u, smooth.get(), presence.get(), cancel.get()),
      transform: [{ scale: ringScale(u, spread.get(), smooth.get()) }],
    };
  });
  return (
    <Animated.View testID={`suara-cincin-${index}`} style={[StyleSheet.absoluteFill, style]}>
      <Svg width={box} height={box}>
        <Defs>
          <LinearGradient id={`rg${uid}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[index % 3]} />
            <Stop offset="0.55" stopColor={colors[(index + 1) % 3]} />
            <Stop offset="1" stopColor={colors[(index + 2) % 3]} />
          </LinearGradient>
        </Defs>
        <Circle cx={box / 2} cy={box / 2} r={r} stroke={`url(#rg${uid})`} strokeWidth={stroke} fill="none" />
      </Svg>
    </Animated.View>
  );
}

function StillRing({
  box,
  r,
  stroke,
  mode,
  color,
}: {
  box: number;
  r: number;
  stroke: number;
  mode: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => ({ opacity: stillRingAlpha(mode.get()) }));
  return (
    <Animated.View testID="suara-cincin-diam" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={box} height={box}>
        <Circle cx={box / 2} cy={box / 2} r={r * 1.18} stroke={color} strokeWidth={stroke * 1.4} fill="none" />
      </Svg>
    </Animated.View>
  );
}
