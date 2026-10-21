import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';
import { AccentIcon } from './AccentIcon';
import { Surface } from './Surface';

/** Kartu "Coba bilang" (§8 `SuggestionCard`): satu contoh kalimat untuk pengguna baru. Ketuk membuka chat berisi kalimatnya. */
export function SuggestionCard({ text, onPress }: { text: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Surface
      variant="raised"
      radius={26}
      onPress={onPress}
      haptic="light"
      accessibilityLabel={`Coba bilang: ${text}`}
      accessibilityHint="Buka chat dengan kalimat ini"
      style={{ paddingVertical: 20, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 16 }}
    >
      <AccentIcon icon="mic" tone="brand" size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt color={c.muted} style={{ fontSize: 13, lineHeight: 18 }} weight={500}>
          Coba bilang
        </Txt>
        <Txt v="quote">{`“${text}”`}</Txt>
      </View>
    </Surface>
  );
}
