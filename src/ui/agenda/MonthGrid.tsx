import { Modal, Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DAY_SHORT, daysInMonth, isoDate, MONTH_NAMES, parts, weekdayIndex } from '@/api/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { haptic } from '../kit/haptics';
import { Sheet, useSheet } from '../Sheet';
import { Txt } from '../Txt';

interface Props {
  /** "Hari ini" menurut server. */
  today: string;
  /** Tanggal terpilih; bulan yang tampil adalah bulannya. */
  selected: string;
  /** Tanggal yang punya agenda. */
  marked: ReadonlySet<string>;
  onSelect: (date: string) => void;
}

/** Kisi satu bulan, mulai Senin. Terpilih = lingkaran hijau, hari ini = tanggal hijau, titik biru = ada agenda. */
export function MonthGrid({ today, selected, marked, onSelect }: Props) {
  const { c, marker } = useTheme();
  const { y: YEAR, m: MONTH } = parts(selected);
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
    <View>
      <Txt v="section" style={{ paddingBottom: 8 }} accessibilityRole="header">
        {MONTH_NAME} {YEAR}
      </Txt>
      <View style={{ flexDirection: 'row' }}>
        {DAY_SHORT.map((d) => (
          <View key={d} style={{ flex: 1, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="caption" color={c.muted} maxFontSizeMultiplier={1.2}>
              {d}
            </Txt>
          </View>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((day, i) => {
            if (day === null) return <View key={i} style={{ flex: 1, height: 52 }} />;
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
                onPress={() => {
                  haptic('selection');
                  onSelect(date);
                }}
                android_ripple={{ color: c.ripple, borderless: true, radius: 24 }}
                style={{ flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' }}
              >
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
                    weight={isToday || isSel ? 600 : 500}
                    tabular
                    maxFontSizeMultiplier={1.2}
                    color={isSel ? c.onBrand : isToday ? c.brandInk : c.text}
                  >
                    {day}
                  </Txt>
                  {has && !isSel ? (
                    <View
                      testID={`titik-${day}`}
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: marker.agenda.base,
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

/** Kalender sebulan di lembar bawah: memilih tanggal menutup lembar lalu menampilkan hari itu. */
export function MonthSheet({ visible, onClose, onSelect, ...grid }: Props & { visible: boolean; onClose: () => void }) {
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {visible ? (
          <Sheet onClose={onClose} testID="lembar-kalender">
            <PickDay {...grid} onSelect={onSelect} />
          </Sheet>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

function PickDay({ onSelect, ...grid }: Props) {
  const { close } = useSheet();
  return <MonthGrid {...grid} onSelect={(date) => close(() => onSelect(date))} />;
}
