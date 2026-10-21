import { alarmBlocked, useAlarmStatus } from '@/alarm/useAlarmStatus';
import { NOTIFICATION_KINDS } from '@/api/account';
import type { Account } from '@/api/contract';
import { usePush } from '@/api/usePush';
import { useTabSet } from '../tabSet';

export type NotificationValue = 'Nyala' | 'Mati' | 'Perlu izin';

/**
 * Keadaan Pemberitahuan untuk Akun dan halamannya:
 * - `kinds`: jenis kabar yang relevan (Rumah hanya bila ada perangkat, Usaha hanya bila ada data usaha);
 * - `phoneOn`: HP mengizinkan notifikasi; `alarmReady`: alarm native siap (atau HP ini tanpa alarm native);
 * - `value`: satu kata untuk baris Akun. "Perlu izin" bila HP atau alarm masih perlu izin, "Mati" bila semua jenis yang
 *   relevan dimatikan, selain itu "Nyala".
 */
export function useNotifications(account: Account | null) {
  const push = usePush();
  const alarm = useAlarmStatus();
  const { tabs } = useTabSet();
  const kinds = NOTIFICATION_KINDS.filter((k) => !k.only || tabs.includes(k.only));
  const phoneOn = push.permission === 'granted';
  const alarmReady = !alarm.native || !alarmBlocked(alarm.status);
  const anyOn = account ? kinds.some((k) => account.notifications[k.key]) : true;
  const value: NotificationValue = !phoneOn || !alarmReady ? 'Perlu izin' : anyOn ? 'Nyala' : 'Mati';
  return { kinds, phoneOn, alarm, alarmReady, value };
}
