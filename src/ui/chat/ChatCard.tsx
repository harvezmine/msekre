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
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: c.ripple }}
      style={{
        flex: 1,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? c.green : c.card,
        borderWidth: primary ? 0 : 1,
        borderColor: c.line,
      }}
    >
      <Txt weight={600} color={primary ? c.onGreen : c.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}
