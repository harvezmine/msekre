import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import { DEFAULT_ASSISTANT } from '@/brand';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import { Inti, type IntiState } from '@/ui/inti/Inti';
import { intiSize } from '@/ui/inti/size';
import { orbitLayout } from './geometry';
import type { OrbitNode } from './types';

const NODE = 44;

interface Props {
  nodes: OrbitNode[];
  intiState?: IntiState;
  onPressInti?: () => void;
  onLongPressInti?: () => void;
  onPressRing?: () => void;
  /** Jeda antar aliran titik. 0 mematikan aliran (dipakai tes). */
  flowEveryMs?: number;
}

export function Orbit({ nodes, intiState = 'idle', onPressInti, onLongPressInti, onPressRing, flowEveryMs = 3000 }: Props) {
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
    if (!flowEveryMs) return;
    const live = nodes.flatMap((n, i) => (n.offline ? [] : [i]));
    if (!live.length) return;
    const id = setInterval(() => {
      setFlow((f) => ({ node: live[Math.floor(Math.random() * live.length)]!, tick: (f?.tick ?? 0) + 1 }));
    }, flowEveryMs);
    return () => clearInterval(id);
  }, [nodes, flowEveryMs]);

  const flowLine = flow ? layout.nodes[flow.node]?.line : undefined;
  const iw = intiSize(intiPx).w;

  return (
    <Pressable onPress={onPressRing} disabled={!onPressRing} accessible={false} testID="cincin" style={{ width: W, height: H }}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Circle cx={layout.cx} cy={layout.cy} r={r} fill="none" stroke={c.sage} strokeOpacity={0.55} strokeWidth={1} />
        {layout.nodes.map((p, i) => (
          <Line
            key={nodes[i]!.key}
            x1={p.line.x1}
            y1={p.line.y1}
            x2={p.line.x2}
            y2={p.line.y2}
            stroke={c.sage}
            strokeOpacity={nodes[i]!.offline ? 0.3 : 0.6}
            strokeWidth={1}
            strokeDasharray={nodes[i]!.offline ? '3 4' : undefined}
          />
        ))}
      </Svg>
      {layout.nodes.map((p, i) => (
        <Node key={nodes[i]!.key} node={nodes[i]!} x={p.x} y={p.y} />
      ))}
      {flow && flowLine && <FlowDot key={flow.tick} from={{ x: flowLine.x2, y: flowLine.y2 }} to={{ x: flowLine.x1, y: flowLine.y1 }} />}
      <Pressable
        onPress={onPressInti}
        onLongPress={onLongPressInti}
        delayLongPress={450}
        accessibilityRole="button"
        accessibilityLabel={`Bicara dengan ${DEFAULT_ASSISTANT}`}
        accessibilityHint="Ketuk untuk chat, tahan untuk bicara"
        accessibilityActions={[{ name: 'longpress', label: 'Mode Suara' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') onLongPressInti?.();
        }}
        style={{ position: 'absolute', left: layout.cx - iw / 2, top: layout.cy - intiPx / 2 }}
      >
        <Inti size={intiPx} state={intiState} onDark={scheme === 'dark'} />
      </Pressable>
    </Pressable>
  );
}

function Node({ node, x, y }: { node: OrbitNode; x: number; y: number }) {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={node.offline ? `${node.label}, tidak terjangkau` : node.label}
      testID={node.offline ? `simpul-offline-${node.key}` : `simpul-${node.key}`}
      style={{
        position: 'absolute',
        left: x - NODE / 2,
        top: y - NODE / 2,
        width: NODE,
        height: NODE,
        borderRadius: NODE / 2,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: node.offline ? c.paper : c.card,
        opacity: node.offline ? 0.7 : 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={node.icon} size={22} color={node.offline ? c.muted : c.ink} />
      {node.offline && (
        <View
          style={{
            position: 'absolute',
            top: -1,
            right: -1,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: c.clay,
            borderWidth: 2,
            borderColor: c.paper,
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
          backgroundColor: c.leaf,
          borderWidth: 2,
          borderColor: c.paper,
        },
        style,
      ]}
    />
  );
}
