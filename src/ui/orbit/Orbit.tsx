import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import { useAssistantName } from '@/api/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import { Inti, type IntiState } from '@/ui/inti/Inti';
import { intiSize } from '@/ui/inti/size';
import { orbitLayout } from './geometry';
import type { OrbitNode } from './types';

const NODE = 44;
/** Simpul baru masuk dari jarak ini ke arah luar, 900 ms (sk-join di desain). */
const JOIN_FROM = 70;
const JOIN_MS = 900;
const AnimatedLine = Animated.createAnimatedComponent(Line);

interface Props {
  nodes: OrbitNode[];
  intiState?: IntiState;
  onPressInti?: () => void;
  onLongPressInti?: () => void;
  onPressRing?: () => void;
  /** Jeda antar aliran titik. 0 mematikan aliran (dipakai tes). */
  flowEveryMs?: number;
  /** Layar tak terlihat atau aplikasi di latar: tanpa aliran titik dan Inti diam. */
  paused?: boolean;
  /** Kunci simpul yang baru bergabung: masuk ke tempatnya dengan gerak, garisnya memudar muncul, dan warnanya mint. */
  joinKey?: string;
}

export function Orbit({
  nodes,
  intiState = 'idle',
  onPressInti,
  onLongPressInti,
  onPressRing,
  flowEveryMs = 3000,
  paused = false,
  joinKey,
}: Props) {
  const assistantName = useAssistantName();
  const { c, scheme } = useTheme();
  const { width } = useWindowDimensions();
  // Desain 360 lebar di layar 412. Di layar 360, semuanya diperkecil kecuali simpul (tetap 44, mudah disentuh).
  const k = Math.min(1, (width - 40) / 360);
  const W = 360 * k;
  const H = 304 * k;
  const r = 126 * k;
  const intiPx = Math.round(140 * k);
  const layout = orbitLayout(nodes.length, { W, H, r, ri: 80 * k, node: NODE });
  const [flow, setFlow] = useState<{ node: number; tick: number } | null>(null);

  useEffect(() => {
    if (!flowEveryMs || paused) return;
    const live = nodes.flatMap((n, i) => (n.offline ? [] : [i]));
    if (!live.length) return;
    const id = setInterval(() => {
      setFlow((f) => ({ node: live[Math.floor(Math.random() * live.length)]!, tick: (f?.tick ?? 0) + 1 }));
    }, flowEveryMs);
    return () => clearInterval(id);
  }, [nodes, flowEveryMs, paused]);

  const flowLine = flow ? layout.nodes[flow.node]?.line : undefined;
  const iw = intiSize(intiPx).w;

  return (
    <Pressable
      onPress={onPressRing}
      disabled={!onPressRing}
      accessible={false}
      focusable={false}
      importantForAccessibility="no"
      testID="cincin"
      style={{ width: W, height: H }}
    >
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Circle cx={layout.cx} cy={layout.cy} r={r} fill="none" stroke={c.faint} strokeOpacity={0.55} strokeWidth={1} />
        {layout.nodes.map((p, i) => {
          const n = nodes[i]!;
          const line = {
            x1: p.line.x1,
            y1: p.line.y1,
            x2: p.line.x2,
            y2: p.line.y2,
            stroke: c.faint,
            strokeWidth: 1,
            strokeDasharray: n.offline ? '3 4' : undefined,
          };
          const opacity = n.offline ? 0.3 : 0.6;
          return n.key === joinKey ? (
            <JoinLine key={n.key} {...line} opacity={opacity} />
          ) : (
            <Line key={n.key} {...line} strokeOpacity={opacity} />
          );
        })}
      </Svg>
      {layout.nodes.map((p, i) => {
        const n = nodes[i]!;
        return n.key === joinKey ? (
          <JoiningNode
            key={n.key}
            node={n}
            x={p.x}
            y={p.y}
            dx={Math.cos(p.angle) * JOIN_FROM}
            dy={Math.sin(p.angle) * JOIN_FROM}
          />
        ) : (
          <Node key={n.key} node={n} x={p.x} y={p.y} />
        );
      })}
      {flow && flowLine && !paused && (
        <FlowDot key={flow.tick} from={{ x: flowLine.x2, y: flowLine.y2 }} to={{ x: flowLine.x1, y: flowLine.y1 }} />
      )}
      <Pressable
        onPress={onPressInti}
        onLongPress={onLongPressInti}
        delayLongPress={450}
        accessibilityRole="button"
        accessibilityLabel={`Bicara dengan ${assistantName}`}
        accessibilityHint="Ketuk untuk chat, tahan untuk bicara"
        accessibilityActions={[{ name: 'longpress', label: 'Mode Suara' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') onLongPressInti?.();
        }}
        style={{ position: 'absolute', left: layout.cx - iw / 2, top: layout.cy - intiPx / 2 }}
      >
        <Inti size={intiPx} state={intiState} onDark={scheme === 'dark'} paused={paused} />
      </Pressable>
    </Pressable>
  );
}

function nodeBox(x: number, y: number) {
  return { position: 'absolute', left: x - NODE / 2, top: y - NODE / 2, width: NODE, height: NODE } as const;
}

function Node({ node, x, y }: { node: OrbitNode; x: number; y: number }) {
  return (
    <View
      accessible
      accessibilityLabel={node.offline ? `${node.label}, tidak terjangkau` : node.label}
      testID={node.offline ? `simpul-offline-${node.key}` : `simpul-${node.key}`}
      style={nodeBox(x, y)}
    >
      <NodeFace node={node} />
    </View>
  );
}

/** Simpul yang baru bergabung: mint dengan tepi sage, meluncur 70 dp dari luar sambil membesar dan menampak. Gerak dikurangi: langsung di tempatnya. */
function JoiningNode({ node, x, y, dx, dy }: { node: OrbitNode; x: number; y: number; dx: number; dy: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) t.set(withTiming(1, { duration: JOIN_MS, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, [reduce, t]);
  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: Math.min(1, p / 0.6),
      transform: [{ translateX: dx * (1 - p) }, { translateY: dy * (1 - p) }, { scale: 0.4 + 0.6 * p }],
    };
  });
  return (
    <Animated.View
      accessible
      accessibilityLabel={node.label}
      testID={`simpul-${node.key}`}
      style={[nodeBox(x, y), style]}
    >
      <NodeFace node={node} joined />
    </Animated.View>
  );
}

function JoinLine(props: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity: number;
}) {
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) t.set(withTiming(1, { duration: JOIN_MS, easing: Easing.out(Easing.ease) }));
  }, [reduce, t]);
  const { opacity, ...line } = props;
  const animatedProps = useAnimatedProps(() => ({ strokeOpacity: opacity * t.get() }));
  return <AnimatedLine {...line} animatedProps={animatedProps} />;
}

function NodeFace({ node, joined = false }: { node: OrbitNode; joined?: boolean }) {
  const { c, marker, shadow } = useTheme();
  return (
    <View
      style={{
        width: NODE,
        height: NODE,
        borderRadius: NODE / 2,
        backgroundColor: node.offline ? c.bg : joined ? c.brandSoft : c.surface,
        boxShadow: node.offline ? `inset 0 0 0 1.5px ${c.line}` : joined ? `inset 0 0 0 1.5px ${c.brand}` : shadow.e1,
        opacity: node.offline ? 0.7 : 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={node.icon} size={22} color={node.offline ? c.muted : joined ? c.brandInk : c.text} />
      {node.offline && (
        <View
          style={{
            position: 'absolute',
            top: -1,
            right: -1,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: marker.warn.base,
            borderWidth: 2,
            borderColor: c.bg,
          }}
        />
      )}
    </View>
  );
}

/** Satu titik cahaya dari simpul ke Inti, 600 ms. Kalau gerak dikurangi: berkedip sekali di simpul. */
function FlowDot({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) }));
  }, [t]);
  const style = useAnimatedStyle(() => {
    const p = t.get();
    const k = reduce ? 0 : p;
    const fade = p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1;
    return {
      opacity: reduce ? Math.sin(Math.PI * p) : fade,
      transform: [{ translateX: from.x + (to.x - from.x) * k - 4 }, { translateY: from.y + (to.y - from.y) * k - 4 }],
    };
  });
  return (
    <Animated.View
      testID="aliran-titik"
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: c.brand,
          borderWidth: 2,
          borderColor: c.bg,
        },
        style,
      ]}
    />
  );
}
