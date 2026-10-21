import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Txt } from '../Txt';

export interface SectionAction {
  /** Nama aksi; tampil sebagai tautan, atau hanya dibacakan bila `iconOnly`. */
  label: string;
  onPress: () => void;
  /** Ikon tombol; bawaan chevron. */
  icon?: IconName;
  /** Hanya ikon dalam lingkaran 48 (lebih sedikit tulisan). */
  iconOnly?: boolean;
}

/**
 * Judul bagian (18/600) di kiri, aksi opsional di kanan: tautan hijau brand dengan chevron, atau ikon saja. Area sentuh
 * aksi minimal 48. Tanpa aksi, `value` boleh berisi nilai pendek (contoh "2"). Aksen bidang tidak dipakai di judul.
 */
export function SectionHeader({
  title,
  action,
  value,
  style,
}: {
  title: string;
  action?: SectionAction;
  value?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
        style,
      ]}
    >
      <Txt v="section" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </Txt>
      {action ? (
        action.iconOnly ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            android_ripple={{ color: c.ripple, borderless: true, radius: 24 }}
            style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name={action.icon ?? 'chevR'} size={22} color={c.brandInk} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            android_ripple={{ color: c.ripple, borderless: true }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 48, paddingLeft: 8 }}
          >
            <Txt v="label" weight={600} color={c.brandInk}>
              {action.label}
            </Txt>
            <Icon name={action.icon ?? 'chevR'} size={18} color={c.brandInk} />
          </Pressable>
        )
      ) : value ? (
        <Txt v="label" tabular color={c.muted}>
          {value}
        </Txt>
      ) : null}
    </View>
  );
}
