import { View } from 'react-native';
import { changeText, stockLeft } from '@/api/business';
import type { Business, BusinessBranch, BusinessPeriod, BusinessStock } from '@/api/contract';
import { formatRupiah, formatRupiahRingkas } from '@/api/format';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { AccentIcon } from '../kit/AccentIcon';
import { AreaChart } from '../kit/Chart';
import { PressableScale } from '../kit/PressableScale';
import { Txt } from '../Txt';

export const PERIOD_TITLE: Record<BusinessPeriod, string> = {
  hari: 'Penjualan hari ini',
  minggu: 'Penjualan minggu ini',
  bulan: 'Penjualan bulan ini',
};
const CHART: Record<BusinessPeriod, string> = {
  hari: 'Grafik penjualan 7 hari terakhir',
  minggu: 'Grafik penjualan 4 minggu terakhir',
  bulan: 'Grafik penjualan 6 bulan terakhir',
};

/**
 * Pusat perhatian Usaha (papan 18): angka besar ringkas ("Rp 4,25 jt") dengan perubahan kecil di sampingnya (panah dan
 * persen; hijau naik, koral turun), lalu grafik area ungu yang halus. Angka lengkap dan kalimat perubahannya dibacakan.
 */
export function SalesHero({ data, chartHeight }: { data: Business; chartHeight: number }) {
  const { c, marker } = useTheme();
  const { sales, series } = data;
  const tone = sales.down ? marker.warn.ink : c.brandInk;
  const pct = `${String(sales.change).replace('.', ',')}%`;
  return (
    <View style={{ gap: 12 }}>
      <View
        accessible
        accessibilityLabel={`${PERIOD_TITLE[data.period]} ${formatRupiah(sales.total)}, ${changeText(sales)}`}
        style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 14, paddingHorizontal: 20 }}
      >
        <Txt v="figure" tabular numberOfLines={1} adjustsFontSizeToFit>
          {formatRupiahRingkas(sales.total)}
        </Txt>
        <View testID="perubahan" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 6 }}>
          <Icon name={sales.down ? 'trendDn' : 'trendUp'} size={20} color={tone} />
          <Txt v="section" weight={600} tabular color={tone}>
            {pct}
          </Txt>
        </View>
      </View>
      {series.length > 1 ? (
        <AreaChart
          values={series.map((p) => p.value)}
          height={chartHeight}
          accessibilityLabel={CHART[data.period]}
          style={{ marginHorizontal: 12 }}
        />
      ) : null}
    </View>
  );
}

/** Cabang (hanya di "Semua"): titik ungu (yang kedua lebih muda), nama, angka ringkas di kanan. */
export function BranchRows({ branches }: { branches: BusinessBranch[] }) {
  const { c, marker } = useTheme();
  if (branches.length === 0) return null;
  return (
    <View style={{ paddingHorizontal: 20 }}>
      {branches.map((b, i) => (
        <View
          key={b.place}
          accessible
          accessibilityLabel={`${b.name}, ${formatRupiah(b.total)}${b.status ? `, ${b.status}` : ''}`}
          style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 16 }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: marker.usaha.base,
              opacity: i === 0 ? 1 : 0.4,
            }}
          />
          <Txt v="row" numberOfLines={1} style={{ flex: 1, fontSize: 18, lineHeight: 24 }}>
            {b.name}
          </Txt>
          <Txt
            v="row"
            weight={600}
            tabular
            color={b.status ? c.muted : c.text}
            style={{ fontSize: 18, lineHeight: 24 }}
          >
            {b.status ?? formatRupiahRingkas(b.total)}
          </Txt>
        </View>
      ))}
    </View>
  );
}

/** Barang menipis yang paling perlu: yang punya pemasok dulu (bisa dipesan lagi), lalu urutan dari server. */
export function firstLowStock(items: BusinessStock[]): BusinessStock | null {
  return items.find((s) => s.supplier) ?? items[0] ?? null;
}

/** Tombol pesan barang: Pesan (hijau lembut), Lihat draf bila drafnya masih terbuka, redup selagi dibuat. */
export function OrderButton({
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
  const name = open ? 'Lihat draf' : busy ? 'Membuat draf…' : 'Pesan lagi';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${name} ${item.name}`}
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      haptic="light"
      onPress={() => (open ? onSeeDraft(item) : onOrder(item))}
      style={{
        opacity: busy ? 0.5 : 1,
        minHeight: 48,
        paddingHorizontal: 22,
        borderRadius: 24,
        backgroundColor: open ? c.sunken : c.brandSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt v="label" color={open ? c.text : c.brandInk} style={{ fontSize: 16 }}>
        {open ? 'Lihat draf' : 'Pesan'}
      </Txt>
    </PressableScale>
  );
}

/** Satu baris stok menipis (papan 18): ikon koral di lingkaran netral, nama, "Tinggal 2 kg", tombol Pesan. */
export function StockRow({
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
  return (
    <View testID={`stok-${item.id}`} style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <AccentIcon icon="box" tone="warn" size={48} />
      <View accessible style={{ flex: 1, minWidth: 0 }}>
        <Txt v="row" weight={600} numberOfLines={1} style={{ fontSize: 18, lineHeight: 24 }}>
          {item.name}
        </Txt>
        <Txt v="caption" color={c.muted} tabular style={{ fontSize: 15, lineHeight: 20 }}>
          Tinggal {stockLeft(item)}
        </Txt>
      </View>
      {item.supplier ? <OrderButton item={item} busy={busy} onOrder={onOrder} onSeeDraft={onSeeDraft} /> : null}
    </View>
  );
}
