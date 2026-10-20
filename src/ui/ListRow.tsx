import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Txt } from './Txt';

interface Props {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  /** Peringatan: tile dan keterangan berwarna clay (contoh perangkat tidak terjangkau). */
  warn?: boolean;
  /** Baris terakhir dalam kartu: tanpa garis bawah. */
  last?: boolean;
  /** Ganti chevron, contoh centang. */
  trailing?: React.ReactNode;
}

/** Baris kartu daftar: tile ikon 40, judul, keterangan, chevron (desain 2h dan 2q). Taruh di dalam `ListGroup`. */
export function ListRow({ icon, title, subtitle, onPress, warn = false, last = false, trailing }: Props) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      android_ripple={{ color: c.ripple }}
      style={{
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.line,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          backgroundColor: warn ? c.clayBg : c.mint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={22} color={warn ? c.clay : c.green} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 8 }}>
        <Txt weight={600}>{title}</Txt>
        {subtitle ? (
          <Txt v="caption" color={warn ? c.clay : c.muted}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {trailing ?? <Icon name="chevR" size={20} color={c.muted} />}
    </Pressable>
  );
}

/** Kartu pembungkus baris-baris ListRow. */
export function ListGroup({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 24,
        paddingVertical: 4,
        paddingLeft: 16,
        paddingRight: 12,
      }}
    >
      {children}
    </View>
  );
}
