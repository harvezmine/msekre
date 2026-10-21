import { useEffect, useState, type ComponentType } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { gradients } from '@/theme/tokens';
import type { WavesProps } from './WavesSkia';

/**
 * Gelombang Mode Suara di web (pratinjau pengembangan dan tangkapan layar tanpa HP). Skia di web butuh CanvasKit
 * (`canvaskit.wasm`, kira-kira 7 MB) yang tidak ikut repo: `scripts/shots.mjs` menyalinnya ke `public/` (diabaikan git)
 * selama mengambil gambar. Bila ada, komponen Skia yang sama dengan di HP dipakai; bila tidak, pita gradasi diam.
 */
let loaded: ComponentType<WavesProps> | null = null;
let loading: Promise<ComponentType<WavesProps> | null> | null = null;

async function loadSkiaWaves(): Promise<ComponentType<WavesProps> | null> {
  try {
    const probe = await fetch('/canvaskit.wasm', { method: 'HEAD' });
    if (!probe.ok) return null;
    const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
    await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
    const mod = await import('./WavesSkia');
    loaded = mod.WavesSkia;
    return loaded;
  } catch {
    return null;
  }
}

export function Waves(props: WavesProps) {
  const [Impl, setImpl] = useState<ComponentType<WavesProps> | null>(() => loaded);
  useEffect(() => {
    if (Impl) return;
    let alive = true;
    loading ??= loadSkiaWaves();
    void loading.then((C) => {
      if (alive && C) setImpl(() => C);
    });
    return () => {
      alive = false;
    };
  }, [Impl]);
  return Impl ? <Impl {...props} /> : <WavesBand {...props} />;
}

export type { WavesProps };

/** Pita cahaya cadangan: tiga elips lembut (hijau, teal, biru) di sekitar garis gelombang. */
const GLOWS = [
  { color: gradients.waves.green, x: 0.22, y: 0.5, rx: 0.62, ry: 0.2, opacity: 0.5 },
  { color: gradients.waves.teal, x: 0.58, y: 0.47, rx: 0.55, ry: 0.17, opacity: 0.45 },
  { color: gradients.waves.blue, x: 0.92, y: 0.52, rx: 0.5, ry: 0.19, opacity: 0.4 },
] as const;

/** Cadangan tanpa CanvasKit: pita cahaya brand yang diam di bawah layar. */
function WavesBand({ height, width, state }: WavesProps) {
  const dim = state === 'off' || state === 'error' ? 0.4 : state === 'thinking' ? 0.75 : 1;
  return (
    <View
      testID="gelombang"
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, opacity: dim }}
    >
      <Svg width={width} height={height}>
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
