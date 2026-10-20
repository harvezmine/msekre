import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getAlarmScheduler } from './index';
import type { AlarmStatus, SettingsKind } from './types';

/** Ada izin yang membuat alarm tidak bunyi tepat waktu atau tidak muncul di layar kunci. */
export function alarmBlocked(status: AlarmStatus | null): boolean {
  return (
    status !== null &&
    (status.exact === 'denied' || status.fullScreen === 'denied' || status.notifications === 'denied')
  );
}

export interface AlarmStatusApi {
  /** Alarm native tersedia di perangkat ini. */
  native: boolean;
  /** `null` sebelum pembacaan pertama (atau kalau alarm native tidak tersedia). */
  status: AlarmStatus | null;
  refresh: () => Promise<void>;
  openSettings: (kind: SettingsKind) => Promise<void>;
}

/**
 * Keadaan izin alarm. Dibaca saat dibuka dan setiap aplikasi kembali ke depan (pengguna baru pulang dari pengaturan).
 */
export function useAlarmStatus(): AlarmStatusApi {
  const scheduler = getAlarmScheduler();
  const [status, setStatus] = useState<AlarmStatus | null>(null);
  const native = scheduler.native;

  const refresh = useCallback(async () => {
    if (!scheduler.native) return;
    setStatus(await scheduler.status());
  }, [scheduler]);

  useEffect(() => {
    if (!scheduler.native) return;
    let alive = true;
    const load = () =>
      void scheduler.status().then((next) => {
        if (alive) setStatus(next);
      });
    load();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [scheduler]);

  const openSettings = useCallback((kind: SettingsKind) => scheduler.openSettings(kind), [scheduler]);
  return { native, status, refresh, openSettings };
}
