import { useId, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import type { Category } from '@/theme/tokens';
import { Txt } from '../Txt';
import { areaPath, scalePoints, smoothPath } from './chartMath';

function useGradId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** Titik akhir: titik warna dengan cincin warna latar. */
function EndDot({ x, y, color, ring, r = 5 }: { x: number; y: number; color: string; ring: string; r?: number }) {
  return (
    <>
      <Circle cx={x} cy={y} r={r + 2.5} fill={ring} />
      <Circle cx={x} cy={y} r={r} fill={color} />
    </>
  );
}

/**
 * Grafik garis kecil: kurva halus warna penanda (ungu Usaha), area 14% → 0, titik akhir dengan cincin latar.
 * Hiasan bila tanpa `accessibilityLabel`.
 */
export function Sparkline({
  values,
  width = 140,
  height = 48,
  category = 'usaha',
  area = true,
  dot = true,
  strokeWidth = 2.5,
  accessibilityLabel,
  style,
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  category?: Category;
  area?: boolean;
  dot?: boolean;
  strokeWidth?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, marker } = useTheme();
  const a = marker[category];
  const id = useGradId('sp');
  const pts = scalePoints(values, width, height);
  const last = pts[pts.length - 1];
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      style={[{ width, height }, style]}
    >
      <Svg width={width} height={height} style={{ overflow: 'visible' }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={a.base} stopOpacity={0.14} />
            <Stop offset="1" stopColor={a.base} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {area && pts.length > 1 ? <Path d={areaPath(pts, height)} fill={`url(#${id})`} /> : null}
        {pts.length > 1 ? (
          <Path d={smoothPath(pts)} stroke={a.base} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        ) : null}
        {dot && last ? <EndDot x={last[0]} y={last[1]} color={a.base} ring={c.bg} r={4.5} /> : null}
      </Svg>
    </View>
  );
}

/**
 * Grafik area besar (Usaha, §8): garis ungu 3 dp, area 14% → 0, titik akhir 6 dengan cincin latar. Kisi putus-putus dan
 * label sumbu hanya bila diminta (bawaannya tanpa, supaya tenang). Lebar mengikuti wadah.
 */
export function AreaChart({
  values,
  labels,
  height = 200,
  category = 'usaha',
  grid = false,
  highlight,
  accessibilityLabel,
  style,
}: {
  values: readonly number[];
  labels?: readonly string[];
  height?: number;
  category?: Category;
  /** Kisi garis putus-putus. */
  grid?: boolean;
  /** Indeks yang disorot (bawaan: terakhir). */
  highlight?: number;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, marker } = useTheme();
  const a = marker[category];
  const id = useGradId('ar');
  const [width, setWidth] = useState(0);
  const chartH = height - (labels ? 28 : 0);
  const pad = 8;
  const pts = width > 0 ? scalePoints(values, width, chartH, pad, 24) : [];
  const hi = highlight ?? values.length - 1;
  const hp = pts[hi];
  const gridY = [0.25, 0.55, 0.85].map((f) => Math.round(chartH * f) + 0.5);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={[{ height }, style]}
    >
      {width > 0 ? (
        <Svg width={width} height={chartH} style={{ overflow: 'visible' }}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={a.base} stopOpacity={0.14} />
              <Stop offset="1" stopColor={a.base} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {(grid ? gridY : []).map((y) => (
            <Line key={y} x1={0} x2={width} y1={y} y2={y} stroke={c.line} strokeWidth={1} strokeDasharray="2 5" />
          ))}
          {pts.length > 1 ? <Path d={areaPath(pts, chartH)} fill={`url(#${id})`} /> : null}
          {pts.length > 1 ? (
            <Path d={smoothPath(pts)} stroke={a.base} strokeWidth={3} strokeLinecap="round" fill="none" />
          ) : null}
          {hp ? <EndDot x={hp[0]} y={hp[1]} color={a.base} ring={c.bg} r={6} /> : null}
        </Svg>
      ) : null}
      {labels && width > 0 ? (
        <View style={{ height: 28, marginTop: 0 }}>
          {labels.map((l, i) => {
            const p = pts[i];
            if (!p) return null;
            const on = i === hi;
            return (
              <Txt
                key={`${l}-${i}`}
                v="micro"
                weight={on ? 700 : 500}
                color={on ? c.text : c.muted}
                maxFontSizeMultiplier={1.2}
                style={{ position: 'absolute', top: 10, left: p[0] - 24, width: 48, textAlign: 'center' }}
              >
                {l}
              </Txt>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
