import type { AlarmRequest, AlarmScheduler, AlarmStatus, ScheduledAlarm, SettingsKind } from './types';

/**
 * Alarm tiruan di memori: tidak membunyikan apa pun. Dipakai tes dan perangkat tanpa modul alarm (Expo Go, iOS).
 * `status` bisa diatur dan `opened` mencatat pengaturan yang dibuka, supaya tes bisa memeriksanya.
 */
export class MemoryAlarmScheduler implements AlarmScheduler {
  readonly native: boolean;
  readonly alarms = new Map<string, ScheduledAlarm>();
  /** Setiap panggilan `openSettings`, dari yang pertama. */
  readonly opened: SettingsKind[] = [];
  /** Berapa kali `releaseLockScreen` dipanggil. */
  released = 0;
  statusValue: AlarmStatus;

  constructor(options: { native?: boolean; status?: Partial<AlarmStatus> } = {}) {
    this.native = options.native ?? false;
    this.statusValue = { exact: 'granted', fullScreen: 'granted', notifications: 'granted', ...options.status };
  }

  async schedule(alarm: AlarmRequest): Promise<boolean> {
    if (this.statusValue.exact === 'denied') return false;
    this.alarms.set(alarm.id, { ...alarm });
    return true;
  }

  async cancel(id: string): Promise<void> {
    this.alarms.delete(id);
  }

  async cancelAll(): Promise<void> {
    this.alarms.clear();
  }

  async list(): Promise<ScheduledAlarm[]> {
    return [...this.alarms.values()].sort((a, b) => a.at - b.at).map((a) => ({ ...a }));
  }

  async status(): Promise<AlarmStatus> {
    return { ...this.statusValue };
  }

  async openSettings(kind: SettingsKind): Promise<void> {
    this.opened.push(kind);
  }

  async releaseLockScreen(): Promise<void> {
    this.released += 1;
  }
}
