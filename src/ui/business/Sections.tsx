import { View } from 'react-native';
import { mimeOfName } from '@/api/business';
import type { Business, BusinessOrder, BusinessReport, BusinessStock } from '@/api/contract';
import { formatFileMeta, formatJam, formatRupiah } from '@/api/format';
import type { MediaSource } from '@/api/transport';
import { useTheme } from '@/theme/ThemeProvider';
import { CardButton } from '../chat/ChatCard';
import { useDocumentActions } from '../chat/useDocumentActions';
import { AccentIcon } from '../kit/AccentIcon';
import { SectionHeader } from '../kit/SectionHeader';
import { Txt } from '../Txt';
import { StockRow } from './Hero';
import { sourceCaption } from './sources';

const CHANNEL: Record<string, string> = { tiktok_shop: 'TikTok Shop', shopee: 'Shopee', tokopedia: 'Tokopedia' };
const STATUS: Record<string, string> = {
  perlu_dikirim: 'Perlu dikirim',
  dikirim: 'Dikirim',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};
const TO_SEND = 'perlu_dikirim';

/** "tiktok_shop" -> "TikTok Shop"; saluran atau status yang belum dikenal ditampilkan sebagai kata biasa. */
const words = (key: string) => key.replace(/_/g, ' ').replace(/^./, (ch) => ch.toUpperCase());
export const channelLabel = (key: string) => CHANNEL[key] ?? words(key);
export const orderStatusLabel = (key: string) => STATUS[key] ?? words(key);

/** Judul bagian dengan asal datanya kecil di kanan ("dari Moka"). */
function Head({ title, caption }: { title: string; caption?: string | null }) {
  return <SectionHeader title={title} value={caption ?? undefined} style={{ paddingHorizontal: 20 }} />;
}

/** Baris tanpa kotak: judul, satu keterangan kecil, angka di kanan. */
function MoneyRow({
  title,
  sub,
  amount,
  subColor,
  testID,
}: {
  title: string;
  sub?: string;
  amount: number;
  subColor?: string;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={[title, formatRupiah(amount), sub].filter(Boolean).join(', ')}
      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="row">{title}</Txt>
        {sub ? (
          <Txt v="caption" color={subColor ?? c.muted} tabular>
            {sub}
          </Txt>
        ) : null}
      </View>
      <Txt v="row" weight={600} tabular>
        {formatRupiah(amount)}
      </Txt>
    </View>
  );
}

export function MoneyInSection({ data }: { data: Business }) {
  if (data.moneyIn.length === 0) return null;
  return (
    <View>
      <Head title="Uang masuk" caption={sourceCaption(data.sources, 'moneyIn')} />
      {data.moneyIn.map((r) => (
        <MoneyRow
          key={r.id}
          title={r.source}
          sub={`${formatJam(r.at, data.tzOffsetMinutes)}${r.note ? ` · ${r.note}` : ''}`}
          amount={r.amount}
        />
      ))}
    </View>
  );
}

/** Pesanan marketplace per saluran: berapa yang perlu dikirim di judul, lalu pesanannya. */
export function OrdersSection({ orders }: { orders: BusinessOrder[] }) {
  const { marker } = useTheme();
  const channels = [...new Set(orders.map((o) => o.channel))];
  return (
    <>
      {channels.map((channel) => {
        const list = orders.filter((o) => o.channel === channel);
        const toSend = list.filter((o) => o.status === TO_SEND).length;
        const name = channelLabel(channel);
        return (
          <View key={channel}>
            <Head title={`${name}: ${toSend > 0 ? `${toSend} pesanan perlu dikirim` : `${list.length} pesanan`}`} />
            {list.map((o, i) => (
              <MoneyRow
                key={o.id}
                testID={`pesanan-${i}`}
                title={o.summary}
                sub={orderStatusLabel(o.status)}
                subColor={o.status === TO_SEND ? marker.warn.ink : undefined}
                amount={o.amount}
              />
            ))}
          </View>
        );
      })}
    </>
  );
}

/** Semua barang menipis, masing-masing dengan Pesan bila pemasoknya diketahui. Tidak ada yang terkirim tanpa setuju. */
export function StockSection({
  data,
  isBusy,
  onOrder,
  onSeeDraft,
}: {
  data: Business;
  isBusy: (stockId: string) => boolean;
  onOrder: (item: BusinessStock) => void;
  onSeeDraft: (item: BusinessStock) => void;
}) {
  if (data.lowStock.length === 0) return null;
  return (
    <View>
      <Head title="Stok menipis" caption={sourceCaption(data.sources, 'stock')} />
      <View style={{ paddingHorizontal: 20 }}>
        {data.lowStock.map((s) => (
          <StockRow key={s.id} item={s} busy={isBusy(s.id)} onOrder={onOrder} onSeeDraft={onSeeDraft} />
        ))}
      </View>
    </View>
  );
}

/** Laporan terakhir: Buka dan Bagikan memakai alur unduh dokumen yang sama dengan kartu berkas di chat. */
export function ReportSection({
  report,
  mediaUrl,
}: {
  report: BusinessReport;
  mediaUrl: (mediaId: string) => Promise<MediaSource>;
}) {
  const { c } = useTheme();
  const mime = mimeOfName(report.name);
  const { busy, open, share } = useDocumentActions(
    { mediaId: report.mediaId, name: report.name, mime, size: report.size },
    mediaUrl,
  );
  return (
    <View style={{ gap: 4 }}>
      <Head title="Laporan" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, minHeight: 64 }}>
        <AccentIcon icon="file" tone="usaha" size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="row" weight={600}>
            {report.name}
          </Txt>
          <Txt v="caption" color={c.muted}>
            {formatFileMeta(report.size, mime)}
            {report.period ? ` · ${report.period}` : ''}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 8 }}>
        <CardButton label={busy === 'open' ? 'Mengunduh…' : 'Buka'} disabled={busy !== null} onPress={open} />
        <CardButton label={busy === 'share' ? 'Mengunduh…' : 'Bagikan'} disabled={busy !== null} onPress={share} />
      </View>
    </View>
  );
}
