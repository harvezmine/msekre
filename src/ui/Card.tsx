import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

/** Permukaan kartu lama: tanpa garis tepi, bayangan sangat lembut (`e1`), radius 24. Komponen baru memakai `Surface`. */
export function Card({ style, ...rest }: ViewProps) {
  const { c, shadow, radius } = useTheme();
  return (
    <View
      {...rest}
      style={[{ backgroundColor: c.surface, borderRadius: radius.tile, padding: 20, boxShadow: shadow.e1 }, style]}
    />
  );
}
