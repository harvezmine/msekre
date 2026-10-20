import { useState } from 'react';
import { Image, Pressable, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';

/** Gambar belum bisa dimuat (jaringan, atau berkasnya hilang): kotak kecil dengan tombol coba lagi. */
export function MediaFailed({ onRetry, style }: { onRetry: () => void; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View
      testID="gambar-gagal"
      style={[
        {
          alignSelf: 'stretch',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          minHeight: 120,
          borderRadius: 12,
          backgroundColor: c.mint,
          padding: 12,
        },
        style,
      ]}
    >
      <Icon name="camera" size={28} color={c.green} />
      <Txt color={c.muted} style={{ textAlign: 'center' }}>
        Gambar belum bisa dimuat.
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Coba muat ulang gambar"
        onPress={onRetry}
        style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 }}
      >
        <Txt weight={600} color={c.green}>
          Coba muat lagi
        </Txt>
      </Pressable>
    </View>
  );
}

/**
 * Gambar dari server dengan token di header. Kalau gambarnya gagal diunduh, tampil {@link MediaFailed}; "Coba muat
 * lagi" mengambil alamat dan token terbaru (`reload`) lalu memuat gambarnya lagi.
 */
export function RemoteImage({
  uri,
  headers,
  label,
  style,
  resizeMode = 'contain',
  reload,
  failedStyle,
}: {
  uri: string;
  headers: Record<string, string>;
  label: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: 'contain' | 'cover';
  reload: () => void;
  failedStyle?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed) {
    return (
      <MediaFailed
        style={failedStyle}
        onRetry={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
          reload();
        }}
      />
    );
  }
  return (
    <Image
      key={attempt}
      source={{ uri, headers }}
      accessibilityLabel={label}
      style={style}
      resizeMode={resizeMode}
      onError={() => setFailed(true)}
    />
  );
}
