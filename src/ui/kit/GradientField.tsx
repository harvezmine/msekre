import { useId, useState } from 'react';
import { View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { FIELD_HEIGHT, type FieldRecipe } from '@/theme/tokens';

/**
 * Latar gradasi lembut di bagian atas layar (§1.3): beberapa elips cahaya radial yang memudar, tanpa blur (pudarnya
 * gradasi sudah cukup lembut). Diletakkan absolut di belakang isi; tidak menangkap sentuhan. Resep per mode di token
 * (`hero` Beranda hijau, `cool` AC dingin, `warm` lampu, `profile` kartu profil).
 */
export function GradientField({
  recipe = 'hero',
  height,
  style,
}: {
  recipe?: FieldRecipe;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { field } = useTheme();
  const win = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const w = width || win.width;
  // Id unik per bidang (beberapa SVG di satu halaman web berbagi ruang id); tanpa ":" supaya aman di url(#...).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const h = height ?? FIELD_HEIGHT[recipe];
  const layers = field[recipe];
  return (
    <View
      testID={`gradasi-${recipe}`}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: h, overflow: 'hidden' }, style]}
    >
      <Svg width={w} height={h}>
        <Defs>
          {layers.map((l, i) => (
            <RadialGradient key={i} id={`gf${uid}${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={l.color} stopOpacity={l.opacity} />
              <Stop offset={l.fade} stopColor={l.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {layers.map((l, i) => (
          <Ellipse key={i} cx={l.x * w} cy={l.y * h} rx={l.rx} ry={l.ry} fill={`url(#gf${uid}${i})`} />
        ))}
      </Svg>
    </View>
  );
}
