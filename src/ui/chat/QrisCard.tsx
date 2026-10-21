import { View } from 'react-native';
import { formatJam, formatRupiah } from '@/api/format';
import type { Card } from '@/api/contract';
import type { MediaSource } from '@/api/transport';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { ChatCard } from './ChatCard';
import { QrCode } from './QrCode';
import { MediaFailed, RemoteImage } from './RemoteImage';
import { useMedia } from './useMedia';

type Qris = Extract<Card, { kind: 'qris' }>;

/**
 * Kartu bayar QRIS. `menunggu`: kode dan batas bayar. `lunas`: tanda lunas. `kedaluwarsa`: kode dipudarkan. Gambar
 * lewat `mediaUrl` (`GET /media/:id` dengan token); server tiruan memberi pola QR contoh.
 */
export function QrisCard({ qris, mediaUrl }: { qris: Qris; mediaUrl: (mediaId: string) => Promise<MediaSource> }) {
  const { c } = useTheme();
  const { media, reload } = useMedia(mediaUrl, qris.mediaId);
  const paid = qris.status === 'lunas';
  const expired = qris.status === 'kedaluwarsa';
  return (
    <ChatCard style={{ alignItems: 'center' }}>
      <Txt weight={600} style={{ alignSelf: 'flex-start' }}>
        {paid ? 'Pembayaran QRIS' : 'Bayar dengan QRIS'}
      </Txt>
      {paid ? (
        <View
          testID="qris-lunas"
          style={{
            alignSelf: 'stretch',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            minHeight: 52,
            borderRadius: 20,
            backgroundColor: c.brandSoft,
            paddingHorizontal: 16,
          }}
        >
          <Icon name="check" size={22} color={c.brandInk} />
          <Txt weight={600} color={c.brandInk}>
            Sudah dibayar
          </Txt>
        </View>
      ) : expired ? (
        // Kode yang sudah tidak berlaku tidak ditampilkan sama sekali, supaya tidak terpindai.
        <View
          testID="qris-kedaluwarsa"
          accessible
          accessibilityLabel="QRIS kedaluwarsa"
          style={{
            width: 208,
            height: 208,
            borderRadius: 20,
            backgroundColor: c.sunken,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Icon name="x" size={32} color={c.muted} />
          <Txt weight={600} color={c.muted}>
            QRIS kedaluwarsa
          </Txt>
        </View>
      ) : media === 'error' ? (
        <MediaFailed onRetry={reload} style={{ width: 208, minHeight: 208, alignSelf: 'center' }} />
      ) : media !== null && media.kind === 'uri' ? (
        <View
          testID="qris-kode"
          accessible
          accessibilityLabel="Kode QRIS"
          style={{
            width: 208,
            height: 208,
            padding: 14,
            borderRadius: 16,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E9E7E1',
          }}
        >
          <RemoteImage
            uri={media.uri}
            headers={media.headers}
            label="Kode QRIS"
            style={{ width: '100%', height: '100%' }}
            reload={reload}
          />
        </View>
      ) : (
        <QrCode showCode={media !== null} />
      )}
      <Txt style={{ fontSize: 28, lineHeight: 36 }} weight={600} tabular>
        {formatRupiah(qris.amountRp)}
      </Txt>
      <Txt color={c.muted} style={{ textAlign: 'center' }}>
        {paid
          ? 'Terima kasih, pembayarannya sudah masuk.'
          : expired
            ? 'QRIS ini sudah kedaluwarsa. Minta saya buatkan yang baru.'
            : `Pindai dari aplikasi bank atau dompet digital. Berlaku sampai ${formatJam(qris.until)}.`}
      </Txt>
    </ChatCard>
  );
}
