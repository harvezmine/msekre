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
  /** Akhir jendela bunyi (milidetik epoch); hanya ada untuk alarm yang sedang berbunyi (`getRinging`). */
  until?: number;
}

/**
 * Alarm yang dibunyikan HP sendiri, tanpa internet. Dua isi: `NativeAlarmScheduler` (modul Android) dan
 * `MemoryAlarmScheduler` (tes, dan perangkat tanpa modul seperti Expo Go atau iOS).
 */
export interface AlarmScheduler {
  /** Alarm native tersedia (`true`) atau hanya tiruan di memori (`false`, tidak ada yang berbunyi). */
  readonly native: boolean;
  /**
   * Jadwalkan (menggantikan yang berid sama). `true` hanya kalau alarm terjadwal DAN akan terdengar; `false` kalau izin
   * alarm tepat waktu belum ada atau notifikasi (juga saluran alarm) dimatikan. Hanya `true` yang boleh dikabarkan ke
   * server.
   */
  schedule(alarm: AlarmRequest): Promise<boolean>;
  /** Batalkan jadwal dan buang notifikasi yang sedang berbunyi. */
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  list(): Promise<ScheduledAlarm[]>;
  /**
   * Catatan alarm yang sedang berbunyi (atau terjadwal) di HP untuk `id`, atau `null`. Layar alarm memakainya kalau item
   * agendanya tidak bisa dimuat.
   */
  getRinging(id: string): Promise<ScheduledAlarm | null>;
  status(): Promise<AlarmStatus>;
  openSettings(kind: SettingsKind): Promise<void>;
  /** Alarm dimatikan, ditunda, atau layar alarm ditutup: layar tidak lagi tampil di atas layar kunci. */
  releaseLockScreen(): Promise<void>;
  /**
   * Jendela bunyi habis di HP terkunci: pindahkan aplikasi ke latar supaya layar kunci kembali. `true` kalau
   * dipindahkan; `false` kalau HP tidak terkunci (tidak berbuat apa-apa) atau perangkat tanpa alarm native.
   */
  moveToBack(): Promise<boolean>;
  /**
   * Minta pengguna membuka kunci HP. `true` kalau sudah terbuka (atau HP memang tidak terkunci, atau perangkat tanpa
   * alarm native); `false` kalau dibatalkan atau gagal.
   */
  dismissKeyguard(): Promise<boolean>;
}
