import type { AgendaItem } from '@/api/contract';
import { getPendingSnoozes, type PendingSnooze, type PendingSnoozes } from './pendingSnooze';
import type { SnoozeFn } from './snooze';
import { TEST_ALARM_ID } from './testAlarm';
import type { AlarmScheduler } from './types';

/** Alarm dijadwalkan di HP untuk 7 hari ke depan. */
export const ALARM_HORIZON_DAYS = 7;
export const ALARM_HORIZON_MS = ALARM_HORIZON_DAYS * 24 * 3600_000;

export interface DesiredAlarm {
  id: string;
  /** Milidetik epoch: `snoozedUntil` kalau ditunda, selain itu `at`. */
  at: number;
  title: string;
  note?: string;
}

/**
 * Pengingat yang harus berbunyi di HP: berjenis pengingat (atau berulang) dengan cara alarm, belum selesai, bukan
 * sepanjang hari, dan jatuh tempo (menurut tundaan) dalam 7 hari ke depan.
 */
export function desiredAlarms(items: AgendaItem[], nowMs: number, horizonMs = ALARM_HORIZON_MS): DesiredAlarm[] {
  const out: DesiredAlarm[] = [];
  for (const item of items) {
    if (item.way !== 'alarm' || item.done || item.allDay) continue;
    if (item.kind !== 'reminder' && item.kind !== 'recurring') continue;
    const at = Date.parse(item.snoozedUntil ?? item.at);
    if (Number.isNaN(at) || at <= nowMs || at > nowMs + horizonMs) continue;
    out.push({ id: item.id, at, title: item.title, ...(item.note ? { note: item.note } : {}) });
  }
  return out.sort((a, b) => a.at - b.at);
}

export type AckFn = (id: string, scheduledForIso: string) => Promise<boolean>;

interface SyncJob {
  items: AgendaItem[];
  ack: AckFn;
  snooze?: SnoozeFn;
}

/**
 * Menyamakan alarm di HP dengan agenda: setiap alarm yang seharusnya berbunyi DIJADWALKAN ULANG pada setiap penyamaan
 * (murah; daftar yang tersimpan bukan bukti alarmnya masih terpasang, karena penghemat baterai atau henti paksa bisa
 * menghapusnya), yang dihapus, selesai, atau lewat 7 hari dibatalkan, dan setiap alarm yang berhasil dijadwalkan dan akan
 * terdengar dikabarkan ke server (`alarm-ack`) sekali per id dan waktu (selama proses hidup), supaya server tidak
 * mengirim pengingat yang sama lewat WhatsApp. Alarm percobaan ({@link TEST_ALARM_ID}) tidak disentuh.
 *
 * Tunda yang belum sampai ke server (tanpa internet saat ditekan) tetap dijadwalkan di HP, tanpa tanda terima, dan
 * `PATCH`-nya diulang tiap penyamaan sampai berhasil.
 */
export class AlarmSync {
  private readonly acked = new Set<string>();
  private running: Promise<void> | null = null;
  private pending: SyncJob | null = null;

  constructor(
    private readonly scheduler: AlarmScheduler,
    private readonly now: () => number = Date.now,
    private readonly snoozes: PendingSnoozes = getPendingSnoozes(),
  ) {}

  /**
   * Samakan dengan `items`. Panggilan yang datang saat penyamaan sedang jalan digabung: setelah yang berjalan selesai,
   * hanya yang terakhir dijalankan lagi. Janjinya selesai saat keadaan terakhir itu sudah disamakan. `snooze` mengulang
   * tunda yang belum sampai ke server.
   */
  sync(items: AgendaItem[], ack: AckFn, snooze?: SnoozeFn): Promise<void> {
    if (this.running) {
      this.pending = { items, ack, snooze };
      return this.running;
    }
    const run = async () => {
      let job: SyncJob | null = { items, ack, snooze };
      while (job) {
        this.pending = null;
        await this.reconcile(job);
        job = this.pending;
      }
    };
    this.running = run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Keluar: semua alarm dibatalkan, tunda yang menunggu dibuang, dan tanda terima dilupakan. */
  async clear(): Promise<void> {
    this.pending = null;
    await this.running;
    this.acked.clear();
    await this.snoozes.clear();
    const current = await this.scheduler.list();
    for (const c of current) if (c.id !== TEST_ALARM_ID) await this.scheduler.cancel(c.id);
  }

  private async reconcile({ items, ack, snooze }: SyncJob) {
    const now = this.now();
    const desired = new Map(desiredAlarms(items, now).map((d) => [d.id, d]));
    // Tunda yang belum dikabarkan: tetap berbunyi pada waktunya, dan tanpa tanda terima sampai server tahu.
    const unsynced = new Map<string, PendingSnooze>();
    for (const p of await this.snoozes.list()) {
      const untilMs = Date.parse(p.until);
      const item = items.find((i) => i.id === p.id);
      const server = item?.snoozedUntil ? Date.parse(item.snoozedUntil) : Number.NaN;
      if (Number.isNaN(untilMs) || untilMs <= now || item?.done || server >= untilMs) {
        await this.snoozes.remove(p.id);
        continue;
      }
      unsynced.set(p.id, p);
      desired.set(p.id, { id: p.id, at: untilMs, title: item?.title ?? p.title, ...noteOf(item?.note ?? p.note) });
    }
    const current = new Map((await this.scheduler.list()).map((c) => [c.id, c]));
    for (const id of current.keys()) {
      if (id !== TEST_ALARM_ID && !desired.has(id)) await this.scheduler.cancel(id);
    }
    const audible = new Set<string>();
    for (const d of desired.values()) {
      if (!(await this.scheduler.schedule({ id: d.id, at: d.at, title: d.title, note: d.note }))) continue;
      audible.add(d.id);
      if (!unsynced.has(d.id)) await this.acknowledge(d, ack);
    }
    // Terakhir, setelah semua alarm terpasang: kabari server soal tunda yang tertunda.
    if (!snooze) return;
    for (const p of unsynced.values()) {
      const failed = await snooze(p.id, p.until);
      if (failed) continue;
      await this.snoozes.remove(p.id);
      const d = desired.get(p.id);
      if (d && audible.has(p.id)) await this.acknowledge(d, ack);
    }
  }

  private async acknowledge(d: DesiredAlarm, ack: AckFn) {
    const iso = new Date(d.at).toISOString();
    const key = `${d.id}@${iso}`;
    if (this.acked.has(key)) return;
    if (await ack(d.id, iso)) this.acked.add(key);
  }
}

const noteOf = (note: string | undefined) => (note ? { note } : {});
