import { View } from 'react-native';
import type { Part } from '@/api/contract';
import type { MediaSource } from '@/api/transport';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { ChatCard } from './ChatCard';
import { QrCode } from './QrCode';
import { MediaFailed, RemoteImage } from './RemoteImage';
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
  const { media, reload } = useMedia(mediaUrl, image.mediaId);
  const label = image.alt ?? image.caption ?? 'Gambar';
  return (
    <ChatCard style={{ alignItems: 'center' }}>
      {media === 'error' ? (
        <MediaFailed onRetry={reload} />
      ) : media !== null && media.kind === 'uri' ? (
        <RemoteImage
          uri={media.uri}
          headers={media.headers}
          label={label}
          style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }}
          reload={reload}
        />
      ) : media !== null && media.kind === 'sampleQr' ? (
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
            backgroundColor: c.sunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="camera" size={32} color={c.text} />
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
