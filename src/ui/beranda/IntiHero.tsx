import { useCallback, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { FrameClock } from '@/ui/FrameClock';
import { IntiButton } from '@/ui/inti/IntiButton';
import { logoRadius, ServiceLogo } from '@/ui/kit/ServiceLogo';
import { webLabel, webLayout, type HeroMetrics, type WebLayout, type WebNode } from './heroLayout';
import {
  advanceClock,
  at,
  drift,
  easeInOut,
  PING_S,
  PULSE_LANES,
  pulseAge,
  pulseAlpha,
  pulseIndex,
  pulseTarget,
  WEB_LOOP,
} from './webMath';

/** Warna jaring per mode: garis hijau brand beralfa rendah, titik cahaya hijau terang. */
const INK = {
  light: {
    spoke: '#1D7550',
    from: 0.4,
    to: 0.12,
    link: 0.2,
    hint: 0.3,
    head: '#1F9D66',
    glow: '#2FBF7F',
    ping: '#2FBF7F',
  },
  dark: {
    spoke: '#5BBF86',
    from: 0.5,
    to: 0.12,
    link: 0.24,
    hint: 0.34,
    head: '#B4F5CF',
    glow: '#5FE3B5',
    ping: '#5FE3B5',
  },
} as const;
type Ink = (typeof INK)[keyof typeof INK];

/** Ekor titik cahaya (dp) dan tinggi kotaknya; kepala di tengah kotak. */
const TAIL = 16;
const COMET_H = 14;
/** Lebar cahaya Inti besar sebagai kelipatan ukurannya (Inti kecil: 2,1), supaya cahaya tidak menutupi simpul. */
const HERO_GLOW = 1.7;

interface Props {
  metrics: HeroMetrics;
  /** Simpul yang digambar (sudah dibatasi `metrics.maxNodes`); kosong = Inti saja. */
  nodes: readonly WebNode[];
  /** Layar tidak terlihat atau aplikasi di latar: semua gerak berhenti. */
  paused: boolean;
  /** Petunjuk pertama sedang menunjuk Inti. */
  halo: boolean;
}

/**
 * Inti besar Beranda dengan jaring tenang di sekelilingnya: ubin logo layanan dan perangkat pengguna di cincin lonjong
 * yang tidak rata, garis tipis dari tepi Inti ke tiap simpul (plus dua garis antar-tetangga), titik cahaya yang sesekali
 * berjalan dari Inti ke satu simpul lalu simpulnya berdenyut, dan simpul yang melayang beberapa dp. Inti sendiri sama
 * dengan di bilah tab: ketuk = chat, tahan = Mode Suara (`IntiButton`).
 *
 * Gerak di utas UI: satu jam frame (`FrameClock`, hanya terpasang saat berjalan: tidak saat `paused`, "kurangi
 * gerakan", atau tanpa simpul), simpul dan titik cahaya hanya `transform`/`opacity` dari worklet `webMath.ts`; garis SVG
 * diam (ujungnya berhenti 3 dp sebelum tepi ubin, jadi simpul yang melayang tetap tampak tersambung). "Kurangi gerakan":
 * jaring diam tanpa titik cahaya.
 */
export function IntiHero({ metrics: m, nodes, paused, halo }: Props) {
  const { scheme } = useTheme();
  const ink = INK[scheme === 'dark' ? 'dark' : 'light'];
  const reduce = useReducedMotion();
  const layout = webLayout(m, nodes);
  const hasNodes = layout.points.length > 0;
  const running = !reduce && !paused && hasNodes;

  const clock = useSharedValue(0);
  // Worklet stabil; jamnya dipasang hanya saat berjalan (`FrameClock`), jadi jeda = lepas, tanpa setActive.
  const tick = useCallback(
    (info: FrameInfo) => {
      'worklet';
      clock.set(advanceClock(clock.get(), info.timeSincePreviousFrame, WEB_LOOP));
    },
    [clock],
  );

  const showPulses = !reduce && layout.pulseOrder.length > 0;
  return (
    <View testID="inti-besar" style={{ width: m.width, height: m.height }}>
      {running ? <FrameClock onFrame={tick} /> : null}
      {hasNodes ? (
        <Animated.View
          testID="jaring"
          entering={reduce ? undefined : FadeIn.duration(480)}
          accessible
          accessibilityLabel={webLabel(nodes)}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        >
          <WebLines layout={layout} m={m} ink={ink} />
        </Animated.View>
      ) : null}
      <View style={{ position: 'absolute', left: layout.cx - m.inti / 2, top: layout.cy - m.inti / 2 }}>
        <IntiButton size={m.inti} halo={halo} paused={paused} glowScale={HERO_GLOW} testID="inti-besar-tombol" />
      </View>
      {hasNodes ? (
        <Animated.View
          entering={reduce ? undefined : FadeIn.duration(480)}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
        >
          {layout.points.map((p, i) => (
            <WebNodeTile
              key={p.node.key}
              index={i}
              node={p.node}
              x={p.x}
              y={p.y}
              size={m.node}
              amp={m.drift}
              clock={clock}
            />
          ))}
          {showPulses
            ? PULSE_LANES.map((_, lane) => (
                <Pulse key={lane} lane={lane} layout={layout} clock={clock} ink={ink} m={m} />
              ))
            : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Garis jaring (diam): jari-jari bergradasi dari Inti ke simpul, garis tetangga bertitik, dan yang redup putus-putus. */
function WebLines({ layout, m, ink }: { layout: WebLayout; m: HeroMetrics; ink: Ink }) {
  const { c } = useTheme();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg width={m.width} height={m.height}>
      <Defs>
        {layout.points.map((p, i) => (
          <LinearGradient
            key={p.node.key}
            id={`jr${uid}${i}`}
            gradientUnits="userSpaceOnUse"
            x1={p.spoke.x1}
            y1={p.spoke.y1}
            x2={p.spoke.x2}
            y2={p.spoke.y2}
          >
            <Stop offset="0" stopColor={ink.spoke} stopOpacity={ink.from} />
            <Stop offset="1" stopColor={ink.spoke} stopOpacity={ink.to} />
          </LinearGradient>
        ))}
      </Defs>
      {layout.links.map((l) => (
        <Line
          key={`${l.from}-${l.to}`}
          testID="jaring-tetangga"
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={ink.spoke}
          strokeOpacity={ink.link}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeDasharray="0.5 4.5"
        />
      ))}
      {layout.points.map((p, i) => {
        const { x1, y1, x2, y2 } = p.spoke;
        if (p.node.offline) {
          return (
            <Line
              key={p.node.key}
              testID={`jari-redup-${p.node.key}`}
              {...{ x1, y1, x2, y2 }}
              stroke={c.faint}
              strokeOpacity={0.8}
              strokeWidth={1.25}
              strokeDasharray="3 4"
            />
          );
        }
        if (p.node.placeholder) {
          return (
            <Line
              key={p.node.key}
              testID={`jari-contoh-${p.node.key}`}
              {...{ x1, y1, x2, y2 }}
              stroke={ink.spoke}
              strokeOpacity={ink.hint}
              strokeWidth={1.25}
              strokeDasharray="3 4"
            />
          );
        }
        return (
          <Line
            key={p.node.key}
            testID={`jari-${p.node.key}`}
            {...{ x1, y1, x2, y2 }}
            stroke={`url(#jr${uid}${i})`}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

/** Satu simpul: ubin logo yang melayang pelan. Tidak terjangkau: redup dan kelabu, diam. Contoh: pudar. */
function WebNodeTile({
  index,
  node,
  x,
  y,
  size,
  amp,
  clock,
}: {
  index: number;
  node: WebNode;
  x: number;
  y: number;
  size: number;
  amp: number;
  clock: SharedValue<number>;
}) {
  const moving = !node.offline;
  const style = useAnimatedStyle(() => {
    const t = moving ? clock.get() : 0;
    const a = moving ? amp : 0;
    return { transform: [{ translateX: drift(t, index, 0, a) }, { translateY: drift(t, index, 1, a) }] };
  });
  return (
    <Animated.View
      testID={node.offline ? `simpul-offline-${node.key}` : `simpul-${node.key}`}
      style={[
        { position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size },
        node.placeholder ? { opacity: 0.6 } : null,
        style,
      ]}
    >
      <ServiceLogo
        id={node.key}
        name={node.label}
        size={size}
        fallbackIcon={node.icon}
        shadow={!node.placeholder && !node.offline}
        status={node.offline ? 'soon' : undefined}
      />
    </Animated.View>
  );
}

/**
 * Satu jalur titik cahaya (`PULSE_LANES`): kepala bercahaya dengan ekor pendek yang berjalan sepanjang jari-jari, lalu
 * (jalur keluar) denyut cincin di simpul tujuan. Kotaknya hanya digeser dan diputar.
 */
function Pulse({
  lane,
  layout,
  clock,
  ink,
  m,
}: {
  lane: number;
  layout: WebLayout;
  clock: SharedValue<number>;
  ink: Ink;
  m: HeroMetrics;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const L = PULSE_LANES[lane]!;
  const order = layout.pulseOrder;
  const x1 = layout.points.map((p) => p.spoke.x1);
  const y1 = layout.points.map((p) => p.spoke.y1);
  const x2 = layout.points.map((p) => p.spoke.x2);
  const y2 = layout.points.map((p) => p.spoke.y2);
  const deg = layout.points.map((p) => (p.angle * 180) / Math.PI);
  const nx = layout.points.map((p) => p.x);
  const ny = layout.points.map((p) => p.y);
  const amp = m.drift;
  const ring = m.node + 10;

  const comet = useAnimatedStyle(() => {
    const t = clock.get();
    const k = pulseIndex(t, L.every, L.offset);
    const target = pulseTarget(order, k, !L.outward);
    const age = pulseAge(t, L.every, L.offset);
    const u = target >= 0 && age >= 0 ? age / L.travel : -1;
    const e = easeInOut(u);
    const p = L.outward ? e : 1 - e;
    const ax = at(x1, target, 0);
    const ay = at(y1, target, 0);
    const x = ax + (at(x2, target, ax) - ax) * p;
    const y = ay + (at(y2, target, ay) - ay) * p;
    const turn = at(deg, target, 0) + (L.outward ? 0 : 180);
    return {
      opacity: pulseAlpha(u) * (L.outward ? 1 : 0.7),
      transform: [{ translateX: x - TAIL }, { translateY: y - COMET_H / 2 }, { rotate: `${turn}deg` }],
    };
  });

  const ping = useAnimatedStyle(() => {
    const t = clock.get();
    const k = pulseIndex(t, L.every, L.offset);
    const target = L.outward ? pulseTarget(order, k, false) : -1;
    const since = pulseAge(t, L.every, L.offset) - L.travel + 0.12;
    const q = target >= 0 && since >= 0 && since <= PING_S ? since / PING_S : -1;
    const x = at(nx, target, 0) + drift(t, target, 0, amp);
    const y = at(ny, target, 0) + drift(t, target, 1, amp);
    return {
      opacity: q < 0 ? 0 : 0.55 * (1 - q) * (1 - q),
      transform: [{ translateX: x - ring / 2 }, { translateY: y - ring / 2 }, { scale: q < 0 ? 1 : 1 + 0.42 * q }],
    };
  });

  return (
    <>
      {L.outward ? (
        <Animated.View
          testID={`jaring-denyut-${lane}`}
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              width: ring,
              height: ring,
              borderRadius: logoRadius(ring),
              borderWidth: 1.5,
              borderColor: ink.ping,
            },
            ping,
          ]}
        />
      ) : null}
      <Animated.View
        testID={`jaring-cahaya-${lane}`}
        style={[{ position: 'absolute', left: 0, top: 0, width: TAIL * 2, height: COMET_H }, comet]}
      >
        <Svg width={TAIL * 2} height={COMET_H}>
          <Defs>
            <LinearGradient id={`jt${uid}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={ink.glow} stopOpacity={0} />
              <Stop offset="1" stopColor={ink.glow} stopOpacity={0.9} />
            </LinearGradient>
            <RadialGradient id={`jg${uid}`} cx={TAIL} cy={COMET_H / 2} r={COMET_H / 2} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={ink.glow} stopOpacity={0.55} />
              <Stop offset="1" stopColor={ink.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={2} y={COMET_H / 2 - 1} width={TAIL - 2} height={2} rx={1} fill={`url(#jt${uid})`} />
          <Circle cx={TAIL} cy={COMET_H / 2} r={COMET_H / 2} fill={`url(#jg${uid})`} />
          <Circle cx={TAIL} cy={COMET_H / 2} r={2.4} fill={ink.head} />
        </Svg>
      </Animated.View>
    </>
  );
}
