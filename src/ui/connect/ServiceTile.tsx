import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';

/** Huruf ubin layanan di katalog: huruf pertama dua kata pertama ("Google Drive" -> "GD", "Notion" -> "No"). */
export function monoOf(name: string): string {
  const words = name.split(/[\s·&]+/).filter(Boolean);
  if (words.length >= 2) return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  return name.slice(0, 2);
}

export function ServiceTile({ name }: { name: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: c.paper,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt weight={700} style={{ fontSize: 13 }}>
        {monoOf(name)}
      </Txt>
    </View>
  );
}
