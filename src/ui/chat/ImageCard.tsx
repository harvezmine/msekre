import { Image, View } from 'react-native';
import type { Part } from '@/api/contract';
import type { MediaSource } from '@/api/transport';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { ChatCard } from './ChatCard';
import { QrCode } from './QrCode';
import { useMedia } from './useMedia';

type ImagePart = Extract<Part, { type: 'image' }>;

/** Gambar di utas, diambil lewat `GET /media/:id` dengan token. Server tiruan memberi pola QR contoh atau kotak kosong. */
export function ImageCard({
  image,
  mediaUrl,
}: {
  image: ImagePart;
  mediaUrl: (mediaId: string) => Promise<MediaSource>;
}) {
  const { c } = useTheme();
  const media = useMedia(mediaUrl, image.mediaId);
  const label = image.alt ?? image.caption ?? 'Gambar';
  return (
    <ChatCard style={{ alignItems: 'center' }}>
      {media !== null && media !== 'error' && media.kind === 'uri' ? (
        <Image
          source={{ uri: media.uri, headers: media.headers }}
          accessibilityLabel={label}
          style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }}
          resizeMode="contain"
        />
      ) : media !== null && media !== 'error' && media.kind === 'sampleQr' ? (
        <QrCode testID="gambar-contoh" label={label} />
      ) : (
        <View
          testID="gambar-kosong"
          accessible
          accessibilityLabel={label}
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: 12,
            backgroundColor: c.mint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="camera" size={32} color={c.green} />
        </View>
      )}
      {image.caption ? (
        <Txt color={c.muted} style={{ alignSelf: 'flex-start' }}>
          {image.caption}
        </Txt>
      ) : null}
    </ChatCard>
  );
}
