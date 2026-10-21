import { Text, type TextProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { FONT, FONT_SCALE_CAP, typeScale, type TypeVariant } from '@/theme/tokens';

export type TxtVariant = TypeVariant;

interface Props extends TextProps {
  v?: TxtVariant;
  color?: string;
  weight?: keyof typeof FONT;
  /** Angka uang, jam, dan suhu: lebar tiap angka sama, jadi tidak bergeser. */
  tabular?: boolean;
}

/** Teks dengan skala huruf Fase R. Angka raksasa (`readout`, `figure`) dibatasi skala huruf HP 1,1. */
export function Txt({ v = 'body', color, weight, tabular, style, maxFontSizeMultiplier, ...rest }: Props) {
  const { c } = useTheme();
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? FONT_SCALE_CAP[v]}
      style={[
        typeScale[v],
        { color: color ?? c.text },
        weight ? { fontFamily: FONT[weight] } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
