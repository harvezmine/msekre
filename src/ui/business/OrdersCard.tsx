import { View } from 'react-native';
import type { BusinessOrder } from '@/api/contract';
import { formatRupiah } from '@/api/format';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '../Card';
import { Icon } from '../Icon';
import { Txt } from '../Txt';

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

/** Pesanan marketplace, dikelompokkan per saluran: berapa yang perlu dikirim, lalu daftar pesanannya. */
export function OrdersCard({ orders }: { orders: BusinessOrder[] }) {
  const { c } = useTheme();
  const channels = [...new Set(orders.map((o) => o.channel))];
  return (
    <>
      {channels.map((channel) => {
        const list = orders.filter((o) => o.channel === channel);
        const toSend = list.filter((o) => o.status === TO_SEND).length;
        const name = channelLabel(channel);
        return (
          <Card key={channel} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: c.mint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="bag" size={22} color={c.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight={500}>
                  {name}: {toSend > 0 ? `${toSend} pesanan perlu dikirim` : `${list.length} pesanan`}
                </Txt>
                <Txt v="caption" color={c.muted}>
                  dari {name}
                </Txt>
              </View>
            </View>
            {list.map((o, i) => (
              <View
                key={o.id}
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: c.line,
                }}
                accessibilityLabel={`${o.summary}, ${formatRupiah(o.amount)}, ${orderStatusLabel(o.status)}`}
                accessible
                testID={`pesanan-${i}`}
              >
                <View style={{ flex: 1 }}>
                  <Txt>{o.summary}</Txt>
                  <Txt v="caption" color={o.status === TO_SEND ? c.clay : c.muted}>
                    {orderStatusLabel(o.status)}
                  </Txt>
                </View>
                <Txt weight={600} tabular>
                  {formatRupiah(o.amount)}
                </Txt>
              </View>
            ))}
          </Card>
        );
      })}
    </>
  );
}
