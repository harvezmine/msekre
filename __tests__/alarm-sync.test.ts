import type { AgendaItem } from '@/api/contract';
import { MemoryAlarmScheduler } from '@/alarm';
import { ALARM_HORIZON_MS, AlarmSync, desiredAlarms } from '@/alarm/sync';
import { TEST_ALARM_ID } from '@/alarm/testAlarm';

const NOW = Date.parse('2026-10-21T00:00:00.000Z');
const iso = (offsetMin: number) => new Date(NOW + offsetMin * 60_000).toISOString();

function item(id: string, offsetMin: number, extra: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id,
    date: '2026-10-21',
    time: '07.00',
    at: iso(offsetMin),
    title: `Pengingat ${id}`,
    kind: 'reminder',
    way: 'alarm',
    ...extra,
  };
}

describe('desiredAlarms', () => {
  test('hanya pengingat atau berulang bercara alarm, belum selesai, bukan sepanjang hari, dalam 7 hari ke depan', () => {
    const items = [
      item('ok', 10),
      item('berulang', 20, { kind: 'recurring' }),
      item('tugas', 10, { kind: 'task' }),
      item('rapat', 10, { kind: 'meeting' }),
      item('telepon', 10, { way: 'call' }),
      item('notif', 10, { way: 'notif' }),
      item('tanpa-cara', 10, { way: undefined }),
      item('selesai', 10, { done: true }),
      item('seharian', 10, { allDay: true }),
      item('lewat', -5),
      item('kini', 0),
      item('terlalu-jauh', ALARM_HORIZON_MS / 60_000 + 1),
      item('batas', ALARM_HORIZON_MS / 60_000),
      item('rusak', 10, { at: 'bukan-waktu' as never }),
    ];
    expect(desiredAlarms(items, NOW).map((d) => d.id)).toEqual(['ok', 'berulang', 'batas']);
  });

  test('ditunda: memakai waktu tundaan, bukan waktu semula; tundaan yang sudah lewat tidak dijadwalkan', () => {
    const items = [
      item('tunda', -30, { snoozedUntil: iso(10) }),
      item('tunda-lewat', 30, { snoozedUntil: iso(-1) }),
      item('catatan', 5, { note: 'Terminal 3' }),
    ];
    const out = desiredAlarms(items, NOW);
    expect(out.map((d) => [d.id, d.at])).toEqual([
      ['catatan', NOW + 5 * 60_000],
      ['tunda', NOW + 10 * 60_000],
    ]);
    expect(out[0]).toMatchObject({ title: 'Pengingat catatan', note: 'Terminal 3' });
  });
});

describe('AlarmSync', () => {
  function setup(now = NOW) {
    const scheduler = new MemoryAlarmScheduler({ native: true });
    const ack = jest.fn(async (_id: string, _at: string) => true);
    const sync = new AlarmSync(scheduler, () => now);
    return { scheduler, ack, sync };
  }
  const ids = async (s: MemoryAlarmScheduler) => (await s.list()).map((a) => a.id);

  test('menjadwalkan yang baru dan mengabarkan server sekali per id dan waktu', async () => {
    const { scheduler, ack, sync } = setup();
    const items = [item('a', 10), item('b', 20)];
    await sync.sync(items, ack);
    expect(await ids(scheduler)).toEqual(['a', 'b']);
    expect(ack.mock.calls).toEqual([
      ['a', iso(10)],
      ['b', iso(20)],
    ]);
    await sync.sync(items, ack);
    await sync.sync(items, ack);
    expect(ack).toHaveBeenCalledTimes(2);
  });

  test('yang tidak berubah tidak dijadwalkan ulang', async () => {
    const { scheduler, ack, sync } = setup();
    const spy = jest.spyOn(scheduler, 'schedule');
    await sync.sync([item('a', 10)], ack);
    await sync.sync([item('a', 10)], ack);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('ditunda: dijadwalkan ulang di waktu baru dan dikabarkan lagi', async () => {
    const { scheduler, ack, sync } = setup();
    await sync.sync([item('a', 10)], ack);
    await sync.sync([item('a', 10, { snoozedUntil: iso(20) })], ack);
    expect(await scheduler.list()).toMatchObject([{ id: 'a', at: NOW + 20 * 60_000 }]);
    expect(ack.mock.calls.map((c) => c[1])).toEqual([iso(10), iso(20)]);
  });

  test('selesai, dihapus, atau lewat 7 hari: dibatalkan', async () => {
    const { scheduler, ack, sync } = setup();
    await sync.sync([item('a', 10), item('b', 20), item('c', 30)], ack);
    await sync.sync([item('a', 10, { done: true }), item('c', 30)], ack);
    expect(await ids(scheduler)).toEqual(['c']);
    await sync.sync([], ack);
    expect(await ids(scheduler)).toEqual([]);
  });

  test('alarm percobaan tidak disentuh', async () => {
    const { scheduler, ack, sync } = setup();
    await scheduler.schedule({ id: TEST_ALARM_ID, at: NOW + 60_000, title: 'Alarm percobaan' });
    await sync.sync([item('a', 10)], ack);
    await sync.sync([], ack);
    expect(await ids(scheduler)).toEqual([TEST_ALARM_ID]);
    await sync.clear();
    expect(await ids(scheduler)).toEqual([TEST_ALARM_ID]);
  });

  test('izin alarm tepat waktu belum ada: tidak terjadwal dan TIDAK dikabarkan (WhatsApp tetap jalan)', async () => {
    const { scheduler, ack, sync } = setup();
    scheduler.statusValue = { ...scheduler.statusValue, exact: 'denied' };
    await sync.sync([item('a', 10)], ack);
    expect(await ids(scheduler)).toEqual([]);
    expect(ack).not.toHaveBeenCalled();
    // Izin sudah diberikan: sinkron berikutnya menjadwalkan dan mengabarkan.
    scheduler.statusValue = { ...scheduler.statusValue, exact: 'granted' };
    await sync.sync([item('a', 10)], ack);
    expect(await ids(scheduler)).toEqual(['a']);
    expect(ack).toHaveBeenCalledTimes(1);
  });

  test('kabar ke server gagal: dicoba lagi pada sinkron berikutnya, tanpa menjadwalkan ulang', async () => {
    const { scheduler, sync } = setup();
    const spy = jest.spyOn(scheduler, 'schedule');
    const ack = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    await sync.sync([item('a', 10)], ack);
    await sync.sync([item('a', 10)], ack);
    await sync.sync([item('a', 10)], ack);
    expect(ack).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('panggilan bersamaan digabung: yang terakhir dijalankan sekali setelah yang berjalan', async () => {
    const { scheduler, ack, sync } = setup();
    const spy = jest.spyOn(scheduler, 'list');
    const first = sync.sync([item('a', 10)], ack);
    void sync.sync([item('b', 10)], ack);
    const last = sync.sync([item('c', 10)], ack);
    await Promise.all([first, last]);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(await ids(scheduler)).toEqual(['c']);
  });

  test('clear membatalkan semua dan melupakan tanda terima', async () => {
    const { scheduler, ack, sync } = setup();
    await sync.sync([item('a', 10)], ack);
    await sync.clear();
    expect(await ids(scheduler)).toEqual([]);
    await sync.sync([item('a', 10)], ack);
    expect(ack).toHaveBeenCalledTimes(2);
  });
});
