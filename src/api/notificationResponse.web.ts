import type * as Notifications from 'expo-notifications';

/**
 * Web (pratinjau tangkapan layar saja): `expo-notifications` tidak punya jawaban notifikasi terakhir di web dan
 * melempar galat, jadi tidak pernah ada ketukan. Perilaku Android/iOS tidak berubah (`notificationResponse.ts`).
 */
export function useLastNotificationResponse(): Notifications.NotificationResponse | null | undefined {
  return null;
}
