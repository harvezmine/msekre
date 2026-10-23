import type { AgendaItem } from '@/api/contract';
import { formatJam } from '@/api/format';
import { snoozeTarget, SNOOZE_MINUTES } from '@/alarm/snooze';
import { ALARM_HORIZON_MS } from '@/alarm/sync';
import { getPendingReminderActions, type PendingReminderAction, type PendingReminderActions } from './pending';
import type { ReminderNotifier, ReminderPermission } from './types';

/** Catatan di badan notifikasi dipotong supaya tetap satu baris yang tenang. */
const NOTE_MAX = 60;

export interface DesiredReminder {
  id: string;
  /** Milidetik epoch: tundaan kalau ditunda, selain itu `at`. */
  at: number;
  title: string;
  body: string;
  date: string;
}

/**
 * Item yang diingatkan HP lewat notifikasi lokal: pengingat, rutin, atau tugas yang punya jam, BUKAN cara alarm (itu
 * alarm layar penuh) dan bukan telepon (server yang menelepon), belum selesai, dan jatuh tempo (menurut tundaan) dalam 7
 * hari ke depan. Rapat diurus server (catatan rapat), tidak di sini.
 */
export function remindable(item: AgendaItem): boolean {
  if (item.way === 'alarm' || item.way === 'call' || item.done || item.allDay) return false;
  return item.kind === 'reminder' || item.kind === 'recurring' || item.kind === 'task';
}

/** Badan notifikasi: jam (menurut zona pengguna kalau ditunda) dan catatan pendek. "07.00 · Terminal 3". */
export function reminderBody(item: Pick<AgendaItem, 'time' | 'note' | 'snoozedUntil'>, tz?: number | null): string {
  const time = item.snoozedUntil ? formatJam(item.snoozedUntil, tz) : item.time;
  const note = item.note?.trim();
  if (!note) return time;
  const short = note.length > NOTE_MAX ? `${note.slice(0, NOTE_MAX - 1).trimEnd()}…` : note;
  return `${time} · ${short}`;
}

export function desiredReminders(
  items: AgendaItem[],
  nowMs: number,
  tz?: number | null,
  horizonMs = ALARM_HORIZON_MS,
): DesiredReminder[] {
  const out: DesiredReminder[] = [];
  for (const item of items) {
    if (!remindable(item)) continue;
    const at = Date.parse(item.snoozedUntil ?? item.at);
    if (Number.isNaN(at) || at <= nowMs || at > nowMs + horizonMs) continue;
    out.push({ id: item.id, at, title: item.title, body: reminderBody(item, tz), date: item.date });
  }
  return out.sort((a, b) => a.at - b.at);
}

export type AckFn = (id: string, scheduledForIso: string) => Promise<boolean>;
/** Kabari server satu tombol pengingat: `ok` (sampai), `drop` (itemnya sudah tidak ada), `retry` (coba lagi nanti). */
export type FlushFn = (action: PendingReminderAction) => Promise<'ok' | 'drop' | 'retry'>;

export interface ReminderJob {
  items: AgendaItem[];
  /** Zona waktu pengguna (menit), untuk jam tundaan di badan notifikasi. */
  tz?: number | null;
  /** Rentang tanggal yang sudah dimuat: notifikasi yang tampil untuk item yang hilang dari rentang ini dibuang. */
  ranges?: { from: string; to: string }[];
  vibrate: boolean;
  ack: AckFn;
  flush?: FlushFn;
}

/**
 * Menyamakan notifikasi pengingat lokal dengan agenda, seperti `AlarmSync` untuk alarm: setiap penyamaan menjadwalkan
 * ulang semua pengingat 7 hari ke depan (murah; menggantikan yang berid sama), membatalkan yang selesai, dihapus, atau
 * lewat, membuang notifikasi yang masih tampil untuk item yang sudah selesai atau dihapus, dan mengabarkan server
 * (`alarm-ack`) sekali per id dan waktu supaya pengingat yang sama tidak dikirim lagi lewat WhatsApp. Tanpa izin
 * notifikasi (atau saluran dimatikan): tidak ada yang dijadwalkan dan tidak ada tanda terima, jadi WhatsApp tetap jalan.
 *
 * Tombol notifikasi yang belum sampai ke server ({@link PendingReminderActions}) diulang di akhir setiap penyamaan.
 */
export class ReminderSync {
  private readonly acked = new Set<string>();
  private running: Promise<void> | null = null;
  private pending: ReminderJob | null = null;
  private ready = false;
  /** Izin pada penyamaan terakhir (`null` sebelum yang pertama). */
  lastPermission: ReminderPermission | null = null;

  constructor(
    private readonly notifier: ReminderNotifier,
    private readonly now: () => number = Date.now,
    private readonly actions: PendingReminderActions = getPendingReminderActions(),
  ) {}

  /** Samakan dengan `job`. Panggilan yang datang selagi berjalan digabung: yang terakhir dijalankan sekali sesudahnya. */
  sync(job: ReminderJob): Promise<void> {
    if (this.running) {
      this.pending = job;
      return this.running;
    }
    const run = async () => {
      let next: ReminderJob | null = job;
      while (next) {
        this.pending = null;
        await this.reconcile(next);
        next = this.pending;
      }
    };
    this.running = run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Keluar atau ganti mode data: semua pengingat dibatalkan, tombol yang menunggu dibuang, tanda terima dilupakan. */
  async clear(): Promise<void> {
    this.pending = null;
    await this.running;
    this.acked.clear();
    await this.actions.clear();
    if (!this.notifier.available) return;
    for (const s of await this.notifier.scheduled()) await this.notifier.cancel(s.id);
    for (const p of await this.notifier.presented()) await this.notifier.dismiss(p.id);
  }

  private async reconcile({ items, tz, ranges, vibrate, ack, flush }: ReminderJob) {
    if (!this.notifier.available) return;
    if (!this.ready) {
      await this.notifier.setup();
      this.ready = true;
    }
    const now = this.now();
    const permission = await this.notifier.permission();
    this.lastPermission = permission;
    const allowed = permission === 'granted';
    const byId = new Map(items.map((i) => [i.id, i]));
    const desired = new Map(desiredReminders(items, now, tz).map((d) => [d.id, d]));

    // Tombol yang belum sampai ke server: "Selesai" tidak dijadwalkan lagi; tundaan tetap pada waktunya.
    const waiting = new Map<string, PendingReminderAction>();
    for (const a of await this.actions.list()) {
      const item = byId.get(a.id);
      if (a.kind === 'done') {
        if (item?.done) {
          await this.actions.remove(a.id, a);
          continue;
        }
        desired.delete(a.id);
        waiting.set(a.id, a);
        continue;
      }
      const until = Date.parse(a.until ?? '');
      const server = item?.snoozedUntil ? Date.parse(item.snoozedUntil) : Number.NaN;
      if (Number.isNaN(until) || until <= now || item?.done || server >= until) {
        await this.actions.remove(a.id, a);
        continue;
      }
      waiting.set(a.id, a);
      desired.set(a.id, {
        id: a.id,
        at: until,
        title: item?.title ?? a.title,
        body: item ? reminderBody({ ...item, snoozedUntil: a.until }, tz) : a.body,
        date: item?.date ?? a.date,
      });
    }

    for (const s of await this.notifier.scheduled()) {
      if (!allowed || !desired.has(s.id)) await this.notifier.cancel(s.id);
    }
    // Notifikasi yang masih tampil untuk item yang sudah selesai, atau hilang dari rentang yang dimuat (dihapus).
    for (const p of await this.notifier.presented()) {
      const item = byId.get(p.id);
      const loaded = p.date !== null && (ranges ?? []).some((r) => r.from <= p.date! && p.date! <= r.to);
      if (item?.done || waiting.get(p.id)?.kind === 'done' || (!item && loaded)) await this.notifier.dismiss(p.id);
    }

    const scheduled = new Set<string>();
    if (allowed) {
      for (const d of desired.values()) {
        if (!(await this.notifier.schedule({ ...d, vibrate }))) continue;
        scheduled.add(d.id);
        if (!waiting.has(d.id)) await this.acknowledge(d, ack);
      }
    }

    if (!flush) return;
    for (const a of waiting.values()) {
      const result = await flush(a);
      if (result === 'retry') continue;
      await this.actions.remove(a.id, a);
      const d = desired.get(a.id);
      if (result === 'ok' && d && scheduled.has(a.id)) await this.acknowledge(d, ack);
    }
  }

  private async acknowledge(d: DesiredReminder, ack: AckFn) {
    const iso = new Date(d.at).toISOString();
    const key = `${d.id}@${iso}`;
    if (this.acked.has(key)) return;
    if (await ack(d.id, iso)) this.acked.add(key);
  }
}

/** Isi notifikasi yang ditekan: cukup untuk menjalankan tombolnya tanpa agenda dimuat. */
export interface ReminderTarget {
  id: string;
  title: string;
  body: string;
  date: string;
  /** Saat notifikasi itu dijadwalkan berbunyi (ISO 8601). */
  at: string;
}

/**
 * "Selesai" dari notifikasi: notifikasinya hilang dan tidak dijadwalkan lagi, lalu dicatat untuk dikabarkan ke server
 * (penyamaan berikutnya mengirim `PATCH done`). Tidak butuh internet atau sesi.
 */
export async function reminderDone(
  notifier: ReminderNotifier,
  target: ReminderTarget,
  actions: PendingReminderActions = getPendingReminderActions(),
): Promise<void> {
  await notifier.cancel(target.id);
  await actions.put({ id: target.id, kind: 'done', title: target.title, body: target.body, date: target.date });
}

/**
 * "Tunda 10 menit" dari notifikasi: notifikasinya hilang, pengingat dijadwalkan lagi di HP 10 menit dari yang lebih akhir
 * antara saat berbunyi dan sekarang (tanpa menunggu internet), lalu dicatat untuk `PATCH snoozeUntil`. Hasilnya saat
 * pengingat muncul lagi (milidetik epoch).
 */
export async function reminderSnooze(
  notifier: ReminderNotifier,
  target: ReminderTarget,
  {
    vibrate,
    tz,
    now = Date.now(),
    actions = getPendingReminderActions(),
  }: { vibrate: boolean; tz?: number | null; now?: number; actions?: PendingReminderActions },
): Promise<number> {
  const at = snoozeTarget({ at: target.at }, now, SNOOZE_MINUTES);
  const until = new Date(at).toISOString();
  const note = target.body.includes(' · ') ? target.body.slice(target.body.indexOf(' · ') + 3) : undefined;
  const body = reminderBody({ time: '', note, snoozedUntil: until }, tz);
  await notifier.dismiss(target.id);
  if ((await notifier.permission()) === 'granted') {
    await notifier.schedule({ id: target.id, at, title: target.title, body, date: target.date, vibrate });
  }
  await actions.put({ id: target.id, kind: 'snooze', until, title: target.title, body, date: target.date });
  return at;
}
