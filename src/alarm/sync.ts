import type { AgendaItem } from '@/api/contract';
import { TEST_ALARM_ID } from './testAlarm';
import type { AlarmScheduler } from './types';

/** Alarm dijadwalkan di HP untuk 7 hari ke depan. */
export const ALARM_HORIZON_MS = 7 * 24 * 3600_000;

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

/**
 * Menyamakan alarm di HP dengan agenda: yang baru atau berubah dijadwalkan, yang dihapus, selesai, atau lewat 7 hari
 * dibatalkan, dan setiap alarm yang berhasil dijadwalkan dikabarkan ke server (`alarm-ack`) sekali per id dan waktu
 * (selama proses hidup), supaya server tidak mengirim pengingat yang sama lewat WhatsApp. Alarm percobaan
 * ({@link TEST_ALARM_ID}) tidak disentuh.
 */
export class AlarmSync {
  private readonly acked = new Set<string>();
  private running: Promise<void> | null = null;
  private pending: { items: AgendaItem[]; ack: AckFn } | null = null;

  constructor(
    private readonly scheduler: AlarmScheduler,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Samakan dengan `items`. Panggilan yang datang saat penyamaan sedang jalan digabung: setelah yang berjalan selesai,
   * hanya yang terakhir dijalankan lagi. Janjinya selesai saat keadaan terakhir itu sudah disamakan.
   */
  sync(items: AgendaItem[], ack: AckFn): Promise<void> {
    if (this.running) {
      this.pending = { items, ack };
      return this.running;
    }
    const run = async () => {
      let job: { items: AgendaItem[]; ack: AckFn } | null = { items, ack };
      while (job) {
        this.pending = null;
        await this.reconcile(job.items, job.ack);
        job = this.pending;
      }
    };
    this.running = run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Keluar: semua alarm dibatalkan dan tanda terima dilupakan. */
  async clear(): Promise<void> {
    this.pending = null;
    await this.running;
    this.acked.clear();
    const current = await this.scheduler.list();
    for (const c of current) if (c.id !== TEST_ALARM_ID) await this.scheduler.cancel(c.id);
  }

  private async reconcile(items: AgendaItem[], ack: AckFn) {
    const desired = new Map(desiredAlarms(items, this.now()).map((d) => [d.id, d]));
    const current = new Map((await this.scheduler.list()).map((c) => [c.id, c]));
    for (const id of current.keys()) {
      if (id !== TEST_ALARM_ID && !desired.has(id)) await this.scheduler.cancel(id);
    }
    for (const d of desired.values()) {
      const have = current.get(d.id);
      const same = have && have.at === d.at && have.title === d.title && (have.note ?? '') === (d.note ?? '');
      const ok = same ? true : await this.scheduler.schedule({ id: d.id, at: d.at, title: d.title, note: d.note });
      if (!ok) continue;
      const iso = new Date(d.at).toISOString();
      const key = `${d.id}@${iso}`;
      if (this.acked.has(key)) continue;
      if (await ack(d.id, iso)) this.acked.add(key);
    }
  }
}
