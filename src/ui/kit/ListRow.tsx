import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Txt } from '../Txt';
import { AccentIcon, type AccentTone } from './AccentIcon';

export interface KitListRowProps {
  icon?: IconName;
  tone?: AccentTone;
  title: string;
  /** Satu baris penjelasan (dipotong bila terlalu panjang). */
  description?: string;
  /** Warna penjelasan; bawaannya redup. */
  descriptionColor?: string;
  /** Batas baris penjelasan; bawaan 1, 0 = tanpa batas. */
  descriptionLines?: number;
  /** Nilai pendek di kanan (contoh "Nyala"), menggantikan chevron. */
  value?: string;
  onPress?: () => void;
  /** Chevron di kanan; bawaannya ada bila baris bisa ditekan dan tidak ada `value`/`trailing`. */
  chevron?: boolean;
  /** Kontrol di kanan (sakelar, centang). */
  trailing?: ReactNode;
  /** Kontrol di bawah teks (contoh segmen Tampilan). */
  children?: ReactNode;
  /** Jarak kiri-kanan; bawaannya tepi halaman 20. */
  inset?: number;
  /** Ukuran lingkaran ikon; bawaan 44. */
  iconSize?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Baris daftar tanpa kotak (§5, Akun): ikon beraksen 44, judul 16/600, lalu nilai pendek atau chevron. Tinggi minimum
 * 72. Penjelasan satu baris hanya bila benar-benar perlu (`description`, bawaannya tidak ada): lebih baik ikon + label
 * pendek + nilai. Baris langsung di atas latar, tanpa kelompok berbingkai.
 */
export function ListRow({
  icon,
  tone = 'neutral',
  title,
  description,
  descriptionColor,
  descriptionLines = 1,
  value,
  onPress,
  chevron,
  trailing,
  children,
  inset = 20,
  iconSize = 44,
  accessibilityLabel,
  style,
}: KitListRowProps) {
  const { c } = useTheme();
  const showChevron = chevron ?? (!!onPress && value === undefined && !trailing);
  const label = accessibilityLabel ?? [title, description, value].filter(Boolean).join('. ');
  return (
    <View style={style}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={label}
        onPress={onPress}
        android_ripple={onPress ? { color: c.ripple } : undefined}
        style={{
          minHeight: 72,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: inset,
          paddingVertical: 12,
        }}
      >
        {icon ? <AccentIcon icon={icon} tone={tone} size={iconSize} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="row" weight={600}>
            {title}
          </Txt>
          {description ? (
            <Txt
              v="caption"
              weight={400}
              color={descriptionColor ?? c.muted}
              numberOfLines={descriptionLines || undefined}
            >
              {description}
            </Txt>
          ) : null}
        </View>
        {value !== undefined ? (
          <Txt v="body" tabular color={c.muted}>
            {value}
          </Txt>
        ) : null}
        {trailing}
        {showChevron ? <Icon name="chevR" size={20} color={c.faint} /> : null}
      </Pressable>
      {children ? (
        <View style={{ paddingLeft: inset + (icon ? iconSize + 14 : 0), paddingRight: inset, paddingBottom: 12 }}>
          {children}
        </View>
      ) : null}
    </View>
  );
}
