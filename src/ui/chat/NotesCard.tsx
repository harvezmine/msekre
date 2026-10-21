import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { AccentIcon } from '../kit/AccentIcon';
import { Txt } from '../Txt';
import { ChatCard } from './ChatCard';
import { useToast } from '@/ui/toastStore';

export interface NotesInfo {
  title: string;
  when: string;
  decisions: string[];
}

/** Kartu notulen rapat: tiga keputusan dan tautan Baca notulen (layar notulen menyusul di tugas lain). */
export function NotesCard({ notes, onOpen }: { notes: NotesInfo; onOpen?: () => void }) {
  const { c, marker } = useTheme();
  const toast = useToast();
  return (
    <ChatCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AccentIcon icon="note" tone="agenda" size={44} />
        <View style={{ flex: 1 }}>
          <Txt v="row" weight={600}>
            {notes.title}
          </Txt>
          <Txt v="caption" color={c.muted} tabular>
            {notes.when}
          </Txt>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        {notes.decisions.map((d, i) => (
          <View key={d} style={{ flexDirection: 'row', gap: 10 }}>
            <Txt weight={600} color={marker.agenda.ink} style={{ width: 16 }}>
              {i + 1}
            </Txt>
            <Txt style={{ flex: 1 }}>{d}</Txt>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Baca notulen"
        onPress={onOpen ?? (() => toast('Notulen lengkap segera hadir.'))}
        hitSlop={{ top: 4, bottom: 4 }}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        <Txt weight={600} color={c.brandInk}>
          Baca notulen
        </Txt>
        <Icon name="chevR" size={18} color={c.brandInk} />
      </Pressable>
    </ChatCard>
  );
}
