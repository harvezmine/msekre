import { Pressable } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './Txt';

/** Tombol utama penuh lebar, 56 dp (desain layar pertama kali). */
export function PrimaryButton({
  label,
  display,
  onPress,
  disabled = false,
}: {
  /** Nama tombol untuk pembaca layar (dan tulisannya, bila `display` tidak ada). */
  label: string;
  /** Tulisan yang lebih pendek di tombol, bila nama lengkapnya terlalu panjang untuk dibaca sekilas. */
  display?: string;
  onPress: () => void;
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
        height: 56,
        borderRadius: 28,
        backgroundColor: c.brand,
        opacity: disabled ? 0.4 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
      }}
    >
      <Txt weight={600} color={c.onBrand} style={{ fontSize: 17 }}>
        {display ?? label}
      </Txt>
    </Pressable>
  );
}
