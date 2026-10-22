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
import { scheduleOnRN } from 'react-native-worklets';
import { gradients } from '@/theme/tokens';
import {
  approach,
  bandBottom,
  bandTop,
  clampTo,
  finiteOr,
  frameSeconds,
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

export interface WavesSkiaProps extends WavesProps {
  /**
   * Jam frame di utas UI berkendala (ditangkap di sana, jadi aplikasi tidak tertutup): gelombang berhenti dan pemanggil
   * menggantinya dengan pita diam (src/voice/Waves.tsx). `why` = pesan kendalanya, untuk log.
   */
  onFail?: (why: string) => void;
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
  onFail,
}: WavesSkiaProps) {
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

  // Utas UI: kesalahan di sini tidak ditangkap siapa pun di build rilis dan menutup paksa aplikasi. Jadi semua nilai
  // dijaga (NaN, tak hingga, di luar 0..1), dan kesalahan apa pun menghentikan jam ini lalu dilaporkan sekali.
  const broken = useSharedValue(false);
  const frame = useFrameCallback((info) => {
    'worklet';
    if (broken.get()) return;
    try {
      // Frame pertama setelah jeda: paling banyak 50 ms, supaya tidak melompat.
      const dt = frameSeconds(info.timeSincePreviousFrame);
      const t = finiteOr(clock.get(), 0) + dt;
      clock.set(t);
      const st = stateSv.get();
      const m = mutedSv.get();
      const sp = clampTo(finiteOr(approach(finiteOr(speed.get(), 0), goalSpeed(st, m), dt), 0), 0, 2);
      speed.set(sp);
      phase.set(finiteOr(phase.get(), STILL_PHASE) + sp * dt);
      alpha.set(clampTo(approach(finiteOr(alpha.get(), 0), goalAlpha(st, m, quietSv.get()), dt), 0, 1));
      shimmer.set(clampTo(approach(finiteOr(shimmer.get(), 0), goalShimmer(st), dt), 0, 1));
      const mic = clampTo(finiteOr(level.get(), 0), 0, 1);
      const L = clampTo(smoothLevel(clampTo(lv.get(), 0, 1), targetLevel(st, t, mic, m), dt), 0, 1);
      lv.set(L);
      if (glow) glow.set(L);
    } catch (e) {
      broken.set(true);
      if (glow) glow.set(0);
      if (onFail) {
        try {
          scheduleOnRN(onFail, String(e));
        } catch {
          // Tidak bisa melapor: gelombang tetap berhenti dengan aman.
        }
      }
    }
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
  const light = useDerivedValue(() => clampTo(finiteOr(alpha.get() * pulse.get(), 0), 0, 1));

  const shimmerC = useDerivedValue(() => ({
    x: finiteOr(shimmerX(finiteOr(clock.get(), 0)) * width, 0),
    y: height * 0.58,
  }));

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
    // Dijaga seperti jam frame: titik bukan angka diganti garis dasar, kesalahan = lapis ini kosong satu frame.
    try {
      const p = finiteOr(phase.get(), STILL_PHASE);
      const L = clampTo(finiteOr(level.get(), 0), 0, 1);
      const rest = height * layer.base;
      b.moveTo(0, height);
      for (let i = 0; i <= WAVE_POINTS; i++) {
        const u = i / WAVE_POINTS;
        b.lineTo(u * width, finiteOr(waveY(layer, u, p, L, height), rest));
      }
      b.lineTo(width, height);
      b.close();
    } catch {
      // Lapis kosong satu frame.
    }
  });
  const rampStart = useDerivedValue(() => ({
    x: 0,
    y: finiteOr(bandTop(layer, clampTo(finiteOr(level.get(), 0), 0, 1), height), 0),
  }));
  const rampEnd = useDerivedValue(() => ({
    x: 0,
    y: finiteOr(bandBottom(layer, clampTo(finiteOr(level.get(), 0), 0, 1), height), height),
  }));
  const opacity = useDerivedValue(() => clampTo(layer.alpha * finiteOr(alpha.get(), 0), 0, 1));
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
    try {
      const p = finiteOr(phase.get(), STILL_PHASE);
      const L = clampTo(finiteOr(level.get(), 0), 0, 1);
      const rest = height * layer.base;
      for (let i = 0; i <= WAVE_POINTS; i++) {
        const u = i / WAVE_POINTS;
        const y = finiteOr(waveY(layer, u, p, L, height), rest);
        if (i === 0) b.moveTo(0, y);
        else b.lineTo(u * width, y);
      }
    } catch {
      // Garis puncak kosong satu frame.
    }
  });
  const opacity = useDerivedValue(() => clampTo(0.32 * finiteOr(alpha.get(), 0), 0, 1));
  return (
    <Path path={path} style="stroke" strokeWidth={3} opacity={opacity} blendMode="plus">
      <LinearGradient start={{ x: 0, y: 0 }} end={{ x: width, y: 0 }} colors={CREST} positions={CREST_AT} />
      <BlurMask blur={3} style="normal" />
    </Path>
  );
}
