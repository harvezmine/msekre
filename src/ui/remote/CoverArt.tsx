import { useId, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { MediaSource } from '@/api/transport';
import { useTheme } from '@/theme/ThemeProvider';
import { RemoteImage } from '../chat/RemoteImage';
import { useMedia } from '../chat/useMedia';

/** Angka tetap dari teks (judul lagu), supaya lagu yang sama selalu mendapat warna yang sama. */
export function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** HSL (derajat, persen, persen) ke "#RRGGBB". */
export function hslHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`.toUpperCase();
}

/** Warna sampul dari judul: langit dua rona, matahari hangat, dua bukit gelap. */
export function coverColors(title: string) {
  const h = hashOf(title) % 360;
  const h2 = (h + 40) % 360;
  return {
    top: hslHex(h, 45, 32),
    mid: hslHex(h2, 50, 48),
    low: hslHex((h2 + 30) % 360, 72, 66),
    hill: hslHex(h, 38, 34),
    hillFront: hslHex(h, 42, 21),
    glow: hslHex(h2, 55, 60),
  };
}

/**
 * Sampul lagu (§7 Speaker): gambar sampul dari server bila ada (`artMediaId`), selain itu lukisan gradasi yang warnanya
 * diambil dari judul (matahari di antara dua bukit, seperti papan 14). Mati: diredupkan. Hiasan; judulnya dibacakan
 * terpisah.
 */
export function CoverArt({
  title,
  artMediaId,
  mediaUrl,
  size,
  dimmed = false,
  style,
}: {
  title: string;
  artMediaId?: string;
  mediaUrl: (id: string) => Promise<MediaSource>;
  size: number;
  dimmed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { radius } = useTheme();
  const k = coverColors(title || 'Speaker');
  return (
    <View
      testID="sampul"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.cover,
          overflow: 'hidden',
          boxShadow: `0 24px 48px -18px ${k.glow}99`,
          opacity: dimmed ? 0.45 : 1,
        },
        style,
      ]}
    >
      {artMediaId ? (
        <Art id={artMediaId} mediaUrl={mediaUrl} size={size} title={title} fallback={<Painted size={size} k={k} />} />
      ) : (
        <Painted size={size} k={k} />
      )}
    </View>
  );
}

function Art({
  id,
  mediaUrl,
  size,
  title,
  fallback,
}: {
  id: string;
  mediaUrl: (id: string) => Promise<MediaSource>;
  size: number;
  title: string;
  fallback: ReactNode;
}) {
  const { media, reload } = useMedia(mediaUrl, id);
  if (media !== null && media !== 'error' && media.kind === 'uri') {
    return (
      <RemoteImage
        uri={media.uri}
        headers={media.headers}
        label={title}
        resizeMode="cover"
        style={{ width: size, height: size }}
        failedStyle={{ width: size, height: size }}
        reload={reload}
      />
    );
  }
  return <>{fallback}</>;
}

function Painted({ size, k }: { size: number; k: ReturnType<typeof coverColors> }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const s = size;
  return (
    <Svg width={s} height={s}>
      <Defs>
        <LinearGradient id={`langit${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={k.top} />
          <Stop offset="0.55" stopColor={k.mid} />
          <Stop offset="0.8" stopColor={k.low} />
        </LinearGradient>
        <RadialGradient id={`sinar${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFE7A8" stopOpacity={0.9} />
          <Stop offset="0.45" stopColor="#FFC56E" stopOpacity={0.45} />
          <Stop offset="1" stopColor="#FFC56E" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={s} height={s} fill={`url(#langit${uid})`} />
      <Circle cx={s * 0.64} cy={s * 0.6} r={s * 0.3} fill={`url(#sinar${uid})`} />
      <Circle cx={s * 0.64} cy={s * 0.6} r={s * 0.12} fill="#FFEFC2" />
      <Path
        d={`M0 ${s * 0.7} C ${s * 0.25} ${s * 0.6}, ${s * 0.45} ${s * 0.66}, ${s * 0.62} ${s * 0.74} S ${s * 0.9} ${s * 0.72}, ${s} ${s * 0.68} V ${s} H 0 Z`}
        fill={k.hill}
        opacity={0.85}
      />
      <Path
        d={`M0 ${s * 0.8} C ${s * 0.3} ${s * 0.74}, ${s * 0.55} ${s * 0.8}, ${s * 0.75} ${s * 0.84} S ${s * 0.95} ${s * 0.82}, ${s} ${s * 0.8} V ${s} H 0 Z`}
        fill={k.hillFront}
      />
    </Svg>
  );
}
