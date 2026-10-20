import { useRef, useState } from 'react';
import { View } from 'react-native';
import { FILE_DOWNLOAD_TEXT, FILE_NO_APP_TEXT } from '@/api/errors';
import type { MediaSource } from '@/api/transport';
import { NoViewerError, openDocument, shareDocument, type LocalDocument } from '@/files/documents';
import { useSampleDispatch } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { CardButton, ChatCard } from './ChatCard';
import { useMediaDownload } from './useMedia';

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
  const dispatch = useSampleDispatch();
  const download = useMediaDownload(mediaUrl);
  const [busy, setBusy] = useState<'open' | 'share' | null>(null);
  const running = useRef(false);
  const run = async (kind: 'open' | 'share', action: (doc: LocalDocument) => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(kind);
    try {
      await action(await download(file.mediaId, file.name, file.mime));
    } catch (e) {
      dispatch({ type: 'showToast', text: e instanceof NoViewerError ? FILE_NO_APP_TEXT : FILE_DOWNLOAD_TEXT });
    } finally {
      running.current = false;
      setBusy(null);
    }
  };
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
        <CardButton
          label={busy === 'open' ? 'Mengunduh…' : 'Buka'}
          disabled={busy !== null}
          onPress={() => void run('open', openDocument)}
        />
        <CardButton
          label={busy === 'share' ? 'Mengunduh…' : 'Bagikan'}
          disabled={busy !== null}
          onPress={() => void run('share', shareDocument)}
        />
      </View>
    </ChatCard>
  );
}
