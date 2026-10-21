import { Pressable, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '../Card';
import { Txt } from '../Txt';

/** Bingkai kartu di dalam utas chat (radius 20, isi 16; selebar kolom sampai paling besar 340). */
export function ChatCard({ style, ...rest }: ViewProps) {
  return (
    <Card {...rest} style={[{ borderRadius: 20, padding: 16, gap: 12, maxWidth: 340, alignSelf: 'stretch' }, style]} />
  );
}

/** Tombol bulat 48 dp di dalam kartu chat; yang utama berlatar hijau. */
export function CardButton({
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  /** Mati selagi aksinya berjalan. */
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: c.ripple }}
      style={{
        opacity: disabled ? 0.5 : 1,
        flex: 1,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? c.brand : c.sunken,
      }}
    >
      <Txt weight={600} color={primary ? c.onBrand : c.text}>
        {label}
      </Txt>
    </Pressable>
  );
}
