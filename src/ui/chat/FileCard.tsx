import { View } from 'react-native';
import type { MediaSource } from '@/api/transport';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { CardButton, ChatCard } from './ChatCard';
import { useDocumentActions } from './useDocumentActions';

export interface FileInfo {
  mediaId: string;
  name: string;
  mime: string;
  meta: string;
}

/**
 * Kartu berkas hasil kerja: nama, ukuran, tombol Buka dan Bagikan. Keduanya mengunduh berkasnya dulu ke HP (selagi itu,
 * tombolnya sibuk), lalu Buka membukanya di aplikasi bawaan HP dan Bagikan membuka lembar bagikan. Gagal memunculkan
 * toast ramah.
 */
export function FileCard({ file, mediaUrl }: { file: FileInfo; mediaUrl: (mediaId: string) => Promise<MediaSource> }) {
  const { c } = useTheme();
  const { busy, open, share } = useDocumentActions(file, mediaUrl);
  return (
    <ChatCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 48,
            borderRadius: 12,
            backgroundColor: c.mint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="file" size={22} color={c.green} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight={600}>{file.name}</Txt>
          <Txt v="caption" color={c.muted}>
            {file.meta}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <CardButton label={busy === 'open' ? 'Mengunduh…' : 'Buka'} disabled={busy !== null} onPress={open} />
        <CardButton label={busy === 'share' ? 'Mengunduh…' : 'Bagikan'} disabled={busy !== null} onPress={share} />
      </View>
    </ChatCard>
  );
}
