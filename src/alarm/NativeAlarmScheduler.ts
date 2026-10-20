import type { AlarmNativeModule, AlarmNativeStatus } from '../../modules/alarm';
import type { AlarmRequest, AlarmScheduler, AlarmStatus, ScheduledAlarm, SettingsKind } from './types';

const UNKNOWN: AlarmStatus = { exact: 'unknown', fullScreen: 'unknown', notifications: 'unknown' };

function toStatus(s: AlarmNativeStatus): AlarmStatus {
  return {
    exact: s.exact === 'granted' ? 'granted' : 'denied',
    fullScreen: s.fullScreen === 'granted' ? 'granted' : 'denied',
    notifications: s.notifications === 'granted' ? 'granted' : 'denied',
    batteryOptimized: s.batteryOptimized === true,
  };
}

/**
 * Alarm lewat modul native Android `Alarm`. Kegagalan di sisi native tidak boleh menjatuhkan aplikasi: `schedule`
 * menjawab `false`, `list` kosong, `status` `unknown`, selebihnya diabaikan.
 */
export class NativeAlarmScheduler implements AlarmScheduler {
  readonly native = true;

  constructor(private readonly module: AlarmNativeModule) {}

  async schedule(alarm: AlarmRequest): Promise<boolean> {
    try {
      return (await this.module.schedule(alarm.id, alarm.at, alarm.title, alarm.note ?? null)) === true;
    } catch {
      return false;
    }
  }

  async cancel(id: string): Promise<void> {
    try {
      await this.module.cancel(id);
    } catch {
      // Tidak ada yang bisa dilakukan: alarm yang tidak bisa dibatalkan berbunyi sekali lagi.
    }
  }

  async cancelAll(): Promise<void> {
    try {
      await this.module.cancelAll();
    } catch {
      // Lihat cancel.
    }
  }

  async list(): Promise<ScheduledAlarm[]> {
    try {
      const entries = await this.module.list();
      return entries.map((e) => ({ id: e.id, at: e.at, title: e.title, ...(e.note ? { note: e.note } : {}) }));
    } catch {
      return [];
    }
  }

  async status(): Promise<AlarmStatus> {
    try {
      return toStatus(this.module.status());
    } catch {
      return UNKNOWN;
    }
  }

  async openSettings(kind: SettingsKind): Promise<void> {
    try {
      await this.module.openSettings(kind);
    } catch {
      // Pengaturan tidak bisa dibuka: pengguna membukanya sendiri.
    }
  }

  async releaseLockScreen(): Promise<void> {
    try {
      await this.module.releaseLockScreen();
    } catch {
      // Lihat cancel.
    }
  }
}
