import { useId, type ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import type { HapticKind } from './haptics';
import { PressableScale } from './PressableScale';

/**
 * - `plain`: ubin di atas latar (`surface`, bayangan `e1`).
 * - `raised`: kartu yang menonjol (`surface`, bayangan `e2`, radius 28): persetujuan, profil, saran.
 * - `on`: ubin yang menyala. Terang: hijau lembut tanpa bayangan. Gelap: permukaan arang + cahaya hijau di pojok kanan
 *   atas (tidak ada permukaan hijau di mode gelap).
 * - `sunken`: blok tenang tanpa bayangan.
 * - `ghost`: perangkat tidak terjangkau: transparan dengan cincin garis 1,5.
 * Warna kategori tidak pernah menjadi warna permukaan.
 */
export type SurfaceVariant = 'plain' | 'raised' | 'on' | 'sunken' | 'ghost';

export interface SurfaceProps extends Omit<ViewProps, 'style' | 'children'> {
  children?: ReactNode;
  variant?: SurfaceVariant;
  /** Bawaan: 28 untuk `raised`, 20 untuk `sunken`, selain itu 26. */
  radius?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  /** Bila ada, permukaan bisa ditekan (mengecil dengan pegas). */
  onPress?: () => void;
  onLongPress?: () => void;
  haptic?: HapticKind;
  accessibilityLabel?: string;
}

/** Cahaya hijau radial 160 dp di pojok kanan atas (ubin menyala, mode gelap). */
function CornerGlow({ color }: { color: string }) {
  const id = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View
      pointerEvents="none"
      testID="cahaya-nyala"
      style={{ position: 'absolute', top: -80, right: -80, width: 160 + 80, height: 160 + 80 }}
    >
      <Svg width={240} height={240}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={120} cy={120} rx={120} ry={120} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Permukaan tanpa garis tepi: hanya untuk hal yang bisa disentuh atau satu kesatuan isi. */
export function Surface({
  children,
  variant = 'plain',
  radius,
  padding,
  style,
  onPress,
  onLongPress,
  haptic,
  accessibilityLabel,
  accessibilityRole,
  ...rest
}: SurfaceProps) {
  const t = useTheme();
  const r = radius ?? (variant === 'raised' ? t.radius.card : variant === 'sunken' ? t.radius.block : t.radius.tile);
  const darkOn = variant === 'on' && t.scheme === 'dark';
  let look: ViewStyle;
  switch (variant) {
    case 'raised':
      look = { backgroundColor: t.c.surface, boxShadow: t.shadow.e2 };
      break;
    case 'on':
      look = darkOn ? { backgroundColor: t.c.surface, overflow: 'hidden' } : { backgroundColor: t.c.brandSoft };
      break;
    case 'sunken':
      look = { backgroundColor: t.c.sunken };
      break;
    case 'ghost':
      look = { backgroundColor: 'transparent', boxShadow: `inset 0 0 0 1.5px ${t.c.line}` };
      break;
    default:
      look = { backgroundColor: t.c.surface, boxShadow: t.shadow.e1 };
  }
  const base: ViewStyle = { borderRadius: r, padding, ...look };
  const content = (
    <>
      {darkOn ? <CornerGlow color={t.c.brandGlow} /> : null}
      {children}
    </>
  );
  if (onPress || onLongPress) {
    return (
      <PressableScale
        {...rest}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onLongPress={onLongPress}
        haptic={haptic}
        style={[base, style]}
      >
        {content}
      </PressableScale>
    );
  }
  return (
    <View {...rest} accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel} style={[base, style]}>
      {content}
    </View>
  );
}
