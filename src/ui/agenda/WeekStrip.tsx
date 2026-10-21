import { Pressable, View } from 'react-native';
import { addDays, dayLabel, parts, weekdayIndex } from '@/api/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { haptic } from '../kit/haptics';
import { Txt } from '../Txt';

/** Nama hari tiga huruf seperti di papan 17. */
const DAY3 = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const;

/** Tujuh hari mulai Senin pekan dari tanggal ini. */
export function weekDays(date: string): string[] {
  const monday = addDays(date, -weekdayIndex(date));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Deretan tujuh hari (papan 17): nama hari kecil, tanggal besar. Hari yang dipilih berisi lingkaran hijau, hari ini
 * (bila tidak dipilih) bertanggal hijau, hari yang punya agenda bertitik biru kecil. Ketuk memilih hari itu.
 */
export function WeekStrip({
  selected,
  today,
  marked,
  onSelect,
}: {
  selected: string;
  today: string;
  marked: ReadonlySet<string>;
  onSelect: (date: string) => void;
}) {
  const { c, marker } = useTheme();
  return (
    <View testID="deretan-hari" style={{ flexDirection: 'row', paddingHorizontal: 12 }}>
      {weekDays(selected).map((date, i) => {
        const isSel = date === selected;
        const isToday = date === today;
        const has = marked.has(date);
        return (
          <Pressable
            key={date}
            accessibilityRole="button"
            accessibilityLabel={`${dayLabel(date)}${isToday ? ', hari ini' : ''}${has ? ', ada agenda' : ''}`}
            accessibilityState={{ selected: isSel }}
            onPress={() => {
              if (isSel) return;
              haptic('selection');
              onSelect(date);
            }}
            style={{ flex: 1, minHeight: 88, alignItems: 'center', gap: 6, paddingTop: 2 }}
          >
            <Txt v="caption" color={c.muted} maxFontSizeMultiplier={1.2}>
              {DAY3[i]}
            </Txt>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isSel ? c.brand : 'transparent',
              }}
            >
              <Txt
                weight={600}
                tabular
                maxFontSizeMultiplier={1.2}
                color={isSel ? c.onBrand : isToday ? c.brandInk : c.text}
                style={{ fontSize: 18, lineHeight: 24 }}
              >
                {parts(date).d}
              </Txt>
            </View>
            <View
              testID={has ? `titik-hari-${parts(date).d}` : undefined}
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: has && !isSel ? marker.agenda.base : 'transparent',
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
