import { Image, View } from 'react-native';
import { formatJam, formatRupiah } from '@/api/format';
import type { Card } from '@/api/contract';
import type { MediaSource } from '@/api/transport';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { ChatCard } from './ChatCard';
import { QrCode } from './QrCode';
import { useMedia } from './useMedia';

type Qris = Extract<Card, { kind: 'qris' }>;

/**
 * Kartu bayar QRIS. `menunggu`: kode dan batas bayar. `lunas`: tanda lunas. `kedaluwarsa`: kode dipudarkan. Gambar
 * lewat `mediaUrl` (`GET /media/:id` dengan token); server tiruan memberi pola QR contoh.
 */
export function QrisCard({ qris, mediaUrl }: { qris: Qris; mediaUrl: (mediaId: string) => Promise<MediaSource> }) {
  const { c } = useTheme();
  const media = useMedia(mediaUrl, qris.mediaId);
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
            minHeight: 48,
            borderRadius: 16,
            backgroundColor: c.mint,
            paddingHorizontal: 16,
          }}
        >
          <Icon name="check" size={22} color={c.leafText} />
          <Txt weight={600} color={c.leafText}>
            Sudah dibayar
          </Txt>
        </View>
      ) : media !== null && media !== 'error' && media.kind === 'uri' ? (
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
            borderColor: '#E2E6DE',
            opacity: expired ? 0.25 : 1,
          }}
        >
          <Image
            source={{ uri: media.uri, headers: media.headers }}
            accessibilityLabel="Kode QRIS"
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
          />
        </View>
      ) : (
        <QrCode showCode={media !== null && media !== 'error'} faded={expired} />
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
