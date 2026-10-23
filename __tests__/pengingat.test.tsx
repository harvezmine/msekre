import { act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useState } from 'react';
import { AppState } from 'react-native';
import type { AgendaItem } from '@/api/contract';
import { ApiFailure } from '@/api/transport';
import { PushTapHandler } from '@/api/usePush';
import {
  ACTION_DONE,
  ACTION_SNOOZE,
  CHANNEL_REMINDER,
  CHANNEL_REMINDER_QUIET,
  ExpoReminderNotifier,
  notificationIdOf,
  REMINDER_CATEGORY,
  REMINDER_VIBRATION,
  setReminderNotifier,
} from '@/reminders/notifier';
import { PendingReminderActions, setPendingReminderActions } from '@/reminders/pending';
import { setSoundSettings, SoundSettingsStore } from '@/reminders/soundSettings';
import { desiredReminders, reminderBody, reminderDone, reminderSnooze, ReminderSync } from '@/reminders/sync';
import { ReminderHost, resetRemindersForTests } from '@/reminders/useReminders';
import type { NotificationsMockState } from './notificationsMock';
import { createTestApi, renderWithProviders, toastNow } from './helpers';

const N = Notifications as unknown as typeof Notifications & { __mock: NotificationsMockState };
const mock = N.__mock;

const NOW = Date.parse('2026-10-21T00:00:00.000Z');
const iso = (offsetMin: number, base = NOW) => new Date(base + offsetMin * 60_000).toISOString();

function item(id: string, offsetMin: number, extra: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id,
    date: '2026-10-21',
    time: '07.00',
    at: iso(offsetMin),
    title: `Pengingat ${id}`,
    kind: 'reminder',
    ...extra,
  };
}

function allow(granted = true) {
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({ granted, status: granted ? 'granted' : 'denied', canAskAgain: !granted } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  mock.reset();
  allow(true);
  resetRemindersForTests();
  setPendingReminderActions(new PendingReminderActions(false));
  setSoundSettings(new SoundSettingsStore(false));
});
afterEach(() => {
  setReminderNotifier(null);
  setPendingReminderActions(null);
  setSoundSettings(null);
  jest.mocked(Notifications.useLastNotificationResponse).mockReturnValue(null);
  jest.mocked(AppState.addEventListener).mockImplementation((() => ({ remove: jest.fn() })) as never);
});

const scheduledIds = () => [...mock.scheduled.values()].map((r) => r.content.data?.id);
const triggerOf = (id: string) =>
  mock.scheduled.get(notificationIdOf(id))?.trigger as { date: number; channelId: string };

describe('pengingat mana yang dijadwalkan', () => {
  test('pengingat, rutin, dan tugas berjam, bukan alarm atau telepon, belum selesai, dalam 7 hari ke depan', () => {
    const items = [
      item('ok', 10),
      item('notif', 15, { way: 'notif' }),
      item('rutin', 20, { kind: 'recurring' }),
      item('tugas', 30, { kind: 'task' }),
      item('alarm', 10, { way: 'alarm' }),
      item('telepon', 10, { way: 'call' }),
      item('rapat', 10, { kind: 'meeting' }),
      item('selesai', 10, { done: true }),
      item('seharian', 10, { allDay: true }),
      item('lewat', -1),
      item('jauh', 7 * 24 * 60 + 1),
      item('batas', 7 * 24 * 60),
      item('rusak', 10, { at: 'bukan-waktu' }),
    ];
    expect(desiredReminders(items, NOW).map((d) => d.id)).toEqual(['ok', 'notif', 'rutin', 'tugas', 'batas']);
  });

  test('ditunda: waktu tundaan, dan badan notifikasi menulis jam tundaan menurut zona pengguna', () => {
    const [d] = desiredReminders([item('t', -30, { snoozedUntil: iso(10), note: 'Bawa map biru' })], NOW, 420);
    expect(d).toMatchObject({ id: 't', at: NOW + 10 * 60_000, body: '07.10 · Bawa map biru' });
    expect(reminderBody({ time: '07.00' })).toBe('07.00');
    const long = reminderBody({ time: '07.00', note: 'a'.repeat(90) });
    expect(long.length).toBeLessThanOrEqual(8 + 60);
    expect(long.endsWith('…')).toBe(true);
  });
});

function setup(now = NOW) {
  const notifier = new ExpoReminderNotifier({ android: true });
  const actions = new PendingReminderActions(false);
  const sync = new ReminderSync(notifier, () => now, actions);
  const ack = jest.fn(async (_id: string, _at: string) => true);
  return { notifier, actions, sync, ack };
}

describe('ReminderSync', () => {
  test('saluran bergetar, kategori tombol, dan isi notifikasi; dikabarkan ke server sekali per id dan waktu', async () => {
    const { sync, ack } = setup();
    const items = [item('a', 10, { note: 'Terminal 3' }), item('b', 20, { kind: 'task', time: '07.20' })];
    await sync.sync({ items, vibrate: true, ack });
    // Saluran: penting, suara bawaan, pola getar, layar kunci privat.
    expect(mock.channels.get(CHANNEL_REMINDER)).toMatchObject({
      importance: 6,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: REMINDER_VIBRATION,
      lockscreenVisibility: 2,
    });
    expect(mock.channels.get(CHANNEL_REMINDER_QUIET)).toMatchObject({ enableVibrate: false, importance: 6 });
    expect(mock.categories.get(REMINDER_CATEGORY)?.actions).toEqual([
      { identifier: ACTION_DONE, buttonTitle: 'Selesai', options: { opensAppToForeground: true } },
      { identifier: ACTION_SNOOZE, buttonTitle: 'Tunda 10 menit', options: { opensAppToForeground: true } },
    ]);
    expect(scheduledIds()).toEqual(['a', 'b']);
    const a = mock.scheduled.get(notificationIdOf('a'))!;
    expect(a.content).toMatchObject({
      title: 'Pengingat a',
      body: '07.00 · Terminal 3',
      categoryIdentifier: REMINDER_CATEGORY,
      data: { lokal: 'pengingat-hp', kind: 'pengingat', id: 'a', date: '2026-10-21', at: iso(10) },
    });
    expect(triggerOf('a')).toEqual({ type: 'date', date: NOW + 10 * 60_000, channelId: CHANNEL_REMINDER });
    expect(ack.mock.calls).toEqual([
      ['a', iso(10)],
      ['b', iso(20)],
    ]);
    await sync.sync({ items, vibrate: true, ack });
    expect(ack).toHaveBeenCalledTimes(2);
    // Dijadwalkan ulang tiap penyamaan (jadwal yang tersimpan bukan bukti masih terpasang).
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(4);
  });

  test('getar dimatikan: saluran tanpa getar', async () => {
    const { sync, ack } = setup();
    await sync.sync({ items: [item('a', 10)], vibrate: false, ack });
    expect(triggerOf('a').channelId).toBe(CHANNEL_REMINDER_QUIET);
  });

  test('selesai, dihapus, atau berpindah jadi alarm: jadwalnya dibatalkan; yang tampil untuk item selesai dibuang', async () => {
    const { sync, ack } = setup();
    await sync.sync({ items: [item('a', 10), item('b', 20), item('c', 30)], vibrate: true, ack });
    mock.fire(notificationIdOf('a'));
    await sync.sync({
      items: [item('a', 10, { done: true }), item('c', 30, { way: 'alarm' })],
      ranges: [{ from: '2026-10-19', to: '2026-11-01' }],
      vibrate: true,
      ack,
    });
    expect(scheduledIds()).toEqual([]);
    expect(mock.presented.size).toBe(0);
  });

  test('notifikasi yang tampil untuk item yang hilang dari rentang termuat dibuang; di luar rentang dibiarkan', async () => {
    const { sync, ack } = setup();
    await sync.sync({ items: [item('a', 10), item('b', 20, { date: '2026-12-01' })], vibrate: true, ack });
    mock.fire(notificationIdOf('a'));
    mock.fire(notificationIdOf('b'));
    await sync.sync({ items: [], ranges: [{ from: '2026-10-19', to: '2026-11-01' }], vibrate: true, ack });
    expect([...mock.presented.keys()]).toEqual([notificationIdOf('b')]);
  });

  test('izin notifikasi belum ada: tidak dijadwalkan dan TIDAK dikabarkan (WhatsApp tetap jalan)', async () => {
    const { sync, ack } = setup();
    await sync.sync({ items: [item('a', 10)], vibrate: true, ack });
    expect(scheduledIds()).toEqual(['a']);
    allow(false);
    await sync.sync({ items: [item('a', 10), item('b', 20)], vibrate: true, ack });
    expect(scheduledIds()).toEqual([]);
    expect(ack.mock.calls.map((c) => c[0])).toEqual(['a']);
    expect(sync.lastPermission).toBe('denied');
    // Diizinkan lagi: dijadwalkan dan baru dikabarkan.
    allow(true);
    await sync.sync({ items: [item('a', 10), item('b', 20)], vibrate: true, ack });
    expect(ack.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
  });

  test('saluran pengingat dimatikan di pengaturan HP: dianggap tanpa izin', async () => {
    const { notifier, sync, ack } = setup();
    await sync.sync({ items: [item('a', 10)], vibrate: true, ack });
    mock.channels.set(CHANNEL_REMINDER, { ...mock.channels.get(CHANNEL_REMINDER), importance: 2 });
    expect(await notifier.permission()).toBe('denied');
  });

  test('kabar gagal: diulang pada penyamaan berikutnya, yang berhasil tidak diulang', async () => {
    const { sync, ack } = setup();
    ack.mockResolvedValueOnce(false);
    await sync.sync({ items: [item('a', 10)], vibrate: true, ack });
    await sync.sync({ items: [item('a', 10)], vibrate: true, ack });
    await sync.sync({ items: [item('a', 10)], vibrate: true, ack });
    expect(ack).toHaveBeenCalledTimes(2);
  });

  test('clear (keluar, ganti mode): semua dibatalkan, yang tampil dibuang, tanda terima dan antrean dilupakan', async () => {
    const { sync, ack, actions } = setup();
    await sync.sync({ items: [item('a', 10), item('b', 20)], vibrate: true, ack });
    mock.fire(notificationIdOf('a'));
    await actions.put({ id: 'b', kind: 'done', title: 'B', body: '07.00', date: '2026-10-21' });
    await sync.clear();
    expect(scheduledIds()).toEqual([]);
    expect(mock.presented.size).toBe(0);
    expect(await actions.list()).toEqual([]);
    await sync.sync({ items: [item('a', 10)], vibrate: true, ack });
    expect(ack.mock.calls.filter((c) => c[0] === 'a')).toHaveLength(2);
  });
});

describe('tombol notifikasi yang belum sampai ke server', () => {
  const target = { id: 'a', title: 'Minum obat', body: '07.00 · Setelah makan', date: '2026-10-21', at: iso(0) };

  test('Selesai: notifikasi hilang, tidak dijadwalkan lagi, PATCH diulang sampai berhasil', async () => {
    const { notifier, actions, sync, ack } = setup();
    await sync.sync({ items: [item('a', 10)], vibrate: true, ack });
    mock.fire(notificationIdOf('a'));
    await reminderDone(notifier, target, actions);
    expect(mock.presented.size).toBe(0);
    const flush = jest.fn(async () => 'retry' as const);
    await sync.sync({ items: [item('a', 10)], vibrate: true, ack, flush });
    expect(scheduledIds()).toEqual([]);
    expect(flush).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', kind: 'done' }));
    expect(await actions.list()).toHaveLength(1);
    flush.mockResolvedValue('ok' as never);
    await sync.sync({ items: [item('a', 10)], vibrate: true, ack, flush });
    expect(await actions.list()).toEqual([]);
  });

  test('item sudah tidak ada di server: catatannya dibuang', async () => {
    const { notifier, actions, sync, ack } = setup();
    await reminderDone(notifier, target, actions);
    await sync.sync({ items: [], vibrate: true, ack, flush: async () => 'drop' });
    expect(await actions.list()).toEqual([]);
  });

  test('Tunda 10 menit: dari yang lebih akhir antara saat berbunyi dan sekarang; tetap terjadwal walau server belum tahu', async () => {
    const { notifier, actions, sync, ack } = setup(NOW + 25 * 60_000);
    // Berbunyi 07.00 (00:00Z), ditekan 07.25: muncul lagi 07.35, bukan 07.10.
    const at = await reminderSnooze(notifier, target, { vibrate: true, tz: 420, now: NOW + 25 * 60_000, actions });
    expect(at).toBe(NOW + 35 * 60_000);
    expect(triggerOf('a')).toMatchObject({ date: NOW + 35 * 60_000 });
    expect(mock.scheduled.get(notificationIdOf('a'))!.content.body).toBe('07.35 · Setelah makan');
    const flush = jest.fn(async () => 'retry' as const);
    // Server masih menyebut waktu lama (sudah lewat): tundaan tetap dijadwalkan, tanpa tanda terima.
    await sync.sync({ items: [item('a', 0)], vibrate: true, ack, flush });
    expect(triggerOf('a')).toMatchObject({ date: NOW + 35 * 60_000 });
    expect(ack).not.toHaveBeenCalled();
    // Server akhirnya menerima: catatan dihapus dan tundaannya dikabarkan.
    flush.mockResolvedValue('ok' as never);
    await sync.sync({ items: [item('a', 0)], vibrate: true, ack, flush });
    expect(await actions.list()).toEqual([]);
    expect(ack.mock.calls).toEqual([['a', iso(35)]]);
  });
});

describe('dipasang di akar (ReminderHost)', () => {
  // 09.41 WIB, Senin 20 Okt 2025 (hari contoh): tugas a3 (15.00) dan a7 (Rabu 08.30) diingatkan lewat notifikasi.
  const SAMPLE_NOW = Date.parse('2025-10-20T02:41:00.000Z');
  beforeEach(() => {
    jest.setSystemTime(SAMPLE_NOW);
    setReminderNotifier(new ExpoReminderNotifier({ android: true }));
  });
  afterEach(() => jest.useFakeTimers({ now: Date.now() }));

  async function settle() {
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        jest.advanceTimersByTime(0);
      });
    }
  }

  /**
   * `rerender` dari testing-library membuang provider `renderWithProviders`, jadi akarnya dirender ulang lewat state:
   * `useLastNotificationResponse` tiruan dibaca lagi dengan jawaban yang baru dipasang `respond`.
   */
  let bump: () => void = () => {};
  function Host({ tap = false }: { tap?: boolean }) {
    const [, setTick] = useState(0);
    bump = () => setTick((n) => n + 1);
    return (
      <>
        <ReminderHost />
        {tap ? <PushTapHandler /> : null}
      </>
    );
  }
  async function rerender() {
    await act(async () => bump());
  }

  function respond(id: string, action: string) {
    const request = mock.scheduled.get(notificationIdOf(id)) ?? mock.presented.get(notificationIdOf(id))?.request;
    if (!request) throw new Error(`tidak ada notifikasi ${id}`);
    jest.mocked(Notifications.useLastNotificationResponse).mockReturnValue({
      actionIdentifier: action,
      notification: { date: Date.now(), request },
    } as never);
  }

  test('pengingat agenda dijadwalkan dan dikabarkan; alarm dan telepon tidak', async () => {
    const api = createTestApi();
    await renderWithProviders(<ReminderHost />, { api });
    await settle();
    expect(scheduledIds()).toEqual(['a3', 'a7']);
    expect(triggerOf('a3').date).toBe(Date.parse('2025-10-20T08:00:00.000Z'));
    expect(api.transport.alarmAcks.map((a) => a.id)).toEqual(['a3', 'a7']);
  });

  test('Selesai (aplikasi dibuka dari notifikasi): notifikasi hilang, PATCH done, toast, Agenda di item itu', async () => {
    const api = createTestApi();
    await renderWithProviders(<Host />, { api });
    await settle();
    mock.fire(notificationIdOf('a3'));
    respond('a3', ACTION_DONE);
    await rerender();
    await settle();
    expect(mock.presented.size).toBe(0);
    expect(api.transport.sample.getState().agenda.find((a) => a.id === 'a3')?.done).toBe(true);
    expect(scheduledIds()).toEqual(['a7']);
    expect(toastNow()?.text).toBe('Ditandai selesai.');
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/agenda', params: { id: 'a3', tanggal: '2025-10-20' } });
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
    // Jawaban yang sama tidak dijalankan dua kali.
    await rerender();
    await settle();
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  test('Tunda 10 menit: dijadwalkan lagi di HP, PATCH snoozeUntil, toast menyebut jamnya', async () => {
    const api = createTestApi();
    await renderWithProviders(<Host />, { api });
    await settle();
    jest.setSystemTime(Date.parse('2025-10-20T08:00:00.000Z'));
    mock.fire(notificationIdOf('a3'));
    respond('a3', ACTION_SNOOZE);
    await rerender();
    await settle();
    expect(triggerOf('a3').date).toBe(Date.parse('2025-10-20T08:10:00.000Z'));
    expect(api.transport.sample.getState().agenda.find((a) => a.id === 'a3')?.snoozedUntil).toBe(
      '2025-10-20T08:10:00.000Z',
    );
    expect(toastNow()?.text).toBe('Ditunda sampai 15.10.');
    expect(api.transport.alarmAcks.filter((a) => a.id === 'a3').map((a) => a.scheduledFor)).toEqual([
      '2025-10-20T08:00:00.000Z',
      '2025-10-20T08:10:00.000Z',
    ]);
  });

  test('tanpa internet: Selesai tetap berlaku di HP, PATCH diulang saat aplikasi kembali ke depan', async () => {
    const listeners: ((s: string) => void)[] = [];
    jest.mocked(AppState.addEventListener).mockImplementation(((_: string, cb: (s: string) => void) => {
      listeners.push(cb);
      return { remove: jest.fn() };
    }) as never);
    const api = createTestApi();
    await renderWithProviders(<Host />, { api });
    await settle();
    mock.fire(notificationIdOf('a3'));
    const patch = jest
      .spyOn(api.transport, 'agendaPatch')
      .mockRejectedValue(new ApiFailure('network', { cause: new Error('tanpa sinyal') }));
    respond('a3', ACTION_DONE);
    await rerender();
    await settle();
    expect(mock.presented.size).toBe(0);
    expect(scheduledIds()).toEqual(['a7']);
    expect(api.transport.sample.getState().agenda.find((a) => a.id === 'a3')?.done).toBeUndefined();
    expect(patch).toHaveBeenCalled();
    // Sinyal kembali.
    patch.mockRestore();
    await act(async () => listeners.forEach((l) => l('active')));
    await settle();
    expect(api.transport.sample.getState().agenda.find((a) => a.id === 'a3')?.done).toBe(true);
  });

  test('ketukan biasa membuka Agenda di item itu; penangan push tidak membuka chat untuknya', async () => {
    await renderWithProviders(<Host tap />);
    await settle();
    respond('a7', Notifications.DEFAULT_ACTION_IDENTIFIER);
    await rerender();
    await settle();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/agenda', params: { id: 'a7', tanggal: '2025-10-22' } });
  });

  test('mode server tanpa sesi (dibuka dari notifikasi setelah sesi habis): tombol berlaku di HP, tanpa membuka Agenda', async () => {
    // Notifikasi dari sesi sebelumnya masih tampil.
    await new ExpoReminderNotifier({ android: true }).schedule({
      id: 'x1',
      at: Date.now() + 60_000,
      title: 'Rapat pagi',
      body: '10.00',
      date: '2025-10-20',
      vibrate: true,
    });
    mock.fire(notificationIdOf('x1'));
    respond('x1', ACTION_DONE);
    await renderWithProviders(<ReminderHost />, { api: createTestApi({ mode: 'server' }) });
    await settle();
    expect(mock.presented.size).toBe(0);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
