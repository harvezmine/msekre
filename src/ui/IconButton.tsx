import { Pressable } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import type { IconName } from './icons';

interface Props {
  icon: IconName;
  label: string;
  onPress?: () => void;
  /** Latar `sunken` netral, seperti tombol Mode Suara di header chat. */
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
      android_ripple={{ color: c.ripple, borderless: true, radius: 24 }}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tinted ? c.sunken : 'transparent',
      }}
    >
      <Icon name={icon} size={tinted ? 22 : 24} color={color ?? c.text} />
    </Pressable>
  );
}
