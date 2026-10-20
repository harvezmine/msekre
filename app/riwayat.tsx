import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { HISTORY_FILTERS } from '@/sample/history';
import { historyRows, useSample, type HistoryRow } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { FilterChips } from '@/ui/FilterChips';
import { Icon } from '@/ui/Icon';
import { Txt } from '@/ui/Txt';

const LABELS = HISTORY_FILTERS.map((f) => f.label);
const DAYS = ['Hari ini', 'Kemarin'] as const;

// Riwayat (desain 2m): yang sudah dikerjakan Nadia, per hari, dengan Batalkan untuk kiriman yang masih tertahan.
export default function Riwayat() {
  const { c } = useTheme();
  const { state, dispatch } = useSample();
  const [label, setLabel] = useState(LABELS[0]!);
  const kind = HISTORY_FILTERS.find((f) => f.label === label)?.kind;
  const rows = historyRows(state, kind);

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <BackHeader title="Riwayat" />
      <View style={{ paddingBottom: 8 }}>
        <FilterChips options={LABELS} value={label} onChange={setLabel} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}>
        {rows.length === 0 ? (
          <Txt color={c.muted} style={{ paddingTop: 24 }}>
            Belum ada yang dikerjakan di sini. Nanti muncul begitu Nadia mulai bekerja.
          </Txt>
        ) : null}
        {DAYS.map((day) => {
          const list = rows.filter((r) => r.day === day);
          if (!list.length) return null;
          return (
            <View key={day}>
              <Txt weight={600} style={{ fontSize: 15, lineHeight: 20, paddingTop: 8, paddingBottom: 12 }}>
                {day}
              </Txt>
              {list.map((r, i) => (
                <Entry
                  key={r.id}
                  row={r}
                  last={i === list.length - 1}
                  onCancel={() => r.outgoingId && dispatch({ type: 'cancelSend', id: r.outgoingId })}
                />
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Entry({ row, last, onCancel }: { row: HistoryRow; last: boolean; onCancel: () => void }) {
  const { c } = useTheme();
  const muted = row.struck;
  const strike = row.struck ? ({ textDecorationLine: 'line-through' } as const) : null;
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.mint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={row.icon} size={20} color={c.green} />
        </View>
        {last ? null : <View style={{ flex: 1, width: 1.5, backgroundColor: c.line }} />}
      </View>
      <View style={{ flex: 1, gap: 2, paddingTop: 8, paddingBottom: 20 }}>
        <Txt weight={500} color={muted ? c.muted : c.ink} style={strike}>
          {row.title}
        </Txt>
        <Txt v="caption" color={c.muted} style={strike}>
          {row.sub}
        </Txt>
        {row.sent ? (
          <Txt v="caption" weight={600} color={c.leafText}>
            Terkirim
          </Txt>
        ) : null}
        {row.undoable ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Batalkan"
              onPress={onCancel}
              android_ripple={{ color: c.ripple }}
              style={{
                height: 48,
                paddingHorizontal: 16,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: c.line,
                backgroundColor: c.card,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="undo" size={18} />
              <Txt weight={600} style={{ fontSize: 15 }}>
                Batalkan
              </Txt>
            </Pressable>
            {row.until ? (
              <Txt v="caption" color={c.muted}>
                sampai {row.until}
              </Txt>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
