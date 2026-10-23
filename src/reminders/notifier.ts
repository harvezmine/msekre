import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationPriority, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';
import { light } from '@/theme/tokens';
import type { PresentedReminder, ReminderNotifier, ReminderPermission, ReminderRequest, ScheduledReminder } from './types';

/**
 * Saluran Android pengingat lokal. Getar dan suara saluran tidak bisa diubah setelah saluran dibuat (Android), jadi
 * "Getar" mati memakai saluran kedua tanpa getar. Bukan `pengingat` (saluran push server): saluran itu sudah ada di HP
 * yang memasang versi sebelumnya tanpa pola getar, dan tidak akan pernah ikut berubah.
 */
export const CHANNEL_REMINDER = 'pengingat_getar';
export const CHANNEL_REMINDER_QUIET = 'pengingat_tanpa_getar';
/** Pola getar pengingat (milidetik: jeda, getar, jeda, getar, ...): dua ketukan pendek lalu satu panjang. */
export const REMINDER_VIBRATION = [0, 400, 200, 400, 200, 800];
/** Kategori tombol notifikasi pengingat (tanpa `:` atau `-`, aturan expo-notifications). */
export const REMINDER_CATEGORY = 'pengingat';
export const ACTION_DONE = 'selesai';
export const ACTION_SNOOZE = 'tunda';
/** Penanda di `data` notifikasi: dijadwalkan HP ini sendiri, bukan push dari server. */
export const LOCAL_REMINDER = 'pengingat-hp';

const PREFIX = 'pengingat-';
export const notificationIdOf = (id: string) => `${PREFIX}${id}`;

/** Isi `data` notifikasi pengingat lokal. */
export interface ReminderData {
  lokal: typeof LOCAL_REMINDER;
  /** Bukan pesan chat: tidak pernah diredam selagi chat terbuka (`usePush`). */
  kind: 'pengingat';
  id: string;
  date: string;
  /** Saat notifikasi dijadwalkan berbunyi (ISO 8601): dasar "Tunda 10 menit". */
  at: string;
  title: string;
  body: string;
}

/** Apakah `data` milik notifikasi pengingat lokal (bukan push server). */
export function reminderData(data: unknown): ReminderData | null {
  const d = data as Partial<ReminderData> | null | undefined;
  if (d?.lokal !== LOCAL_REMINDER || typeof d.id !== 'string' || d.id === '') return null;
  return {
    lokal: LOCAL_REMINDER,
    kind: 'pengingat',
    id: d.id,
    date: typeof d.date === 'string' ? d.date : '',
    at: typeof d.at === 'string' ? d.at : '',
    title: typeof d.title === 'string' ? d.title : '',
    body: typeof d.body === 'string' ? d.body : '',
  };
}

/**
 * Notifikasi pengingat lewat expo-notifications: saluran `pengingat_getar` (penting, suara bawaan HP, pola getar,
 * layar kunci privat) atau `pengingat_tanpa_getar`, tombol "Selesai" dan "Tunda 10 menit". Kedua tombol membuka
 * aplikasi (Agenda, hari itu): tanpa expo-task-manager, tombol yang tidak membuka aplikasi tidak menjalankan apa pun saat
 * aplikasi sudah ditutup, dan notifikasinya tetap tampil. Membuka aplikasi selalu jalan, juga dari keadaan mati.
 * Kegagalan di sisi native tidak menjatuhkan aplikasi.
 */
export class ExpoReminderNotifier implements ReminderNotifier {
  readonly available: boolean;

  constructor(options: { android?: boolean } = {}) {
    this.available = options.android ?? Platform.OS === 'android';
  }

  async setup(): Promise<void> {
    if (!this.available) return;
    const common = {
      importance: AndroidImportance.HIGH,
      sound: 'default',
      lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
      lightColor: light.brand,
      showBadge: false,
    } as const;
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_REMINDER, {
        ...common,
        name: 'Pengingat',
        description: 'Pengingat dari agenda, bergetar dan berbunyi, juga tanpa internet.',
        enableVibrate: true,
        vibrationPattern: REMINDER_VIBRATION,
      });
      await Notifications.setNotificationChannelAsync(CHANNEL_REMINDER_QUIET, {
        ...common,
        name: 'Pengingat tanpa getar',
        description: 'Pengingat dari agenda saat getar dimatikan di aplikasi.',
        enableVibrate: false,
      });
      await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
        { identifier: ACTION_DONE, buttonTitle: 'Selesai', options: { opensAppToForeground: true } },
        { identifier: ACTION_SNOOZE, buttonTitle: 'Tunda 10 menit', options: { opensAppToForeground: true } },
      ]);
    } catch {
      // Dicoba lagi pada penyamaan berikutnya.
    }
  }

  async permission(): Promise<ReminderPermission> {
    if (!this.available) return 'denied';
    try {
      const res = await Notifications.getPermissionsAsync();
      if (!res.granted) return res.status === 'denied' ? 'denied' : 'undetermined';
      // Saluran dimatikan pengguna di pengaturan HP: notifikasinya tidak akan tampil.
      for (const id of [CHANNEL_REMINDER, CHANNEL_REMINDER_QUIET]) {
        const channel = await Notifications.getNotificationChannelAsync(id);
        if (channel && channel.importance <= AndroidImportance.NONE) return 'denied';
      }
      return 'granted';
    } catch {
      return 'denied';
    }
  }

  async schedule(r: ReminderRequest): Promise<boolean> {
    if (!this.available) return false;
    const data: ReminderData = {
      lokal: LOCAL_REMINDER,
      kind: 'pengingat',
      id: r.id,
      date: r.date,
      at: new Date(r.at).toISOString(),
      title: r.title,
      body: r.body,
    };
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: notificationIdOf(r.id),
        content: {
          title: r.title,
          body: r.body,
          data: { ...data },
          categoryIdentifier: REMINDER_CATEGORY,
          sound: 'default',
          priority: AndroidNotificationPriority.HIGH,
          color: light.brand,
          autoDismiss: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.at,
          channelId: r.vibrate ? CHANNEL_REMINDER : CHANNEL_REMINDER_QUIET,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async cancel(id: string): Promise<void> {
    if (!this.available) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationIdOf(id));
    } catch {
      // Tidak terjadwal.
    }
    await this.dismiss(id);
  }

  async dismiss(id: string): Promise<void> {
    if (!this.available) return;
    try {
      await Notifications.dismissNotificationAsync(notificationIdOf(id));
    } catch {
      // Tidak sedang tampil.
    }
  }

  async scheduled(): Promise<ScheduledReminder[]> {
    if (!this.available) return [];
    try {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      return all.flatMap((request) => {
        const d = reminderData(request.content.data);
        if (!d) return [];
        const at = Date.parse(d.at);
        return [{ id: d.id, at: Number.isNaN(at) ? 0 : at }];
      });
    } catch {
      return [];
    }
  }

  async presented(): Promise<PresentedReminder[]> {
    if (!this.available) return [];
    try {
      const all = await Notifications.getPresentedNotificationsAsync();
      return all.flatMap((n) => {
        const d = reminderData(n.request.content.data);
        return d ? [{ id: d.id, date: d.date || null }] : [];
      });
    } catch {
      return [];
    }
  }
}

let current: ReminderNotifier | null = null;

/** Notifikasi pengingat bersama untuk seluruh aplikasi. */
export function getReminderNotifier(): ReminderNotifier {
  current ??= new ExpoReminderNotifier();
  return current;
}

/** Ganti notifikasi bersama (tes). `null` = kembali ke pilihan otomatis. */
export function setReminderNotifier(notifier: ReminderNotifier | null) {
  current = notifier;
}
