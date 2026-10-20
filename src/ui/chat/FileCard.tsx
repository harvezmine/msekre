import { View } from 'react-native';
import type { FileInfo } from '@/sample/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { CardButton, ChatCard } from './ChatCard';

/** Kartu berkas hasil kerja: nama, ukuran, tombol Buka dan Bagikan. */
export function FileCard({ file, onOpen, onShare }: { file: FileInfo; onOpen?: () => void; onShare?: () => void }) {
  const { c } = useTheme();
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
        <CardButton label="Buka" onPress={onOpen ?? (() => {})} />
        <CardButton label="Bagikan" onPress={onShare ?? (() => {})} />
      </View>
    </ChatCard>
  );
}
