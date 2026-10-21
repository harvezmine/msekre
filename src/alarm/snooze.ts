import type { AgendaItem } from '@/api/contract';
import { getPendingSnoozes, type PendingSnoozes } from './pendingSnooze';
import type { AlarmScheduler } from './types';

/** Berapa menit "Tunda" menunda alarm. */
export const SNOOZE_MINUTES = 10;
const SNOOZE_MS = SNOOZE_MINUTES * 60_000;

/** Kabari server (`PATCH /agenda/:id`): `null` kalau berhasil, selain itu teks ramah. */
export type SnoozeFn = (id: string, untilIso: string) => Promise<string | null>;

type Snoozable = Pick<AgendaItem, 'id' | 'title' | 'at' | 'snoozedUntil' | 'note'>;

/**
 * Kapan alarm berbunyi lagi: 10 menit dari yang lebih akhir antara jadwal sekarang (tundaan sebelumnya atau waktu
 * semula) dan saat ini. Ditunda telat (alarm berbunyi 07.00, ditekan 07.25) berarti 07.35, bukan 07.10 yang sudah lewat;
 * menunda berkali-kali terus maju.
 */
export function snoozeTarget(item: Pick<AgendaItem, 'at' | 'snoozedUntil'>, now: number): number {
  const base = Date.parse(item.snoozedUntil ?? item.at);
  return Math.max(Number.isNaN(base) ? now : base, now) + SNOOZE_MS;
}

export interface SnoozeResult {
  /** Saat alarm berbunyi lagi (milidetik epoch). */
  at: number;
  /** Alarm tundaan terjadwal dan akan terdengar di HP. */
  armed: boolean;
  /** Selesai saat server sudah tahu (`true`) atau belum (`false`: diulang pada penyamaan alarm berikutnya). */
  synced: Promise<boolean>;
}

/**
 * Tunda alarm: pasang dulu di HP (tanpa menunggu internet), catat sebagai tunda yang belum dikabarkan, lalu kabari server.
 * Server gagal dijangkau: alarm di HP tetap berbunyi pada waktunya, tidak ada tanda terima, dan `PATCH` diulang pada
 * penyamaan alarm berikutnya. Dikembalikan segera setelah alarm terpasang; `synced` menyusul.
 */
export async function snoozeAlarm({
  scheduler,
  item,
  snooze,
  now = Date.now(),
  pending = getPendingSnoozes(),
}: {
  scheduler: AlarmScheduler;
  item: Snoozable;
  /** `null`: tanpa server (belum masuk), jadi hanya dipasang di HP dan tidak ada yang perlu dikabarkan. */
  snooze: SnoozeFn | null;
  now?: number;
  pending?: PendingSnoozes;
}): Promise<SnoozeResult> {
  const at = snoozeTarget(item, now);
  const until = new Date(at).toISOString();
  // Yang sedang berbunyi dimatikan dulu (notifikasi dan catatan berbunyinya), lalu tundaannya dipasang.
  await scheduler.cancel(item.id);
  const armed = await scheduler.schedule({ id: item.id, at, title: item.title, note: item.note });
  if (!snooze) return { at, armed, synced: Promise.resolve(true) };
  await pending.put({ id: item.id, until, title: item.title, ...(item.note ? { note: item.note } : {}) });
  const synced = snooze(item.id, until).then(async (failed) => {
    if (failed) return false;
    await pending.remove(item.id);
    return true;
  });
  return { at, armed, synced };
}
