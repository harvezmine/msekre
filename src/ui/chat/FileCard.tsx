import { View } from 'react-native';
import type { MediaSource } from '@/api/transport';
import { useTheme } from '@/theme/ThemeProvider';
import { AccentIcon } from '../kit/AccentIcon';
import { Txt } from '../Txt';
import { CardButton, ChatCard } from './ChatCard';
import { useDocumentActions } from './useDocumentActions';

export interface FileInfo {
  mediaId: string;
  name: string;
  mime: string;
  meta: string;
  /** Ukuran berkas (byte): berkas yang sudah diunduh dengan ukuran sama dipakai lagi. */
  size?: number;
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
        <AccentIcon icon="file" tone="usaha" size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="row" weight={600}>
            {file.name}
          </Txt>
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
