import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

export function Card({ style, ...rest }: ViewProps) {
  const { c } = useTheme();
  return (
    <View
      {...rest}
      style={[
        { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: radius.card, padding: 20 },
        style,
      ]}
    />
  );
}
