import type { AlarmRequest, AlarmScheduler, AlarmStatus, ScheduledAlarm, SettingsKind } from './types';

/**
 * Alarm tiruan di memori: tidak membunyikan apa pun. Dipakai tes dan perangkat tanpa modul alarm (Expo Go, iOS).
 * `status` bisa diatur dan `opened` mencatat pengaturan yang dibuka, supaya tes bisa memeriksanya.
 */
export class MemoryAlarmScheduler implements AlarmScheduler {
  readonly native: boolean;
  readonly alarms = new Map<string, ScheduledAlarm>();
  /** Alarm yang "sedang berbunyi" tanpa terjadwal (tes layar alarm); `getRinging` membacanya. */
  readonly ringing = new Map<string, ScheduledAlarm>();
  /** Setiap panggilan `openSettings`, dari yang pertama. */
  readonly opened: SettingsKind[] = [];
  /** Berapa kali `releaseLockScreen` dipanggil. */
  released = 0;
  /** Berapa kali pengguna diminta membuka kunci HP, dan jawabannya (`false` = dibatalkan). */
  unlockAsked = 0;
  unlockResult = true;
  statusValue: AlarmStatus;

  constructor(options: { native?: boolean; status?: Partial<AlarmStatus> } = {}) {
    this.native = options.native ?? false;
    this.statusValue = { exact: 'granted', fullScreen: 'granted', notifications: 'granted', ...options.status };
  }

  async schedule(alarm: AlarmRequest): Promise<boolean> {
    if (this.statusValue.exact === 'denied') return false;
    // Seperti native: dipasang walau notifikasi mati, tapi tidak terdengar, jadi bukan "terjadwal".
    this.alarms.set(alarm.id, { ...alarm });
    return this.statusValue.notifications !== 'denied';
  }

  async cancel(id: string): Promise<void> {
    this.alarms.delete(id);
    this.ringing.delete(id);
  }

  async cancelAll(): Promise<void> {
    this.alarms.clear();
    this.ringing.clear();
  }

  async list(): Promise<ScheduledAlarm[]> {
    return [...this.alarms.values()].sort((a, b) => a.at - b.at).map((a) => ({ ...a }));
  }

  async getRinging(id: string): Promise<ScheduledAlarm | null> {
    const found = this.alarms.get(id) ?? this.ringing.get(id);
    return found ? { ...found } : null;
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

  async dismissKeyguard(): Promise<boolean> {
    this.unlockAsked += 1;
    return this.unlockResult;
  }
}
