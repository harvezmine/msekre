import { Pressable, ScrollView } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';

interface Props {
  rooms: readonly string[];
  value: string;
  onChange: (room: string) => void;
}

/** Tab ruangan dengan garis bawah hijau (desain 2c). */
export function RoomTabs({ rooms, value, onChange }: Props) {
  const { c } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: c.line }}
      contentContainerStyle={{ gap: 4, paddingHorizontal: 12, paddingTop: 8 }}
    >
      {rooms.map((r) => {
        const selected = r === value;
        return (
          <Pressable
            key={r}
            accessibilityRole="tab"
            accessibilityLabel={r}
            accessibilityState={{ selected }}
            onPress={() => onChange(r)}
            android_ripple={{ color: c.ripple }}
            style={{
              height: 48,
              paddingHorizontal: 12,
              justifyContent: 'center',
              borderBottomWidth: 2.5,
              borderBottomColor: selected ? c.green : 'transparent',
            }}
          >
            <Txt weight={selected ? 600 : 500} color={selected ? c.green : c.muted}>
              {r}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
