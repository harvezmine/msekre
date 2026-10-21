import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { BusinessSource } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';

/** "Moka, rekening BCA, dan TikTok Shop". */
export function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} dan ${items[items.length - 1]}`;
}

/** Asal data usaha. Yang belum tersambung ditawarkan lewat Terhubung. */
export function SourcesRow({ sources }: { sources: BusinessSource[] }) {
  const { c } = useTheme();
  const on = sources.filter((s) => s.connected).map((s) => s.label);
  const off = sources.filter((s) => !s.connected);
  if (on.length === 0 && off.length === 0) return null;
  return (
    <View style={{ gap: 4, paddingHorizontal: 20 }}>
      {on.length > 0 ? (
        <Txt v="caption" color={c.muted}>
          Data dari {joinWords(on)}.
        </Txt>
      ) : null}
      {off.map((s) => (
        <Pressable
          key={s.key}
          accessibilityRole="button"
          accessibilityLabel={`Sambungkan ${s.label}`}
          onPress={() => router.push(s.service ? `/terhubung/masuk?id=${encodeURIComponent(s.service)}` : '/terhubung')}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Txt weight={600} color={c.brandInk}>
            Sambungkan {s.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}
