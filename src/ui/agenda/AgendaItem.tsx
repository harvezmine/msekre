import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { AgendaItem as Item } from '@/api/contract';
import { formatJam } from '@/api/format';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import type { TimeItem } from '../kit/TimeRail';
import { Txt } from '../Txt';

/** Ikon tiap jenis item (pratinjau di lembar Tambah). */
export const KIND_ICON: Record<Item['kind'], IconName> = {
  reminder: 'bell',
  task: 'task',
  meeting: 'camera',
  recurring: 'bell',
};

/** Sudah lewat dibanding jam sekarang (dari server). Hanya berlaku untuk hari ini dan item yang punya jam. */
export function isPast(item: Item, today: string, now: string): boolean {
  return !item.allDay && item.date === today && item.time < now;
}

/** Ikon kanan di rel waktu (papan 17): telepon, alarm/notifikasi, rapat, atau notulen yang sudah siap. */
export function railIcon(item: Item): IconName {
  if (item.kind === 'meeting') return item.notesMessageId !== undefined ? 'note' : 'camera';
  if (item.way === 'call') return 'call';
  return 'bell';
}

/** "Ditunda sampai 16.10" memakai zona waktu pengguna dari server, bukan zona HP. */
export function snoozedText(item: Item, tz?: number | null): string | null {
  return item.snoozedUntil ? `Ditunda sampai ${formatJam(item.snoozedUntil, tz)}` : null;
}

/**
 * Keterangan butir: cara diingatkan, tempat rapat, ulangan. Tidak tampil di rel (sedikit tulisan); dibacakan pembaca
 * layar dan muncul satu baris saat butirnya diketuk.
 */
export function detailWords(item: Item): string[] {
  const out: string[] = [];
  switch (item.kind) {
    case 'task':
      out.push(item.done ? 'Selesai' : 'Tugas');
      break;
    case 'meeting':
      out.push(item.note ?? 'Rapat');
      if (item.notesMessageId !== undefined) out.push('Notulen siap');
      break;
    default:
      // Tanpa `way`, pengingat dibaca notifikasi biasa (kontrak): hanya yang `alarm` yang membunyikan alarm di HP.
      out.push(
        item.way === 'call' ? 'Telepon saya' : item.way === 'alarm' ? 'Bunyi sebagai alarm' : 'Lewat notifikasi',
      );
  }
  if (item.repeat) out.push(item.repeat);
  return [...new Set(out)];
}

/** Kotak centang besar (28, area sentuh seluruh baris): kosong bergaris, selesai = isian hijau dengan centang. */
export function TaskCheck({ checked }: { checked: boolean }) {
  const { c } = useTheme();
  return (
    <View
      testID={checked ? 'centang-selesai' : 'centang-kosong'}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        borderWidth: checked ? 0 : 2,
        borderColor: c.muted,
        backgroundColor: checked ? c.brand : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <Icon name="check" size={20} color={c.onBrand} strokeWidth={2.5} /> : null}
    </View>
  );
}

/** Ikon notulen yang sudah siap: tautan ke chat (notulennya dikirim di sana). */
function NotesLink() {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Notulen siap"
      onPress={() => router.navigate('/chat')}
      hitSlop={8}
      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -8 }}
    >
      <Icon name="note" size={24} color={c.brandInk} />
    </Pressable>
  );
}

interface RailOptions {
  past: boolean;
  next: boolean;
  /** Butir yang sedang dibuka (keterangannya tampil). */
  open: boolean;
  tz?: number | null;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  /** Tahan sebuah pengingat untuk melihat pratinjau layar alarm-nya (alarm aslinya tidak berubah). */
  onLongPress: (id: string) => void;
}

/** Satu butir agenda sebagai butir rel waktu: jam, judul 2–3 kata, dan satu ikon (tugas: kotak centang besar). */
export function railItem(item: Item, o: RailOptions, color: { muted: string; brandInk: string }): TimeItem {
  const isTask = item.kind === 'task';
  const hasAlarm = item.kind === 'reminder' || item.kind === 'recurring';
  const time = item.allDay ? 'Seharian' : item.time;
  const snoozed = snoozedText(item, o.tz);
  const words = detailWords(item);
  const shown = o.open && !isTask ? words.filter((w) => w !== 'Notulen siap').join(' · ') : '';
  const detail = snoozed ?? (shown || null);
  return {
    id: item.id,
    time,
    timeWord: item.allDay === true,
    title: item.title,
    state: o.past ? 'past' : o.next ? 'next' : 'upcoming',
    accessibilityLabel: [time, item.title, snoozed, ...words].filter(Boolean).join('. '),
    checked: isTask ? item.done === true : undefined,
    done: isTask && item.done === true,
    icon: railIcon(item),
    trailing: isTask ? (
      <TaskCheck checked={item.done === true} />
    ) : item.kind === 'meeting' && item.notesMessageId !== undefined ? (
      <NotesLink />
    ) : undefined,
    detail: detail ? (
      <Txt v="caption" color={snoozed ? color.brandInk : color.muted} numberOfLines={2}>
        {detail}
      </Txt>
    ) : undefined,
    onPress: isTask ? () => o.onToggle(item.id) : () => o.onOpen(item.id),
    onLongPress: hasAlarm ? () => o.onLongPress(item.id) : undefined,
  };
}
