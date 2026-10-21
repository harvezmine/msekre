import {
  Blend,
  BlurMask,
  Canvas,
  Circle,
  Fill,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  usePathValue,
  type SkPathBuilder,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { gradients } from '@/theme/tokens';
import {
  approach,
  bandBottom,
  bandTop,
  goalAlpha,
  goalShimmer,
  goalSpeed,
  shimmerX,
  smoothLevel,
  STILL_PHASE,
  stillLevel,
  targetLevel,
  WAVE_LAYERS,
  WAVE_POINTS,
  waveY,
  type WaveLayer,
  type WaveState,
} from './waveMath';

export interface WavesProps {
  state: WaveState;
  /** Level mikrofon 0..1 (dari pengendali, sudah kurva desibel). Hanya dibaca saat mendengar. */
  level: SharedValue<number>;
  width: number;
  /** Tinggi kanvas; gelombang menempel di bawah layar. */
  height: number;
  /** Layar tak terlihat atau aplikasi di latar: gelombang diam di tempat (tanpa lompatan saat kembali). */
  paused?: boolean;
  /** Balasan dibisukan: saat siap, gelombang lebih redup dan lambat. */
  muted?: boolean;
  /** Kartu konfirmasi atau kolom ketik tampil: gelombang diredupkan separuh supaya tidak ramai di belakangnya. */
  quiet?: boolean;
  /** Keluaran: level yang sudah dihaluskan, untuk cahaya Inti (`1 + 0,45 × level`). */
  glow?: SharedValue<number>;
}

const RAMP = ['rgba(0,0,0,1)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'];
const RAMP_AT = [0, 0.25, 1];
const CREST = ['rgba(183,224,122,0)', 'rgba(214,245,190,1)', 'rgba(170,220,255,1)', 'rgba(183,224,122,0)'];
const CREST_AT = [0, 0.35, 0.7, 1];
const SHIMMER = ['rgba(220,245,210,0.45)', 'rgba(220,245,210,0)'];
const WASH = ['rgba(10,40,40,0)', 'rgba(20,70,80,0.30)'];
/** Denyut "kurangi gerakan": 2,4 detik bolak-balik. */
const PULSE_MS = 1200;

/**
 * Gelombang Mode Suara ala Gemini (§5.1): empat lapis gradasi lembut yang ditambahkan (`plus`) di atas kanvas gelap,
 * masing-masing diberi pita alfa vertikal (`dstIn`) dan blur. Semua gerak dihitung di utas UI: jam frame
 * (`useFrameCallback`) memajukan fase, level halus, kecepatan, terang, dan kilau; jalur dibangun ulang di worklet tiap
 * frame (`usePathValue`). Tidak ada kerja di utas JS per frame. "Kurangi gerakan": bingkai diam yang hanya berdenyut.
 */
export function WavesSkia({
  state,
  level,
  width,
  height,
  paused = false,
  muted = false,
  quiet = false,
  glow,
}: WavesProps) {
  const reduce = useReducedMotion();
  const still = reduce;
  const running = !still && !paused;

  const stateSv = useSharedValue<WaveState>(state);
  const mutedSv = useSharedValue(muted);
  const quietSv = useSharedValue(quiet);
  useEffect(() => {
    stateSv.set(state);
    mutedSv.set(muted);
    quietSv.set(quiet);
  }, [state, muted, quiet, stateSv, mutedSv, quietSv]);

  const clock = useSharedValue(0);
  const phase = useSharedValue(STILL_PHASE);
  const lv = useSharedValue(stillLevel(state));
  const speed = useSharedValue(goalSpeed(state, muted));
  const alpha = useSharedValue(goalAlpha(state, muted, quiet));
  const shimmer = useSharedValue(goalShimmer(state));

  const frame = useFrameCallback((info) => {
    'worklet';
    // Frame pertama setelah jeda: paling banyak 50 ms, supaya tidak melompat.
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const t = clock.get() + dt;
    clock.set(t);
    const st = stateSv.get();
    const m = mutedSv.get();
    const sp = approach(speed.get(), goalSpeed(st, m), dt);
    speed.set(sp);
    phase.set(phase.get() + sp * dt);
    alpha.set(approach(alpha.get(), goalAlpha(st, m, quietSv.get()), dt));
    shimmer.set(approach(shimmer.get(), goalShimmer(st), dt));
    const L = smoothLevel(lv.get(), targetLevel(st, t, level.get(), m), dt);
    lv.set(L);
    if (glow) glow.set(L);
  }, running);

  useEffect(() => {
    frame.setActive(running);
  }, [frame, running]);

  // Bingkai diam: keadaan berganti tetap terlihat (level dan terang khas keadaan), tanpa aliran.
  useEffect(() => {
    if (!still) return;
    phase.set(STILL_PHASE);
    lv.set(stillLevel(state));
    alpha.set(goalAlpha(state, muted, quiet));
    shimmer.set(0);
    if (glow) glow.set(0);
  }, [still, state, muted, quiet, phase, lv, alpha, shimmer, glow]);

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!still || paused) {
      cancelAnimation(pulse);
      pulse.set(1);
      return;
    }
    pulse.set(0.55);
    pulse.set(withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [still, paused, pulse]);
  // Terang akhir = terang keadaan × denyut; dihitung di Skia (kanvas buram di Android adalah SurfaceView, yang tidak
  // mengikuti opacity View induknya).
  const light = useDerivedValue(() => alpha.get() * pulse.get());

  const shimmerC = useDerivedValue(() => ({ x: shimmerX(clock.get()) * width, y: height * 0.58 }));

  return (
    <View
      testID="gelombang"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}
    >
      <View testID={still ? 'gelombang-diam' : 'gelombang-mengalir'} style={StyleSheet.absoluteFill}>
        {/* testID = keadaan yang dituju; kanvasnya tetap sama saat keadaan berganti (tanpa pasang ulang, tanpa lompatan). */}
        <Canvas testID={`gelombang-${state}`} style={{ width, height }} opaque>
          <Fill color={gradients.voiceBg} />
          <Rect x={0} y={height * 0.55} width={width} height={height * 0.45}>
            <LinearGradient start={{ x: 0, y: height * 0.55 }} end={{ x: 0, y: height }} colors={WASH} />
          </Rect>
          {WAVE_LAYERS.map((layer, i) => (
            <Layer key={i} layer={layer} width={width} height={height} phase={phase} level={lv} alpha={light} />
          ))}
          <Crest layer={WAVE_LAYERS[3]!} width={width} height={height} phase={phase} level={lv} alpha={light} />
          <Circle c={shimmerC} r={150} opacity={shimmer} blendMode="plus">
            <RadialGradient c={shimmerC} r={150} colors={SHIMMER} />
            <BlurMask blur={10} style="normal" />
          </Circle>
        </Canvas>
      </View>
    </View>
  );
}

interface LayerProps {
  layer: WaveLayer;
  width: number;
  height: number;
  phase: SharedValue<number>;
  level: SharedValue<number>;
  alpha: SharedValue<number>;
}

/** Satu lapis: bentuk tertutup sampai dasar kanvas, gradasi tiga warna × pita alfa, blur, ditambahkan. */
function Layer({ layer, width, height, phase, level, alpha }: LayerProps) {
  const path = usePathValue((b: SkPathBuilder) => {
    'worklet';
    const p = phase.get();
    const L = level.get();
    b.moveTo(0, height);
    for (let i = 0; i <= WAVE_POINTS; i++) {
      const u = i / WAVE_POINTS;
      b.lineTo(u * width, waveY(layer, u, p, L, height));
    }
    b.lineTo(width, height);
    b.close();
  });
  const rampStart = useDerivedValue(() => ({ x: 0, y: bandTop(layer, level.get(), height) }));
  const rampEnd = useDerivedValue(() => ({ x: 0, y: bandBottom(layer, level.get(), height) }));
  const opacity = useDerivedValue(() => layer.alpha * alpha.get());
  return (
    <Path path={path} opacity={opacity} blendMode="plus" dither>
      {/* Anak pertama = tujuan (warna), kedua = sumber (alfa): dstIn menyisakan warna sebesar alfa pita. */}
      <Blend mode="dstIn">
        <LinearGradient start={{ x: 0, y: 0 }} end={{ x: width, y: 0 }} colors={[...layer.colors]} />
        <LinearGradient start={rampStart} end={rampEnd} colors={RAMP} positions={RAMP_AT} />
      </Blend>
      <BlurMask blur={layer.blur} style="normal" />
    </Path>
  );
}

/** Garis puncak bercahaya tipis di lapis paling depan (3 dp, blur 3, alfa 0,32). */
function Crest({ layer, width, height, phase, level, alpha }: LayerProps) {
  const path = usePathValue((b: SkPathBuilder) => {
    'worklet';
    const p = phase.get();
    const L = level.get();
    for (let i = 0; i <= WAVE_POINTS; i++) {
      const u = i / WAVE_POINTS;
      const y = waveY(layer, u, p, L, height);
      if (i === 0) b.moveTo(0, y);
      else b.lineTo(u * width, y);
    }
  });
  const opacity = useDerivedValue(() => 0.32 * alpha.get());
  return (
    <Path path={path} style="stroke" strokeWidth={3} opacity={opacity} blendMode="plus">
      <LinearGradient start={{ x: 0, y: 0 }} end={{ x: width, y: 0 }} colors={CREST} positions={CREST_AT} />
      <BlurMask blur={3} style="normal" />
    </Path>
  );
}
