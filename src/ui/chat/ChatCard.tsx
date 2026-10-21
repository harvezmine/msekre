import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { PressableScale } from '../kit/PressableScale';
import { Txt } from '../Txt';

/**
 * Bingkai kartu di dalam utas chat: permukaan tenang tanpa garis (radius 24, isi 16, bayangan `e1`), selebar kolom sampai
 * paling besar 360. Satu kartu = satu hal yang bisa disentuh (draf, perangkat, pilihan, pembayaran, berkas, notulen).
 */
export function ChatCard({ style, ...rest }: ViewProps) {
  const { c, shadow } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: c.surface,
          boxShadow: shadow.e1,
          borderRadius: 24,
          padding: 16,
          gap: 14,
          maxWidth: 360,
          alignSelf: 'stretch',
        },
        style,
      ]}
    />
  );
}

/** Tombol bulat 52 dp di dalam kartu chat (mengecil pelan saat ditekan); yang utama berlatar hijau brand. */
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
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        opacity: disabled ? 0.5 : 1,
        flex: 1,
        minHeight: 52,
        paddingHorizontal: 12,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? c.brand : c.sunken,
      }}
    >
      <Txt weight={600} color={primary ? c.onBrand : c.text} numberOfLines={1}>
        {label}
      </Txt>
    </PressableScale>
  );
}
