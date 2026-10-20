import { View } from 'react-native';
import type { TokenInfo } from '@/sample/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { ChatCard } from './ChatCard';

/** Kartu pembelian token listrik yang menunggu "Sudah benar?". */
export function TokenCard({ token }: { token: TokenInfo }) {
  const { c } = useTheme();
  const rows: [string, string, boolean][] = [
    ['Nominal', token.amount, true],
    ['No. meter', token.meter, false],
    ['Atas nama', token.owner, false],
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
        <Txt weight={600}>{token.title}</Txt>
      </View>
      <View style={{ gap: 6 }}>
        {rows.map(([k, v, strong]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
            <Txt color={c.muted}>{k}</Txt>
            <Txt weight={strong ? 600 : undefined} tabular style={{ flexShrink: 1, textAlign: 'right' }}>
              {v}
            </Txt>
          </View>
        ))}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12 }}>
        <Txt color={c.muted}>Sudah benar?</Txt>
      </View>
    </ChatCard>
  );
}
