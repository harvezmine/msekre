import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { QrisInfo } from '@/sample/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';
import { ChatCard } from './ChatCard';
import { QR_SIZE, qrCells } from './qrPattern';

// Satu jalur untuk seluruh sel (sedikit tumpang tindih 1,02 supaya tak ada celah), bukan ratusan simpul.
const QR_PATH = qrCells()
  .map(({ x, y }) => `M${x} ${y}h1.02v1.02h-1.02z`)
  .join('');

/** Kartu bayar QRIS dengan pola QR contoh (bukan kode sungguhan). Kotak putih tetap putih di mode gelap supaya terpindai. */
export function QrisCard({ qris }: { qris: QrisInfo }) {
  const { c } = useTheme();
  return (
    <ChatCard style={{ alignItems: 'center' }}>
      <Txt weight={600} style={{ alignSelf: 'flex-start' }}>
        Bayar dengan QRIS
      </Txt>
      <View
        testID="qris-kode"
        accessible
        accessibilityLabel="Kode QRIS contoh"
        style={{
          width: 208,
          height: 208,
          padding: 14,
          borderRadius: 16,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E2E6DE',
        }}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} fill="#0D2B22">
          <Path d={QR_PATH} />
        </Svg>
      </View>
      <Txt style={{ fontSize: 28, lineHeight: 36 }} weight={600} tabular>
        {qris.amount}
      </Txt>
      <Txt color={c.muted} style={{ textAlign: 'center' }}>
        Pindai dari aplikasi bank atau dompet digital. Berlaku sampai {qris.until}.
      </Txt>
    </ChatCard>
  );
}
