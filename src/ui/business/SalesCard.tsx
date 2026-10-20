import { View } from 'react-native';
import { SPARK_DAYS, type PlaceSales } from '@/sample/business';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '../Card';
import { Txt } from '../Txt';
import { Sparkline } from './Sparkline';

export function SalesCard({ data }: { data: PlaceSales }) {
  const { c } = useTheme();
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Txt v="subtitle">Penjualan hari ini</Txt>
        <Txt v="caption" color={c.muted}>
          dari Moka
        </Txt>
      </View>
      <View>
        <Txt weight={600} tabular style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.32 }}>
          {data.sales}
        </Txt>
        <Txt weight={500} color={data.down ? c.clay : c.leafText}>
          {data.change}
        </Txt>
      </View>
      <View style={{ gap: 4 }}>
        <Sparkline series={data.series} min={data.min} span={data.span} />
        <View style={{ flexDirection: 'row' }}>
          {SPARK_DAYS.map((d, i) => {
            const today = i === SPARK_DAYS.length - 1;
            return (
              <Txt
                key={d}
                v="caption"
                weight={today ? 600 : 500}
                color={today ? c.leafText : c.muted}
                style={{ flex: 1, textAlign: 'center' }}
              >
                {d}
              </Txt>
            );
          })}
        </View>
      </View>
      {data.split ? (
        <View style={{ flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12 }}>
          {data.split.map((s) => (
            <View key={s.name} style={{ flex: 1 }}>
              <Txt v="caption" color={c.muted}>
                {s.name}
              </Txt>
              <Txt v="subtitle" tabular>
                {s.sales}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
