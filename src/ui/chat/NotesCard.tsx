import { Pressable, View } from 'react-native';
import type { NotesInfo } from '@/sample/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { ChatCard } from './ChatCard';

/** Kartu notulen rapat: tiga keputusan dan tautan Baca notulen (layar notulen menyusul di tugas lain). */
export function NotesCard({ notes, onOpen }: { notes: NotesInfo; onOpen?: () => void }) {
  const { c } = useTheme();
  return (
    <ChatCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: c.mint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="note" size={22} color={c.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight={600}>{notes.title}</Txt>
          <Txt v="caption" color={c.muted} tabular>
            {notes.when}
          </Txt>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        {notes.decisions.map((d, i) => (
          <View key={d} style={{ flexDirection: 'row', gap: 10 }}>
            <Txt weight={600} color={c.green} style={{ width: 16 }}>
              {i + 1}
            </Txt>
            <Txt style={{ flex: 1 }}>{d}</Txt>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Baca notulen"
        onPress={onOpen}
        style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        <Txt weight={600} color={c.green}>
          Baca notulen
        </Txt>
        <Icon name="chevR" size={18} color={c.green} />
      </Pressable>
    </ChatCard>
  );
}
