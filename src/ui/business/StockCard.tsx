import { Pressable, View } from 'react-native';
import type { LowStock } from '@/sample/business';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '../Card';
import { Txt } from '../Txt';

export function StockCard({ items, onOrder }: { items: LowStock[]; onOrder: () => void }) {
  const { c } = useTheme();
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Txt v="subtitle">Stok menipis</Txt>
        <Txt v="caption" color={c.muted}>
          dari Moka
        </Txt>
      </View>
      <View style={{ backgroundColor: c.clayBg, borderRadius: 16, paddingVertical: 4, paddingHorizontal: 16 }}>
        {items.map((s, i) => (
          <View
            key={s.item}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 10,
              borderBottomWidth: i < items.length - 1 ? 1 : 0,
              borderBottomColor: c.line,
            }}
          >
            <Txt>{s.item}</Txt>
            <Txt weight={600} color={c.clay} tabular>
              {s.left}
            </Txt>
          </View>
        ))}
      </View>
      <Txt v="caption" color={c.muted}>
        Saya buatkan draf pesanan ke supplier. Tidak ada yang terkirim sebelum Anda setuju.
      </Txt>
      <Pressable
        accessibilityRole="button"
        onPress={onOrder}
        android_ripple={{ color: c.ripple }}
        style={{
          height: 52,
          borderRadius: 26,
          backgroundColor: c.green,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt weight={600} color={c.onGreen}>
          Pesan lagi
        </Txt>
      </Pressable>
    </Card>
  );
}
