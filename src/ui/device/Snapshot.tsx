import { useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { MediaSource } from '@/api/transport';
import { RemoteImage } from '../chat/RemoteImage';
import { useMedia } from '../chat/useMedia';
import { Icon } from '../Icon';

/**
 * Gambar terakhir kamera (`state.snapshotMediaId`, `GET /media/:id`). Server tiruan tidak punya berkas: digambar ruang
 * tamu contoh yang redup (sofa, jendela). Selagi diambil atau gagal: permukaan gelap dengan ikon kamera.
 */
export function Snapshot({
  mediaId,
  mediaUrl,
  label,
  style,
}: {
  mediaId: string;
  mediaUrl: (id: string) => Promise<MediaSource>;
  /** Untuk pembaca layar, contoh "Gambar terakhir Kamera teras". */
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { media, reload } = useMedia(mediaUrl, mediaId);
  return (
    <View testID="gambar-kamera" style={[{ overflow: 'hidden', backgroundColor: '#20252B' }, style]}>
      {media !== null && media !== 'error' && media.kind === 'uri' ? (
        <RemoteImage
          uri={media.uri}
          headers={media.headers}
          label={label}
          resizeMode="cover"
          style={{ width: '100%', height: '100%' }}
          failedStyle={{ flex: 1, borderRadius: 0 }}
          reload={reload}
        />
      ) : media !== null && media !== 'error' && media.kind === 'sampleSnapshot' ? (
        <SampleRoom label={label} />
      ) : (
        <View accessible accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera" size={32} color="rgba(255,255,255,0.6)" />
        </View>
      )}
    </View>
  );
}

/** Ruang tamu contoh (papan 16): dinding gelap, jendela empat kaca, sofa, bayangan lantai. */
function SampleRoom({ label }: { label: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ flex: 1 }}>
      <Svg width="100%" height="100%" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={`dinding${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#3A4048" />
            <Stop offset="1" stopColor="#1B1F24" />
          </LinearGradient>
          <LinearGradient id={`sofa${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#6B5A4E" />
            <Stop offset="1" stopColor="#4A3E36" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={200} height={150} fill={`url(#dinding${uid})`} />
        <Rect x={128} y={16} width={56} height={60} rx={3} fill="#8E98A4" opacity={0.75} />
        <Rect x={154.5} y={16} width={3} height={60} fill="#2A2F35" />
        <Rect x={128} y={44.5} width={56} height={3} fill="#2A2F35" />
        <Ellipse cx={150} cy={134} rx={40} ry={6} fill="#000000" opacity={0.35} />
        <Rect x={6} y={70} width={110} height={44} rx={14} fill={`url(#sofa${uid})`} />
        <Rect x={4} y={62} width={20} height={56} rx={10} fill="#5E4F45" />
        <Rect x={100} y={62} width={20} height={56} rx={10} fill="#5E4F45" />
        <Rect x={0} y={118} width={200} height={32} fill="#16191D" opacity={0.6} />
      </Svg>
    </View>
  );
}
