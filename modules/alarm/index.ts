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

/** Alarm yang sedang berbunyi (atau terjadwal) menurut catatan di HP; sama bentuknya dengan {@link NativeAlarmEntry}. */
export type NativeRingingEntry = NativeAlarmEntry;

/**
 * Modul native `Alarm` (Kotlin, `android/src/main/java/expo/modules/alarm`). Waktu dalam milidetik epoch.
 * `schedule` memakai `AlarmManager.setAlarmClock` dan menyimpan jadwal supaya dipasang ulang setelah HP dinyalakan ulang.
 */
export interface AlarmNativeModule {
  /**
   * `true` kalau terjadwal DAN akan terdengar. `false` kalau izin alarm tepat waktu belum diberikan, atau notifikasi (atau
   * saluran `alarm`) dimatikan: alarm yang tidak bisa berbunyi tidak boleh dikabarkan ke server.
   */
  schedule(id: string, atMillis: number, title: string, note: string | null): Promise<boolean>;
  /** Batalkan jadwal dan buang notifikasi yang sedang berbunyi untuk id itu. */
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  list(): Promise<NativeAlarmEntry[]>;
  /**
   * Catatan alarm yang sedang berbunyi (atau terjadwal) untuk `id`, atau `null`. Layar alarm memakainya kalau item agendanya
   * tidak bisa dimuat (tanpa internet, sesi habis).
   */
  getRinging(id: string): Promise<NativeRingingEntry | null>;
  status(): AlarmNativeStatus;
  /** `false` kalau tidak ada layar pengaturan yang bisa dibuka. */
  openSettings(kind: AlarmSettingsKind): Promise<boolean>;
  /** Alarm dimatikan, ditunda, atau layar alarm ditutup: aplikasi tidak lagi tampil di atas layar kunci. */
  releaseLockScreen(): Promise<void>;
  /**
   * Minta pengguna membuka kunci HP tanpa meninggalkan aplikasi. Selesai `true` begitu terbuka (atau HP memang tidak
   * terkunci); ditolak kalau pengguna membatalkan.
   */
  dismissKeyguard(): Promise<boolean>;
}

/** Modul native, atau `null` kalau tidak ada (Expo Go, iOS, web, atau build tanpa modul ini). */
export const AlarmNative = requireOptionalNativeModule<AlarmNativeModule>('Alarm');
