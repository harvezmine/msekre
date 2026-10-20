import { Text, type TextProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { FONT, typeScale } from '@/theme/tokens';

export type TxtVariant = keyof typeof typeScale;

interface Props extends TextProps {
  v?: TxtVariant;
  color?: string;
  weight?: keyof typeof FONT;
  /** Angka uang dan jam: lebar tiap angka sama, jadi tidak bergeser. */
  tabular?: boolean;
}

export function Txt({ v = 'body', color, weight, tabular, style, ...rest }: Props) {
  const { c } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        typeScale[v],
        { color: color ?? c.ink },
        weight ? { fontFamily: FONT[weight] } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
