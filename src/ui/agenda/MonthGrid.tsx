import { Pressable, View } from 'react-native';
import { DAY_SHORT, daysInMonth, isoDate, MONTH_NAMES, parts, weekdayIndex } from '@/api/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';

interface Props {
  /** "Hari ini" menurut server; bulan yang tampil adalah bulannya. */
  today: string;
  selected: string;
  /** Tanggal yang punya agenda. */
  marked: ReadonlySet<string>;
  onSelect: (date: string) => void;
}

/** Kisi bulan ini, mulai Senin. Titik hijau = ada agenda, lingkaran mint = hari ini. */
export function MonthGrid({ today, selected, marked, onSelect }: Props) {
  const { c } = useTheme();
  const { y: YEAR, m: MONTH } = parts(today);
  const MONTH_NAME = MONTH_NAMES[MONTH - 1];
  const total = daysInMonth(YEAR, MONTH);
  const offset = weekdayIndex(isoDate(YEAR, MONTH, 1));
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 16,
        padding: 8,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.card,
      }}
    >
      <Txt v="subtitle" style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }} accessibilityRole="header">
        {MONTH_NAME} {YEAR}
      </Txt>
      <View style={{ flexDirection: 'row' }}>
        {DAY_SHORT.map((d) => (
          <View key={d} style={{ flex: 1, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="caption" color={c.muted}>
              {d}
            </Txt>
          </View>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((day, i) => {
            if (day === null) return <View key={i} style={{ flex: 1, height: 48 }} />;
            const date = isoDate(YEAR, MONTH, day);
            const isToday = date === today;
            const isSel = date === selected;
            const has = marked.has(date);
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`${day} ${MONTH_NAME}${isToday ? ', hari ini' : ''}${has ? ', ada agenda' : ''}`}
                accessibilityState={{ selected: isSel }}
                onPress={() => onSelect(date)}
                android_ripple={{ color: c.ripple, borderless: true, radius: 24 }}
                style={{ flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isToday ? c.mint : 'transparent',
                    borderWidth: isSel ? 1.5 : 0,
                    borderColor: c.green,
                  }}
                >
                  <Txt weight={isToday || isSel ? 600 : 500} tabular color={isToday ? c.green : c.ink}>
                    {day}
                  </Txt>
                  {has ? (
                    <View
                      testID={`titik-${day}`}
                      style={{
                        position: 'absolute',
                        bottom: 3,
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: c.green,
                      }}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
