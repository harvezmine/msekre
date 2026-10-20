import { View } from 'react-native';
import { TODAY } from '@/sample/agenda';
import { addDays, dayLabel } from '@/sample/dates';
import type { AgendaItem as Item } from '@/sample/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';
import { AgendaItem, isPast } from './AgendaItem';

export interface ItemHandlers {
  onToggle: (id: string) => void;
  onLongPress: (id: string) => void;
}

/** Tujuh hari mulai Senin pekan ini (di data contoh hari ini adalah Senin). */
export const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i));

const FREE_LINE = 'Longgar, belum ada rencana.';

interface Props extends ItemHandlers {
  itemsOn: (date: string) => Item[];
}

/** Segmen Minggu ini: tiap hari punya judul dan daftar item yang sama dengan Hari ini. */
export function WeekList({ itemsOn, onToggle, onLongPress }: Props) {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 96 }}>
      {WEEK_DAYS.map((date) => {
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
              {date === TODAY ? (
                <Txt v="caption" color={c.green} weight={600}>
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
                  past={isPast(item, TODAY)}
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
