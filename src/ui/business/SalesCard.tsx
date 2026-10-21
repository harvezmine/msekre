import { View } from 'react-native';
import { changeText } from '@/api/business';
import type { Business, BusinessPeriod } from '@/api/contract';
import { formatRupiah } from '@/api/format';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '../Card';
import { Txt } from '../Txt';
import { Sparkline } from './Sparkline';
import { sparkRange } from './sparkMath';
import { sourceCaption } from './sources';

const TITLE: Record<BusinessPeriod, string> = {
  hari: 'Penjualan hari ini',
  minggu: 'Penjualan minggu ini',
  bulan: 'Penjualan bulan ini',
};
const CHART: Record<BusinessPeriod, string> = {
  hari: 'Grafik penjualan 7 hari terakhir',
  minggu: 'Grafik penjualan 4 minggu terakhir',
  bulan: 'Grafik penjualan 6 bulan terakhir',
};

export function SalesCard({ data }: { data: Business }) {
  const { c } = useTheme();
  const { sales, series, branches } = data;
  const values = series.map((p) => p.value);
  const { min, span } = sparkRange(values);
  const caption = sourceCaption(data.sources, 'moka');
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Txt v="subtitle">{TITLE[data.period]}</Txt>
        {caption ? (
          <Txt v="caption" color={c.muted}>
            {caption}
          </Txt>
        ) : null}
      </View>
      <View>
        <Txt weight={600} tabular style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.32 }}>
          {formatRupiah(sales.total)}
        </Txt>
        <Txt weight={500} color={sales.down ? c.clay : c.leafText}>
          {changeText(sales)}
        </Txt>
      </View>
      {series.length > 1 ? (
        <View style={{ gap: 4 }}>
          <Sparkline series={values} min={min} span={span} label={CHART[data.period]} />
          <View style={{ flexDirection: 'row' }}>
            {series.map((p, i) => {
              const now = i === series.length - 1;
              return (
                <Txt
                  key={`${p.label}-${i}`}
                  v="caption"
                  weight={now ? 600 : 500}
                  color={now ? c.leafText : c.muted}
                  style={{ flex: 1, textAlign: 'center' }}
                >
                  {p.label}
                </Txt>
              );
            })}
          </View>
        </View>
      ) : null}
      {branches.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12 }}>
          {branches.map((b) => (
            <View key={b.place} style={{ flex: 1 }}>
              <Txt v="caption" color={c.muted}>
                {b.name}
              </Txt>
              <Txt v="subtitle" tabular>
                {formatRupiah(b.total)}
              </Txt>
              {b.status ? (
                <Txt v="caption" color={c.muted}>
                  {b.status}
                </Txt>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
