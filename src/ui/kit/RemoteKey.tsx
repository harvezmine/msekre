import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, onVoice } from '@/theme/tokens';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Txt } from '../Txt';
import { PressableScale } from './PressableScale';

/**
 * - `neutral`: tombol remote biasa (`surface`, gelap `raised`, bayangan `key` dengan sorot atas).
 * - `power`: tombol daya, dibacakan sebagai sakelar. Menyala (`on`): hijau penuh dengan cahaya hijau. Mati: netral.
 * - `selected`: pilihan aktif (mode AC): hijau lembut + cincin hijau 2 dp + ikon dan label hijau.
 * - `brand`: hijau penuh (contoh mic di kolom Tambah).
 * - `ink`: isian warna teks (putar/jeda).
 * - `glass`: di atas kanvas Mode Suara.
 */
export type RemoteKeyVariant = 'neutral' | 'power' | 'selected' | 'brand' | 'ink' | 'glass';

export interface RemoteKeyProps {
  /** Nama tombol untuk pembaca layar (dan tulisan di bawah bila `caption`). */
  label: string;
  icon?: IconName;
  /** Isi pengganti ikon, contoh tulisan "OK". */
  children?: ReactNode;
  /** Satu kata di bawah tombol, hanya bila ikonnya tidak jelas (mode AC). */
  caption?: string;
  /** Diameter 60–100; bawaan 64. */
  size?: number;
  variant?: RemoteKeyVariant;
  /** Untuk `power`: perangkat sedang menyala (hijau). */
  on?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Keadaan terpilih untuk pembaca layar (bawaannya ikut `variant="selected"`). */
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Tombol remote bulat yang terasa fisik (§5, §8): sorot + bayangan, mengecil ke 0,94 dengan pegas, getar ringan saat
 * jari menyentuh (daya: sedang). Kenyamanan dulu: bawaan 64 dp, tidak pernah di bawah 56 (area sentuh).
 */
export function RemoteKey({
  label,
  icon,
  children,
  caption,
  size = 64,
  variant = 'neutral',
  on = false,
  onPress,
  onLongPress,
  disabled,
  selected,
  style,
  testID,
}: RemoteKeyProps) {
  const { c, shadow, scheme } = useTheme();
  const keyBg = scheme === 'dark' ? c.raised : c.surface;
  let bg = keyBg;
  let fg = c.text;
  let boxShadow: string | undefined = shadow.key;
  switch (variant) {
    case 'power':
      bg = on ? c.brand : keyBg;
      fg = on ? c.onBrand : c.muted;
      boxShadow = on ? shadow.power : shadow.key;
      break;
    case 'selected':
      bg = c.brandSoft;
      fg = c.brandInk;
      boxShadow = `inset 0 0 0 2px ${c.brand}`;
      break;
    case 'brand':
      bg = c.brand;
      fg = c.onBrand;
      boxShadow = shadow.power;
      break;
    case 'ink':
      bg = c.text;
      fg = c.bg;
      break;
    case 'glass':
      bg = onVoice.button;
      fg = onVoice.text;
      boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.08)';
      break;
  }
  const picked = variant === 'selected' || !!selected;
  const iconSize = size >= 112 ? 40 : size >= 88 ? 34 : size >= 72 ? 30 : 26;
  const key = (
    <PressableScale
      testID={testID}
      // Tombol daya = sakelar (dibacakan "nyala"/"mati"); tombol lain = tombol biasa.
      accessibilityRole={variant === 'power' ? 'switch' : 'button'}
      accessibilityLabel={label}
      accessibilityState={
        variant === 'power' ? { checked: on } : selected !== undefined || picked ? { selected: picked } : undefined
      }
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      scaleTo={motion.press.keyScale}
      haptic={variant === 'power' ? 'medium' : 'light'}
      hapticOnPressIn
      hitSlop={size < 56 ? (56 - size) / 2 : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        boxShadow,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children ?? (icon ? <Icon name={icon} size={iconSize} color={fg} strokeWidth={2} /> : null)}
    </PressableScale>
  );
  if (!caption) return style ? <View style={style}>{key}</View> : key;
  return (
    <View style={[{ alignItems: 'center', gap: 10 }, style]}>
      {key}
      <Txt
        v="caption"
        weight={picked ? 600 : 500}
        color={variant === 'glass' ? onVoice.label : picked ? c.brandInk : c.muted}
        maxFontSizeMultiplier={1.2}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {caption}
      </Txt>
    </View>
  );
}
