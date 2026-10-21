import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useApi } from '@/api/ApiProvider';
import { useAgenda } from '@/api/useAgenda';
import { useAuth } from '@/api/useAuth';
import { addDays } from '@/sample/dates';
import { getAlarmScheduler } from './index';
import { AlarmSync, ALARM_HORIZON_DAYS } from './sync';

/** Jeda antar penyamaan terjadwal, supaya batas 7 hari ikut bergeser meski aplikasi tidak ditutup. */
const RESYNC_MS = 60 * 60 * 1000;

/**
 * Menyamakan alarm di HP dengan agenda (lihat {@link AlarmSync}): setiap agenda berubah (muat, event stream), setiap
 * aplikasi kembali ke depan, setiap jam, dan setelah masuk. Sebelum menyamakan, rentang hari ini sampai 7 hari ke depan
 * dipastikan sudah dimuat (pergantian pekan, atau agenda yang belum menjangkau sejauh itu). Keluar membatalkan semua
 * alarm. Dipasang sekali di akar, di dalam `AgendaProvider`.
 */
export function useAlarmSync() {
  const { mode } = useApi();
  const { status } = useAuth();
  const agenda = useAgenda();
  const { items, status: agendaStatus } = agenda;
  const active = mode === 'contoh' || status === 'signedIn';
  const ready = active && agendaStatus === 'ready';
  const sync = useRef<AlarmSync | null>(null);
  sync.current ??= new AlarmSync(getAlarmScheduler());
  // Terbaru untuk pendengar yang berumur panjang (foreground, timer).
  const latest = useRef(agenda);
  const readyRef = useRef(ready);
  useEffect(() => {
    latest.current = agenda;
    readyRef.current = ready;
  });

  // Satu putaran: pastikan 7 hari ke depan sudah dimuat, lalu samakan dengan keadaan agenda yang terbaru.
  const run = useRef(async () => {
    if (!readyRef.current) return;
    const first = latest.current;
    if (first.today) await first.ensureRange(first.today, addDays(first.today, ALARM_HORIZON_DAYS));
    const current = latest.current;
    if (readyRef.current) await sync.current?.sync(current.items, current.ackAlarm, current.snooze);
  });

  useEffect(() => {
    if (ready) void run.current();
  }, [ready, items]);

  // Hanya saat sudah pasti keluar; selama sesi masih diperiksa (`checking`) alarm yang ada dibiarkan.
  const signedOut = mode === 'server' && status === 'signedOut';
  useEffect(() => {
    if (signedOut) void sync.current?.clear();
  }, [signedOut]);

  useEffect(() => {
    const go = () => void run.current();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') go();
    });
    const timer = setInterval(go, RESYNC_MS);
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
