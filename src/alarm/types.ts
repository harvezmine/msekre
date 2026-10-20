export type Grant = 'granted' | 'denied' | 'unknown';

/** Keadaan izin yang menentukan apakah alarm bunyi tepat waktu. */
export interface AlarmStatus {
  /** Alarm tepat waktu ("Alarm dan pengingat" di pengaturan Android 12+). */
  exact: Grant;
  /** Boleh tampil layar penuh saat HP terkunci (Android 14+). */
  fullScreen: Grant;
  notifications: Grant;
  /** Penghemat baterai masih membatasi aplikasi; hanya diketahui di Android. */
  batteryOptimized?: boolean;
}

export type SettingsKind = 'exact' | 'fullScreen' | 'notifications' | 'battery';

export interface AlarmRequest {
  id: string;
  /** Milidetik epoch. */
  at: number;
  title: string;
  note?: string;
}

export interface ScheduledAlarm extends AlarmRequest {
  note?: string;
}

/**
 * Alarm yang dibunyikan HP sendiri, tanpa internet. Dua isi: `NativeAlarmScheduler` (modul Android) dan
 * `MemoryAlarmScheduler` (tes, dan perangkat tanpa modul seperti Expo Go atau iOS).
 */
export interface AlarmScheduler {
  /** Alarm native tersedia (`true`) atau hanya tiruan di memori (`false`, tidak ada yang berbunyi). */
  readonly native: boolean;
  /** Jadwalkan (menggantikan yang berid sama). `true` kalau terjadwal; `false` kalau izin belum ada. */
  schedule(alarm: AlarmRequest): Promise<boolean>;
  /** Batalkan jadwal dan buang notifikasi yang sedang berbunyi. */
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  list(): Promise<ScheduledAlarm[]>;
  status(): Promise<AlarmStatus>;
  openSettings(kind: SettingsKind): Promise<void>;
  /** Alarm dimatikan: layar tidak lagi tampil di atas layar kunci. */
  releaseLockScreen(): Promise<void>;
}
