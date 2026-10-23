import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { isGone } from '@/api/agendaController';
import { useApi } from '@/api/ApiProvider';
import { addDays } from '@/api/dates';
import { formatJam } from '@/api/format';
import { needsSignIn } from '@/api/mode';
import { useLastNotificationResponse } from '@/api/notificationResponse';
import { canOpen } from '@/api/routeAccess';
import { readSecure, writeSecure } from '@/api/secureStore';
import type { AgendaItem } from '@/api/contract';
import { useAgenda } from '@/api/useAgenda';
import { useAuth } from '@/api/useAuth';
import { usePush } from '@/api/usePush';
import { ALARM_HORIZON_DAYS } from '@/alarm/sync';
import { useToast } from '@/ui/toastStore';
import { ACTION_DONE, ACTION_SNOOZE, getReminderNotifier, reminderData } from './notifier';
import type { PendingReminderAction } from './pending';
import { getSoundSettings, useSoundSettings } from './soundSettings';
import { reminderDone, reminderSnooze, ReminderSync, remindable, type FlushFn } from './sync';
import type { ReminderPermission } from './types';

/** Jeda antar penyamaan terjadwal, supaya batas 7 hari ikut bergeser meski aplikasi tidak ditutup. */
const RESYNC_MS = 60 * 60 * 1000;
/** Lembar izin notifikasi sudah pernah dibuka karena ada pengingat (sekali seumur pemasangan). */
const OFFERED_KEY = 'pengingat.izin.ditawari';

/** Tombol notifikasi yang sudah dijalankan (identitas + waktu + tombol), supaya tidak dijalankan dua kali. */
const handled = new Set<string>();
let offered: boolean | null = null;

/**
 * Menyamakan notifikasi pengingat lokal dengan agenda (lihat {@link ReminderSync}): setiap agenda berubah (muat, event
 * stream), setiap aplikasi kembali ke depan, setiap jam, setelah masuk, saat izin notifikasi atau pilihan getar berubah.
 * Keluar dan ganti mode data membatalkan semuanya. Mengembalikan fungsi untuk meminta penyamaan sekarang.
 */
export function useReminderSync(): () => Promise<void> {
  const { mode } = useApi();
  const { status } = useAuth();
  const { permission } = usePush();
  const agenda = useAgenda();
  const { vibrate } = useSoundSettings();
  const { items, status: agendaStatus } = agenda;
  const active = !needsSignIn(mode) || status === 'signedIn';
  const ready = active && agendaStatus === 'ready';
  const sync = useRef<ReminderSync | null>(null);
  const lastMode = useRef(mode);
  const latest = useRef({ agenda, ready, vibrate });
  useEffect(() => {
    latest.current = { agenda, ready, vibrate };
  });

  const run = useRef(async () => {
    sync.current ??= new ReminderSync(getReminderNotifier());
    if (!latest.current.ready) return;
    const first = latest.current.agenda;
    if (first.today) await first.ensureRange(first.today, addDays(first.today, ALARM_HORIZON_DAYS));
    const { agenda: now, ready: stillReady, vibrate: buzz } = latest.current;
    if (!stillReady) return;
    const flush: FlushFn = async (action: PendingReminderAction) => {
      try {
        if (action.kind === 'done') await latest.current.agenda.markDone(action.id);
        else await latest.current.agenda.snoozeStrict(action.id, action.until!);
        return 'ok';
      } catch (e) {
        return isGone(e) ? 'drop' : 'retry';
      }
    };
    await sync.current.sync({
      items: now.items,
      tz: now.tzOffsetMinutes,
      ranges: now.ranges,
      vibrate: buzz,
      ack: now.ackAlarm,
      flush,
    });
  });

  useEffect(() => {
    void getSoundSettings().load();
  }, []);

  useEffect(() => {
    if (ready) void run.current();
  }, [ready, items, vibrate, permission]);

  const signedOut = needsSignIn(mode) && status === 'signedOut';
  useEffect(() => {
    if (!signedOut) return;
    sync.current ??= new ReminderSync(getReminderNotifier());
    void sync.current.clear();
  }, [signedOut]);
  useEffect(() => {
    if (lastMode.current === mode) return;
    lastMode.current = mode;
    sync.current ??= new ReminderSync(getReminderNotifier());
    void sync.current.clear().then(() => run.current());
  }, [mode]);

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

  return useCallback(() => run.current(), []);
}

/** Lupakan jawaban terakhir di sistem, supaya muat ulang JS tidak menjalankan tombolnya lagi. */
function clearResponse() {
  try {
    Notifications.clearLastNotificationResponse();
  } catch {
    // Modul lama: `handled` tetap mencegah pengulangan selama proses hidup.
  }
}

/**
 * Notifikasi pengingat lokal yang ditekan (juga yang membuka aplikasi dari keadaan mati): "Selesai" dan "Tunda 10 menit"
 * langsung berlaku di HP (notifikasi hilang, tundaan dijadwalkan) dan dicatat untuk server (dikirim penyamaan berikutnya,
 * diulang sampai sampai); lalu Agenda dibuka di item itu. Ketukan biasa hanya membuka Agenda di item itu.
 */
export function useReminderResponses(requestSync: () => Promise<void>) {
  const response = useLastNotificationResponse();
  const { mode } = useApi();
  const { status } = useAuth();
  const toast = useToast();
  const agenda = useAgenda();
  const tz = agenda.tzOffsetMinutes;
  // Item yang dibuka setelah tombolnya berlaku. Disimpan di ref (dibaca efek di bawah); `opened` hanya memicu efeknya.
  const target = useRef<{ id: string; date: string } | null>(null);
  const [opened, setOpened] = useState(0);

  useEffect(() => {
    if (!response) return;
    const data = reminderData(response.notification.request.content.data);
    if (!data) return;
    const action = response.actionIdentifier;
    const key = `${response.notification.request.identifier}@${response.notification.date}@${action}`;
    if (handled.has(key)) return;
    handled.add(key);
    clearResponse();
    const notifier = getReminderNotifier();
    void (async () => {
      if (action === ACTION_DONE) {
        await reminderDone(notifier, data);
        toast('Ditandai selesai.');
      } else if (action === ACTION_SNOOZE) {
        const at = await reminderSnooze(notifier, data, { vibrate: getSoundSettings().get().vibrate, tz });
        toast(`Ditunda sampai ${formatJam(new Date(at).toISOString(), tz)}.`);
      }
      void requestSync();
      target.current = { id: data.id, date: data.date };
      setOpened((n) => n + 1);
    })();
  }, [response, toast, tz, requestSync]);

  // Agenda dibuka setelah sesi selesai diperiksa; tanpa sesi (mode akun, keluar) tombolnya tetap berlaku di HP.
  useEffect(() => {
    const open = target.current;
    if (!open) return;
    if (needsSignIn(mode) && status === 'checking') return;
    target.current = null;
    if (!canOpen('app', mode, status)) return;
    router.navigate({ pathname: '/agenda', params: { id: open.id, ...(open.date ? { tanggal: open.date } : {}) } });
  }, [opened, mode, status]);
}

/** Memasang penyamaan pengingat dan penangan tombol notifikasinya di akar, di dalam `AgendaProvider`. */
export function ReminderHost() {
  const run = useReminderSync();
  useReminderResponses(run);
  return null;
}

/**
 * Izin notifikasi pengingat di HP ini (izin HP dan saluran pengingat), dibaca saat dipasang dan tiap aplikasi kembali ke
 * depan. `null`: belum terbaca, atau HP ini tanpa notifikasi lokal.
 */
export function useReminderPermission(): ReminderPermission | null {
  const { permission: push } = usePush();
  const [state, setState] = useState<ReminderPermission | null>(null);
  useEffect(() => {
    const notifier = getReminderNotifier();
    if (!notifier.available) return;
    let alive = true;
    const read = () =>
      void notifier.permission().then((p) => {
        if (alive) setState(p);
      });
    read();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') read();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [push]);
  return state;
}

/** Ada pengingat (bukan alarm) yang belum lewat di agenda: hanya itu yang membutuhkan izin notifikasi di sini. */
export function hasUpcomingReminders(items: AgendaItem[], today: string | null): boolean {
  if (!today) return false;
  return items.some((i) => i.date >= today && remindable(i));
}

/**
 * Buka lembar izin notifikasi sekali seumur pemasangan, saat ada pengingat yang tidak akan tampil karena izin belum ada.
 * `true` kalau dibuka.
 */
export async function offerReminderPermission(permission: ReminderPermission | null): Promise<boolean> {
  if (permission === null || permission === 'granted') return false;
  if (offered === null) offered = (await readSecure(OFFERED_KEY)) !== null;
  if (offered) return false;
  offered = true;
  void writeSecure(OFFERED_KEY, '1');
  router.push('/izin-notifikasi');
  return true;
}

/** Untuk tes: lupakan tombol yang sudah dijalankan dan tawaran izin. */
export function resetRemindersForTests() {
  handled.clear();
  offered = null;
}
