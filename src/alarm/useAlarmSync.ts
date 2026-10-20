import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useApi } from '@/api/ApiProvider';
import { useAgenda } from '@/api/useAgenda';
import { useAuth } from '@/api/useAuth';
import { getAlarmScheduler } from './index';
import { AlarmSync } from './sync';

/** Jeda antar penyamaan terjadwal, supaya batas 7 hari ikut bergeser meski aplikasi tidak ditutup. */
const RESYNC_MS = 60 * 60 * 1000;

/**
 * Menyamakan alarm di HP dengan agenda (lihat {@link AlarmSync}): setiap agenda berubah (muat, event stream), setiap
 * aplikasi kembali ke depan, setiap jam, dan setelah masuk. Keluar membatalkan semua alarm. Dipasang sekali di akar,
 * di dalam `AgendaProvider`.
 */
export function useAlarmSync() {
  const { mode } = useApi();
  const { status } = useAuth();
  const { items, status: agendaStatus, ackAlarm } = useAgenda();
  const active = mode === 'contoh' || status === 'signedIn';
  const ready = active && agendaStatus === 'ready';
  const sync = useRef<AlarmSync | null>(null);
  sync.current ??= new AlarmSync(getAlarmScheduler());
  // Terbaru untuk pendengar yang berumur panjang (foreground, timer).
  const latest = useRef({ items, ackAlarm, ready });
  useEffect(() => {
    latest.current = { items, ackAlarm, ready };
  });

  useEffect(() => {
    if (ready) void sync.current?.sync(items, ackAlarm);
  }, [ready, items, ackAlarm]);

  // Hanya saat sudah pasti keluar; selama sesi masih diperiksa (`checking`) alarm yang ada dibiarkan.
  const signedOut = mode === 'server' && status === 'signedOut';
  useEffect(() => {
    if (signedOut) void sync.current?.clear();
  }, [signedOut]);

  useEffect(() => {
    const run = () => {
      const l = latest.current;
      if (l.ready) void sync.current?.sync(l.items, l.ackAlarm);
    };
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    const timer = setInterval(run, RESYNC_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
}

/** Komponen untuk dipasang di akar: menjalankan {@link useAlarmSync}. */
export function AlarmSyncHost() {
  useAlarmSync();
  return null;
}
