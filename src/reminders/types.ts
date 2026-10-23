/** Satu pengingat yang dijadwalkan sebagai notifikasi lokal di HP. */
export interface ReminderRequest {
  /** Id item agenda (id kejadian untuk yang berulang). */
  id: string;
  /** Milidetik epoch. */
  at: number;
  title: string;
  /** Jam (dan catatan pendek), misalnya "07.00 · Terminal 3". */
  body: string;
  /** Tanggal item ("YYYY-MM-DD"), untuk membuka Agenda di hari itu. */
  date: string;
  /** Saluran bergetar atau tanpa getar (Akun → Pemberitahuan → Getar). */
  vibrate: boolean;
}

export interface ScheduledReminder {
  id: string;
  at: number;
}

export interface PresentedReminder {
  id: string;
  date: string | null;
}

/**
 * Bisa tidaknya notifikasi pengingat tampil: `granted` hanya bila izin notifikasi HP ada DAN saluran pengingat tidak
 * dimatikan pengguna. Hanya `granted` yang boleh dijadwalkan dan dikabarkan ke server.
 */
export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

/**
 * Notifikasi pengingat lokal (tanpa internet). Isinya `ExpoReminderNotifier` (expo-notifications); di perangkat tanpa
 * notifikasi lokal (web, Jest bawaan) `available` = `false` dan penjadwal tidak berbuat apa-apa.
 */
export interface ReminderNotifier {
  readonly available: boolean;
  /** Saluran Android dan kategori tombol (Selesai, Tunda 10 menit). Aman diulang. */
  setup(): Promise<void>;
  permission(): Promise<ReminderPermission>;
  /** Jadwalkan (menggantikan yang berid sama). `true` kalau terjadwal. */
  schedule(reminder: ReminderRequest): Promise<boolean>;
  /** Batalkan jadwal dan buang notifikasi yang sedang tampil untuk id itu. */
  cancel(id: string): Promise<void>;
  /** Buang notifikasi yang sedang tampil saja (jadwal baru untuk id yang sama tetap). */
  dismiss(id: string): Promise<void>;
  scheduled(): Promise<ScheduledReminder[]>;
  presented(): Promise<PresentedReminder[]>;
}
