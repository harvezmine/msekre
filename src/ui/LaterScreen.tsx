import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './Txt';

/** Tab yang layarnya dibangun di fase berikutnya. Hanya terlihat di build uji. */
export function LaterScreen({ title, phase }: { title: string; phase: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.paper, paddingTop: insets.top + 24, paddingHorizontal: 20, gap: 8 }}>
      <Txt v="title">{title}</Txt>
      <Txt color={c.muted}>Layar ini dibangun di {phase}.</Txt>
    </View>
  );
}
