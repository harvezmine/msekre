import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './Txt';

interface Props<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label?: string;
}

/** Segmen tiga pilihan seperti Hari ini / Minggu ini / Kalender di desain 2a. */
export function Segmented<T extends string>({ options, value, onChange, label }: Props<T>) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{
        height: 56,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.card,
        borderRadius: 28,
        padding: 4,
        flexDirection: 'row',
      }}
    >
      {options.map((o) => {
        const selected = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="tab"
            accessibilityLabel={o}
            accessibilityState={{ selected }}
            onPress={() => onChange(o)}
            android_ripple={{ color: c.ripple, borderless: false }}
            style={{
              flex: 1,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? c.mint : 'transparent',
            }}
          >
            <Txt weight={selected ? 600 : 500} color={selected ? c.green : c.muted} style={{ fontSize: 15 }}>
              {o}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
