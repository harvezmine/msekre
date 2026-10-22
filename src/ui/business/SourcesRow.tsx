import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { BusinessSource } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { LogoDock } from '../connect/ServiceCard';
import { ServiceLogo } from '../kit/ServiceLogo';
import { Txt } from '../Txt';

/** "Moka, rekening BCA, dan TikTok Shop". */
export function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} dan ${items[items.length - 1]}`;
}

/** Logo sebuah sumber: menurut layanannya di Terhubung, kalau tidak ada menurut kuncinya. */
const logoItem = (s: BusinessSource) => ({ id: s.service ?? s.key, name: s.label });

/** Asal data usaha, dengan logonya. Yang belum tersambung ditawarkan lewat Terhubung. */
export function SourcesRow({ sources }: { sources: BusinessSource[] }) {
  const { c } = useTheme();
  const on = sources.filter((s) => s.connected);
  const off = sources.filter((s) => !s.connected);
  if (on.length === 0 && off.length === 0) return null;
  return (
    <View style={{ gap: 4, paddingHorizontal: 20 }}>
      {on.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 }}>
          <LogoDock items={on.map(logoItem)} size={28} max={4} more={false} />
          <Txt v="caption" color={c.muted} style={{ flex: 1 }}>
            Data dari {joinWords(on.map((s) => s.label))}.
          </Txt>
        </View>
      ) : null}
      {off.map((s) => (
        <Pressable
          key={s.key}
          accessibilityRole="button"
          accessibilityLabel={`Sambungkan ${s.label}`}
          onPress={() => router.push(s.service ? `/terhubung/masuk?id=${encodeURIComponent(s.service)}` : '/terhubung')}
          style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <ServiceLogo id={logoItem(s).id} name={s.label} size={28} shadow={false} />
          <Txt weight={600} color={c.brandInk}>
            Sambungkan {s.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}
