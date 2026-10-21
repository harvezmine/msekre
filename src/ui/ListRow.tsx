import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { IconName } from './icons';
import type { AccentTone } from './kit/AccentIcon';
import { ListRow as KitListRow } from './kit/ListRow';

interface Props {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  /** Peringatan: ikon dan keterangan berwarna koral, penanda `warn` (contoh perangkat tidak terjangkau). */
  warn?: boolean;
  /** Dulu: baris terakhir tanpa garis bawah. Baris Fase R tidak bergaris, jadi diabaikan. */
  last?: boolean;
  /** Ganti chevron, contoh centang atau sakelar. */
  trailing?: ReactNode;
  /** Warna bidang ikon; bawaannya netral. */
  tone?: AccentTone;
}

/** Baris daftar layar lama, kini memakai `ListRow` Fase R (tanpa kotak, ikon dalam lingkaran). */
export function ListRow({ icon, title, subtitle, onPress, warn = false, trailing, tone }: Props) {
  const { marker } = useTheme();
  return (
    <KitListRow
      icon={icon}
      tone={warn ? 'warn' : (tone ?? 'neutral')}
      title={title}
      description={subtitle}
      descriptionColor={warn ? marker.warn.ink : undefined}
      descriptionLines={0}
      onPress={onPress}
      trailing={trailing}
      inset={0}
    />
  );
}

/** Kelompok baris: baris Fase R langsung di atas latar, tanpa bingkai. */
export function ListGroup({ children }: { children: ReactNode }) {
  return <View>{children}</View>;
}
