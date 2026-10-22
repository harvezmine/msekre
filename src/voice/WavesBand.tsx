import { View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { gradients } from '@/theme/tokens';
import type { WaveState } from './waveMath';

/** Pita cahaya cadangan: tiga elips lembut (hijau, teal, biru) di sekitar garis gelombang. */
const GLOWS = [
  { color: gradients.waves.green, x: 0.22, y: 0.5, rx: 0.62, ry: 0.2, opacity: 0.5 },
  { color: gradients.waves.teal, x: 0.58, y: 0.47, rx: 0.55, ry: 0.17, opacity: 0.45 },
  { color: gradients.waves.blue, x: 0.92, y: 0.52, rx: 0.5, ry: 0.19, opacity: 0.4 },
] as const;

export interface WavesBandProps {
  state: WaveState;
  width: number;
  height: number;
}

/**
 * Cadangan gelombang tanpa Skia: pita cahaya brand yang diam di bawah layar (SVG biasa, tanpa worklet). Dipakai di web
 * tanpa CanvasKit, dan di HP bila Skia gagal dimuat atau gelombangnya berkendala (src/voice/Waves.tsx); kontrol Mode
 * Suara di atasnya tetap jalan.
 */
export function WavesBand({ height, width, state }: WavesBandProps) {
  const dim = state === 'off' || state === 'error' ? 0.4 : state === 'thinking' ? 0.75 : 1;
  return (
    <View
      testID="gelombang"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, opacity: dim }}
    >
      <Svg testID="gelombang-cadangan" width={width} height={height}>
        <Defs>
          {GLOWS.map((g, i) => (
            <RadialGradient
              key={i}
              id={`pita-${i}`}
              cx={g.x * width}
              cy={g.y * height}
              rx={g.rx * width}
              ry={g.ry * height}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={g.color} stopOpacity={g.opacity} />
              <Stop offset="1" stopColor={g.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {GLOWS.map((g, i) => (
          <Ellipse
            key={i}
            cx={g.x * width}
            cy={g.y * height}
            rx={g.rx * width}
            ry={g.ry * height}
            fill={`url(#pita-${i})`}
          />
        ))}
      </Svg>
    </View>
  );
}
