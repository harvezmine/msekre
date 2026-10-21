import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { Category } from '@/theme/tokens';
import { Icon } from '../Icon';
import type { IconName } from '../icons';

/**
 * - kategori (`agenda`, `rumah`, `usaha`, `terhubung`, `warn`): lingkaran netral `sunken` + ikon tinta kategori;
 * - `brand`: lingkaran hijau lembut + ikon hijau (Asisten, terkunci);
 * - `on`: lingkaran hijau penuh + ikon `onBrand` (perangkat menyala);
 * - `neutral`: lingkaran `sunken` + ikon redup (mati, bantuan).
 */
export type AccentTone = Category | 'brand' | 'on' | 'neutral';

/** Ukuran ikon untuk lingkaran 40–52. */
export function iconSizeFor(size: number): number {
  if (size <= 40) return 20;
  if (size <= 46) return 22;
  return 24;
}

/** Ikon di lingkaran (§1.3, §8). Warna kategori hanya pada ikonnya, tidak pernah pada lingkaran. Hiasan saja. */
export function AccentIcon({
  icon,
  tone = 'neutral',
  size = 44,
  style,
}: {
  icon: IconName;
  tone?: AccentTone;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, marker } = useTheme();
  let bg: string = c.sunken;
  let fg: string = c.muted;
  if (tone === 'brand') {
    bg = c.brandSoft;
    fg = c.brandInk;
  } else if (tone === 'on') {
    bg = c.brand;
    fg = c.onBrand;
  } else if (tone !== 'neutral') {
    fg = marker[tone].ink;
  }
  return (
    <View
      testID={`aksen-${icon}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Icon name={icon} size={iconSizeFor(size)} color={fg} />
    </View>
  );
}
