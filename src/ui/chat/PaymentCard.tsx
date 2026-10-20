import { View } from 'react-native';
import { formatRupiah } from '@/api/format';
import type { Card } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { ChatCard } from './ChatCard';

type Payment = Extract<Card, { kind: 'payment' }>;

/** Kartu pembayaran yang menunggu jawaban (contoh: pembelian token listrik, "Sudah benar?"). */
export function PaymentCard({ payment }: { payment: Payment }) {
  const { c } = useTheme();
  const rows: [string, string, boolean][] = [
    ['Nominal', formatRupiah(payment.amountRp), true],
    ...payment.lines.map((l): [string, string, boolean] => [l.label, l.value, false]),
  ];
  return (
    <ChatCard>
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
          <Icon name="bolt" size={22} color={c.green} />
        </View>
        <Txt weight={600}>{payment.title}</Txt>
      </View>
      <View style={{ gap: 6 }}>
        {rows.map(([k, v, strong], i) => (
          <View key={`${i}:${k}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
            <Txt color={c.muted}>{k}</Txt>
            <Txt weight={strong ? 600 : undefined} tabular style={{ flexShrink: 1, textAlign: 'right' }}>
              {v}
            </Txt>
          </View>
        ))}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12 }}>
        <Txt color={c.muted}>{payment.ask}</Txt>
      </View>
    </ChatCard>
  );
}
