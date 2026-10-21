import { Pressable, ScrollView } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './Txt';

interface Props<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}

/** Chip filter yang digulir mendatar, seperti di Riwayat (desain 2m). */
export function FilterChips<T extends string>({ options, value, onChange }: Props<T>) {
  const { c } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 4 }}
    >
      {options.map((o) => {
        const selected = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityLabel={o}
            accessibilityState={{ selected }}
            onPress={() => onChange(o)}
            android_ripple={{ color: c.ripple }}
            style={{
              height: 48,
              paddingHorizontal: 18,
              borderRadius: 24,
              backgroundColor: selected ? c.brandSoft : c.sunken,
              justifyContent: 'center',
            }}
          >
            <Txt weight={selected ? 600 : 500} color={selected ? c.brandInk : c.text} style={{ fontSize: 15 }}>
              {o}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
