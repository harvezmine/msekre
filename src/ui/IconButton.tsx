import { Pressable } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import type { IconName } from './icons';

interface Props {
  icon: IconName;
  label: string;
  onPress?: () => void;
  /** Latar mint dan ikon hijau, seperti tombol Mode Suara di header chat. */
  tinted?: boolean;
  color?: string;
}

export function IconButton({ icon, label, onPress, tinted = false, color }: Props) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tinted ? c.mint : 'transparent',
      }}
    >
      <Icon name={icon} size={tinted ? 22 : 24} color={color ?? (tinted ? c.green : c.ink)} />
    </Pressable>
  );
}
