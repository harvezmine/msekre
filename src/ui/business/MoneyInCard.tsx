import { View } from 'react-native';
import type { Business } from '@/api/contract';
import { formatJam, formatRupiah } from '@/api/format';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '../Card';
import { Txt } from '../Txt';
import { sourceCaption } from './sources';

export function MoneyInCard({ data }: { data: Business }) {
  const { c } = useTheme();
  const rows = data.moneyIn;
  const caption = sourceCaption(data.sources, 'moneyIn');
  return (
    <Card style={{ paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <Txt v="subtitle">Uang masuk</Txt>
        {caption ? (
          <Txt v="caption" color={c.muted}>
            {caption}
          </Txt>
        ) : null}
      </View>
      {rows.map((r, i) => (
        <View
          key={r.id}
          style={{
            flexDirection: 'row',
            gap: 12,
            paddingVertical: 12,
            borderBottomWidth: i < rows.length - 1 ? 1 : 0,
            borderBottomColor: c.line,
          }}
        >
          <View style={{ flex: 1 }}>
            <Txt>{r.source}</Txt>
            <Txt v="caption" color={c.muted} tabular>
              {formatJam(r.at, data.tzOffsetMinutes)}
              {r.note ? ` · ${r.note}` : ''}
            </Txt>
          </View>
          <Txt weight={600} tabular>
            {formatRupiah(r.amount)}
          </Txt>
        </View>
      ))}
    </Card>
  );
}
