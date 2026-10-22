import { useEffect, useState, type ComponentType } from 'react';
import { WavesBand } from './WavesBand';
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
