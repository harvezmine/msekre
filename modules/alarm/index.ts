import { requireOptionalNativeModule } from 'expo';

/** Keadaan izin dari sisi native. `batteryOptimized`: aplikasi masih terkena penghemat baterai sistem. */
export interface AlarmNativeStatus {
  exact: 'granted' | 'denied';
  fullScreen: 'granted' | 'denied';
  notifications: 'granted' | 'denied';
  batteryOptimized: boolean;
}

export type AlarmSettingsKind = 'exact' | 'fullScreen' | 'notifications' | 'battery';

export interface NativeAlarmEntry {
  id: string;
  /** Milidetik epoch. */
  at: number;
  title: string;
  note: string | null;
}

/**
 * Modul native `Alarm` (Kotlin, `android/src/main/java/expo/modules/alarm`). Waktu dalam milidetik epoch.
 * `schedule` memakai `AlarmManager.setAlarmClock` dan menyimpan jadwal supaya dipasang ulang setelah HP dinyalakan ulang.
 */
export interface AlarmNativeModule {
  /** `true` kalau terjadwal; `false` kalau izin alarm tepat waktu belum diberikan. */
  schedule(id: string, atMillis: number, title: string, note: string | null): Promise<boolean>;
  /** Batalkan jadwal dan buang notifikasi yang sedang berbunyi untuk id itu. */
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  list(): Promise<NativeAlarmEntry[]>;
  status(): AlarmNativeStatus;
  /** `false` kalau tidak ada layar pengaturan yang bisa dibuka. */
  openSettings(kind: AlarmSettingsKind): Promise<boolean>;
  /** Alarm dimatikan: aplikasi tidak lagi tampil di atas layar kunci. */
  releaseLockScreen(): Promise<void>;
}

/** Modul native, atau `null` kalau tidak ada (Expo Go, iOS, web, atau build tanpa modul ini). */
export const AlarmNative = requireOptionalNativeModule<AlarmNativeModule>('Alarm');
