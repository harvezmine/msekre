import type { Capability, DeviceState } from '@/api/contract';
import { WARM } from '../kit/Slider';

type Rgb = [number, number, number];

const rgbOf = (hex: string): Rgb => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const hexOf = ([r, g, b]: Rgb): string =>
  `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();

/** Campur dua warna: `t` = 0 → `a`, 1 → `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return hexOf([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

const luminance = (hex: string) => {
  const [r, g, b] = rgbOf(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/** Warna cahaya pada suhu warna (Kelvin): jingga hangat 2200 K → putih krem 4000 K → biru pucat 6500 K. */
export function kelvinColor(k: number): string {
  const anchors: [number, string][] = [
    [2200, '#F59A45'],
    [2700, '#F5A04F'],
    [4000, '#FFCF8A'],
    [6500, '#BFD5F5'],
  ];
  if (k <= anchors[0]![0]) return anchors[0]![1];
  for (let i = 1; i < anchors.length; i++) {
    const [k1, c1] = anchors[i]!;
    const [k0, c0] = anchors[i - 1]!;
    if (k <= k1) return mix(c0, c1, (k - k0) / (k1 - k0));
  }
  return anchors[anchors.length - 1]![1];
}

/**
 * Warna cahaya lampu (§1.4: isi, bukan aksen): warna pilihan, atau suhu warna, atau putih hangat 3000 K. Warna yang
 * hampir putih diberi sedikit biru supaya tetap terlihat di atas permukaan terang. `stops` untuk penggeser tegak (atas
 * ke bawah), `glow` untuk cahaya di sekitar bola lampu.
 */
export function lightTint(
  state: DeviceState,
  caps: readonly Capability[],
): { stops: readonly [string, string, string]; glow: string; core: string } {
  const presets = caps.find((c) => c.type === 'color');
  let base: string | undefined;
  if (state.color) {
    const preset = presets?.type === 'color' ? presets.presets.find((p) => p.id === state.color) : undefined;
    const hex = preset?.hex ?? state.color;
    if (/^#[0-9a-f]{6}$/i.test(hex)) base = luminance(hex) > 0.86 ? mix(hex, '#B9CCEA', 0.55) : hex.toUpperCase();
  } else if (state.colorTemp !== undefined && caps.some((c) => c.type === 'colorTemp')) {
    base = kelvinColor(state.colorTemp);
  }
  if (!base) return { stops: WARM, glow: '#FFC460', core: '#FFF3DA' };
  return {
    stops: [mix(base, '#FFFFFF', 0.55), mix(base, '#FFFFFF', 0.25), base],
    glow: base,
    core: mix(base, '#FFFFFF', 0.8),
  };
}

/** Tiga pilihan suhu warna dalam rentang lampu: Hangat, Netral, Dingin. */
export function colorTempChoices(minK: number, maxK: number): { id: string; label: string; k: number }[] {
  const clamp = (k: number) => Math.min(maxK, Math.max(minK, k));
  return [
    { id: 'hangat', label: 'Hangat', k: clamp(2700) },
    { id: 'netral', label: 'Netral', k: clamp(4000) },
    { id: 'dingin', label: 'Dingin', k: clamp(6500) },
  ];
}
