import { View } from 'react-native';
import { addDays, dayLabel, weekdayIndex } from '@/api/dates';
import type { AgendaItem as Item } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';
import { AgendaItem, isPast } from './AgendaItem';

export interface ItemHandlers {
  onToggle: (id: string) => void;
  onLongPress: (id: string) => void;
}

/** Tujuh hari mulai Senin pekan dari tanggal ini. */
export function weekDays(today: string): string[] {
  const monday = addDays(today, -weekdayIndex(today));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const FREE_LINE = 'Longgar, belum ada rencana.';

interface Props extends ItemHandlers {
  today: string;
  now: string;
  tzOffsetMinutes?: number | null;
  itemsOn: (date: string) => Item[];
}

/** Segmen Minggu ini: tiap hari punya judul dan daftar item yang sama dengan Hari ini. */
export function WeekList({ today, now, tzOffsetMinutes, itemsOn, onToggle, onLongPress }: Props) {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 96 }}>
      {weekDays(today).map((date) => {
        const items = itemsOn(date);
        return (
          <View key={date} style={{ paddingTop: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                paddingHorizontal: 4,
              }}
            >
              <Txt v="subtitle" accessibilityRole="header">
                {dayLabel(date)}
              </Txt>
              {date === today ? (
                <Txt v="caption" color={c.brandInk} weight={600}>
                  Hari ini
                </Txt>
              ) : null}
            </View>
            {items.length === 0 ? (
              <Txt color={c.muted} style={{ paddingHorizontal: 4, paddingVertical: 12 }}>
                {FREE_LINE}
              </Txt>
            ) : (
              items.map((item) => (
                <AgendaItem
                  key={item.id}
                  item={item}
                  past={isPast(item, today, now)}
                  tzOffsetMinutes={tzOffsetMinutes}
                  onToggle={onToggle}
                  onLongPress={onLongPress}
                />
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}
