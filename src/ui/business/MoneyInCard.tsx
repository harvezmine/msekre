import { View } from 'react-native';
import type { MoneyIn } from '@/sample/business';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '../Card';
import { Txt } from '../Txt';

export function MoneyInCard({ rows }: { rows: MoneyIn[] }) {
  const { c } = useTheme();
  return (
    <Card style={{ paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <Txt v="subtitle">Uang masuk</Txt>
        <Txt v="caption" color={c.muted}>
          dari BCA
        </Txt>
      </View>
      {rows.map((r, i) => (
        <View
          key={`${r.time}-${r.title}`}
          style={{
            flexDirection: 'row',
            gap: 12,
            paddingVertical: 12,
            borderBottomWidth: i < rows.length - 1 ? 1 : 0,
            borderBottomColor: c.line,
          }}
        >
          <View style={{ flex: 1 }}>
            <Txt>{r.title}</Txt>
            <Txt v="caption" color={c.muted} tabular>
              {r.time}
            </Txt>
          </View>
          <Txt weight={600} tabular>
            {r.amount}
          </Txt>
        </View>
      ))}
    </Card>
  );
}
