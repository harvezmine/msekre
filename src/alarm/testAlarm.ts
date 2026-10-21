import type { AgendaItem } from '@/api/contract';

/** Id alarm percobaan dari layar izin alarm: tidak ada di agenda, hanya ada di HP ini. */
export const TEST_ALARM_ID = 'uji';
/** Berapa lama sampai alarm percobaan berbunyi. */
export const TEST_ALARM_DELAY_MS = 60_000;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Item untuk layar alarm dari catatan di HP sendiri (alarm percobaan, atau alarm berbunyi yang item agendanya tidak bisa
 * dimuat), dengan jam dinding HP.
 */
export function localAlarmItem(alarm: { id: string; at: number; title: string; note?: string }): AgendaItem {
  const d = new Date(alarm.at);
  return {
    id: alarm.id,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}.${pad(d.getMinutes())}`,
    at: d.toISOString(),
    title: alarm.title,
    kind: 'reminder',
    way: 'alarm',
    ...(alarm.note ? { note: alarm.note } : {}),
  };
}

/** Item untuk layar alarm dari alarm percobaan, dengan jam dinding HP. */
export function testAlarmItem(atMs: number): AgendaItem {
  return localAlarmItem({
    id: TEST_ALARM_ID,
    at: atMs,
    title: 'Alarm percobaan',
    note: 'Kalau Anda melihat ini, alarm di HP ini sudah bekerja.',
  });
}
