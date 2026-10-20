import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { NOW } from '@/sample/agenda';
import type { AgendaItem as Item } from '@/sample/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Txt } from '../Txt';

const TILE_ICON: Record<Item['kind'], IconName> = {
  reminder: 'bell',
  task: 'task',
  meeting: 'camera',
  recurring: 'bell',
};

/** Sudah lewat dibanding jam contoh. Hanya berlaku untuk hari ini. */
export function isPast(item: Item, today: string): boolean {
  return item.past ?? (item.date === today && item.time < NOW);
}

interface Props {
  item: Item;
  past?: boolean;
  onToggle?: (id: string) => void;
  /** Tahan sebuah pengingat untuk mencoba alarm-nya (prototipe). */
  onLongPress?: (id: string) => void;
}

/** Satu baris agenda seperti desain 2a: jam, tile ikon 40, judul, keterangan. */
export function AgendaItem({ item, past = false, onToggle, onLongPress }: Props) {
  const { c } = useTheme();
  const isTask = item.kind === 'task';
  const hasAlarm = item.kind === 'reminder' || item.kind === 'recurring';
  const icon: IconName = isTask && item.done ? 'taskDone' : TILE_ICON[item.kind];
  const dim = past || item.done === true;
  const notulen = item.kind === 'meeting' && item.note === 'Notulen siap';

  const sub = subtitle(item);
  const label = [item.time, item.title, sub.text, item.repeat].filter(Boolean).join('. ');

  return (
    <Pressable
      accessibilityRole={isTask ? 'checkbox' : 'button'}
      accessibilityLabel={label}
      accessibilityState={isTask ? { checked: item.done === true } : undefined}
      onPress={isTask ? () => onToggle?.(item.id) : undefined}
      onLongPress={hasAlarm && onLongPress ? () => onLongPress(item.id) : undefined}
      android_ripple={{ color: c.ripple }}
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 4,
        minHeight: 64,
        alignItems: 'flex-start',
        opacity: past ? 0.75 : 1,
      }}
    >
      <Txt weight={600} tabular color={past ? c.muted : c.ink} style={{ width: 48, lineHeight: 40 }}>
        {item.time}
      </Txt>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          backgroundColor: past ? c.line : c.mint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={22} color={past ? c.muted : c.green} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2, paddingTop: 8 }}>
        <Txt
          weight={500}
          color={dim && !past ? c.muted : c.ink}
          style={item.done ? { textDecorationLine: 'line-through' } : undefined}
        >
          {item.title}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 6 }}>
          {notulen ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Notulen siap"
              onPress={() => router.navigate('/chat')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 16 }}
            >
              <Txt v="caption" weight={600} color={c.green}>
                Notulen siap
              </Txt>
            </Pressable>
          ) : (
            <>
              {sub.icon ? <Icon name={sub.icon} size={14} color={c.muted} /> : null}
              {sub.text ? (
                <Txt v="caption" color={sub.warn ? c.green : c.muted}>
                  {sub.text}
                </Txt>
              ) : null}
            </>
          )}
          {item.repeat ? (
            <>
              {sub.text || notulen ? (
                <Txt v="caption" color={c.muted}>
                  ·
                </Txt>
              ) : null}
              <Icon name="repeat" size={14} color={c.muted} />
              <Txt v="caption" color={c.muted}>
                {item.repeat}
              </Txt>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function subtitle(item: Item): { text: string; icon?: IconName; warn?: boolean } {
  if (item.snoozedUntil) return { text: `Ditunda sampai ${item.snoozedUntil}`, warn: true };
  switch (item.kind) {
    case 'task':
      return { text: item.done ? 'Selesai' : 'Tugas' };
    case 'meeting':
      return { text: item.note ?? 'Rapat' };
    default:
      return item.way === 'call' ? { text: 'Telepon saya', icon: 'call' } : { text: 'Bunyi sebagai alarm' };
  }
}
