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
 * Alarm yang sedang berbunyi (atau terjadwal) menurut catatan di HP, seperti {@link NativeAlarmEntry}. `until`: akhir
 * jendela bunyi (milidetik epoch), hanya untuk alarm yang sedang berbunyi.
 */
export interface NativeRingingEntry extends NativeAlarmEntry {
  until?: number | null;
}

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
  /**
   * Alarm dimatikan, ditunda, ditutup, atau habis waktunya: aplikasi tidak lagi tampil di atas layar kunci. Selesai
   * sesudah izinnya benar-benar lepas (di thread utama), jadi aman menunggunya sebelum pindah layar. Hanya penanda yang
   * dipasang modul ini yang dilepas (bukan `FLAG_KEEP_SCREEN_ON` milik keep-awake).
   */
  releaseLockScreen(): Promise<void>;
  /** Pindahkan aplikasi ke latar kalau HP terkunci; `false` kalau tidak terkunci (tidak berbuat apa-apa). */
  moveToBack(): Promise<boolean>;
  /**
   * Minta pengguna membuka kunci HP tanpa meninggalkan aplikasi. Selesai `true` begitu terbuka (atau HP memang tidak
   * terkunci); ditolak kalau pengguna membatalkan.
   */
  dismissKeyguard(): Promise<boolean>;
}

/** Modul native, atau `null` kalau tidak ada (Expo Go, iOS, web, atau build tanpa modul ini). */
export const AlarmNative = requireOptionalNativeModule<AlarmNativeModule>('Alarm');
