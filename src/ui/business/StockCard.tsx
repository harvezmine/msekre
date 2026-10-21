import { Pressable, View } from 'react-native';
import { stockLeft } from '@/api/business';
import type { Business, BusinessStock } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '../Card';
import { Txt } from '../Txt';
import { sourceCaption } from './sources';

interface Props {
  data: Business;
  /** Barang yang pesanannya sedang dibuat. */
  isBusy: (stockId: string) => boolean;
  onOrder: (item: BusinessStock) => void;
  onSeeDraft: (item: BusinessStock) => void;
}

export function StockCard({ data, isBusy, onOrder, onSeeDraft }: Props) {
  const { c } = useTheme();
  const items = data.lowStock;
  const caption = sourceCaption(data.sources, 'moka');
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Txt v="subtitle">Stok menipis</Txt>
        {caption ? (
          <Txt v="caption" color={c.muted}>
            {caption}
          </Txt>
        ) : null}
      </View>
      <View style={{ backgroundColor: c.clayBg, borderRadius: 16, paddingVertical: 4, paddingHorizontal: 16 }}>
        {items.map((s, i) => (
          <View
            key={s.id}
            style={{
              gap: 8,
              paddingVertical: 10,
              borderBottomWidth: i < items.length - 1 ? 1 : 0,
              borderBottomColor: c.stockLine,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt>{s.name}</Txt>
              <Txt weight={600} color={c.clay} tabular>
                {stockLeft(s)}
              </Txt>
            </View>
            {s.supplier ? <StockAction item={s} busy={isBusy(s.id)} onOrder={onOrder} onSeeDraft={onSeeDraft} /> : null}
          </View>
        ))}
      </View>
      <Txt v="caption" color={c.muted}>
        Saya buatkan draf pesanan ke supplier. Tidak ada yang terkirim sebelum Anda setuju.
      </Txt>
    </Card>
  );
}

function StockAction({
  item,
  busy,
  onOrder,
  onSeeDraft,
}: {
  item: BusinessStock;
  busy: boolean;
  onOrder: (item: BusinessStock) => void;
  onSeeDraft: (item: BusinessStock) => void;
}) {
  const { c } = useTheme();
  const open = item.reorderDraftId !== undefined;
  const label = open ? 'Lihat draf' : busy ? 'Membuat draf…' : 'Pesan lagi';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${item.name}`}
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={() => (open ? onSeeDraft(item) : onOrder(item))}
      android_ripple={{ color: c.ripple }}
      style={{
        opacity: busy ? 0.5 : 1,
        height: 48,
        borderRadius: 24,
        backgroundColor: open ? c.card : c.green,
        borderWidth: open ? 1 : 0,
        borderColor: c.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt weight={600} color={open ? c.ink : c.onGreen}>
        {label}
      </Txt>
    </Pressable>
  );
}
