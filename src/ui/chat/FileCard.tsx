import { View } from 'react-native';
import { useSampleDispatch } from '@/sample/store';
import type { FileInfo } from '@/sample/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { CardButton, ChatCard } from './ChatCard';

/** Kartu berkas hasil kerja: nama, ukuran, tombol Buka dan Bagikan (contoh: keduanya hanya menampilkan toast). */
export function FileCard({ file, onOpen, onShare }: { file: FileInfo; onOpen?: () => void; onShare?: () => void }) {
  const { c } = useTheme();
  const dispatch = useSampleDispatch();
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
          label="Buka"
          onPress={onOpen ?? (() => dispatch({ type: 'showToast', text: 'Membuka berkas contoh.' }))}
        />
        <CardButton
          label="Bagikan"
          onPress={onShare ?? (() => dispatch({ type: 'showToast', text: 'Berbagi berkas dibangun di Fase 1.' }))}
        />
      </View>
    </ChatCard>
  );
}
