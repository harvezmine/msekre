import {
  agendaItemSchema,
  agendaParseResSchema,
  agendaPatchReqSchema,
  agendaResSchema,
  alarmAckReqSchema,
  streamEventSchema,
  type AgendaItem,
  type StreamEvent,
} from '@/api/contract';
import { FakeTransport } from '@/api/fake/FakeTransport';
import { createMemorySession } from '@/api/session';

function setup() {
  const transport = new FakeTransport(createMemorySession(null));
  const events: StreamEvent[] = [];
  transport.subscribe(
    (e) => e.type === 'agenda' && events.push(e),
    () => {},
  );
  return { transport, events };
}
const settle = () => jest.advanceTimersByTimeAsync(0);

describe('kontrak agenda', () => {
  const item = {
    id: 'a1',
    date: '2026-10-21',
    time: '07.00',
    at: '2026-10-21T00:00:00.000Z',
    title: 'Berangkat',
    kind: 'reminder',
  };
  test('item sah; tanggal, jam, jenis, dan cara yang salah ditolak', () => {
    expect(agendaItemSchema.safeParse(item).success).toBe(true);
    expect(agendaItemSchema.safeParse({ ...item, way: 'notif', allDay: false, snoozedUntil: item.at }).success).toBe(
      true,
    );
    for (const bad of [
      { date: '21-10-2026' },
      { date: '2026-13-01' },
      { time: '7.00' },
      { time: '24.00' },
      { at: '2026-10-21 07:00' },
      { kind: 'baru' },
      { way: 'sms' },
      { title: '   ' },
    ]) {
      expect(agendaItemSchema.safeParse({ ...item, ...bad }).success).toBe(false);
    }
  });
  test('ubah butuh minimal satu bidang dan tidak menerima bidang asing; tanda terima butuh ISO', () => {
    expect(agendaPatchReqSchema.safeParse({}).success).toBe(false);
    expect(agendaPatchReqSchema.safeParse({ done: true, extra: 1 }).success).toBe(false);
    expect(agendaPatchReqSchema.safeParse({ snoozeUntil: item.at }).success).toBe(true);
    expect(alarmAckReqSchema.safeParse({ scheduledFor: '07.00' }).success).toBe(false);
  });
  test('event agenda: rev wajib, semua bidang lain opsional', () => {
    expect(streamEventSchema.safeParse({ type: 'agenda', rev: 3 }).success).toBe(true);
    expect(
      streamEventSchema.safeParse({ type: 'agenda', items: [item], removed: ['x'], leftover: null, rev: 3 }).success,
    ).toBe(true);
    expect(streamEventSchema.safeParse({ type: 'agenda', items: [item] }).success).toBe(false);
  });
});

describe('agenda di server tiruan', () => {
  test('GET tanpa rentang: Senin pekan ini sampai Minggu pekan depan, urut, dengan hari ini dan jam server', async () => {
    const { transport } = setup();
    const res = await transport.agenda();
    expect(agendaResSchema.safeParse(res).success).toBe(true);
    expect(res).toMatchObject({ from: '2025-10-20', to: '2025-11-02', today: '2025-10-20', now: '09.41' });
    expect(res.items.map((i) => i.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a10', 'a6', 'a7', 'a8', 'a9', 'a11']);
    expect(res.leftover).toMatchObject({ id: 'l1', kind: 'task', date: '2025-10-19' });
    expect(Date.parse(res.items[0]!.at)).toBe(Date.parse('2025-10-20T02:00:00.000Z'));
  });

  test('rentang sendiri; terbalik atau bukan tanggal ditolak', async () => {
    const { transport } = setup();
    const res = await transport.agenda({ from: '2025-10-22', to: '2025-10-23' });
    expect(res.items.map((i) => i.id)).toEqual(['a7', 'a8']);
    await expect(transport.agenda({ from: '2025-10-23', to: '2025-10-22' })).rejects.toMatchObject({
      error: 'tidak_valid',
    });
    await expect(transport.agenda({ from: 'kemarin', to: '2025-10-22' })).rejects.toMatchObject({
      error: 'tidak_valid',
    });
  });

  test('item tunggal; yang tidak ada tidak_ditemukan', async () => {
    const { transport } = setup();
    expect((await transport.agendaItem('a10')).title).toBe('Berangkat ke bandara');
    await expect(transport.agendaItem('zzz')).rejects.toMatchObject({ status: 404, error: 'tidak_ditemukan' });
  });

  test('rapat bernotulen membawa notesMessageId, bukan catatan', async () => {
    const { transport } = setup();
    const a1 = await transport.agendaItem('a1');
    expect(a1.notesMessageId).toBeTruthy();
    expect(a1.note).toBeUndefined();
  });

  test('parse: server membaca kalimatnya; kosong ditolak', async () => {
    const { transport } = setup();
    const res = await transport.agendaParse('Ingatkan saya bayar pajak motor tanggal 25');
    expect(agendaParseResSchema.safeParse(res).success).toBe(true);
    expect(res.preview.guessedTime).toBe(true);
    expect(res.preview.item).toMatchObject({
      title: 'Bayar pajak motor',
      date: '2025-10-25',
      time: '09.00',
      kind: 'reminder',
      way: 'alarm',
    });
    expect(res.preview.item.at).toBe('2025-10-25T02:00:00.000Z');
    await expect(transport.agendaParse('   ')).rejects.toMatchObject({ error: 'tidak_valid' });
  });

  test('tambah menyimpan di data bersama dan menyiarkan satu event dengan rev naik', async () => {
    const { transport, events } = setup();
    const before = (await transport.agenda()).rev;
    const { preview } = await transport.agendaParse('Cek stok gudang jam 14.00');
    const saved = await transport.agendaAdd(preview.item);
    await settle();
    expect(saved).toMatchObject({ title: 'Cek stok gudang', time: '14.00', kind: 'task' });
    expect(transport.sample.getState().agenda.some((a) => a.id === saved.id)).toBe(true);
    expect(events).toEqual([{ type: 'agenda', items: [saved], rev: before + 1 }]);
    await expect(transport.agendaAdd({ ...preview.item, date: 'besok' })).rejects.toMatchObject({
      error: 'tidak_valid',
    });
  });

  test('ubah: selesai dan tunda; menyiarkan item yang berubah', async () => {
    const { transport, events } = setup();
    const done = await transport.agendaPatch('a3', { done: true });
    expect(done.done).toBe(true);
    const snoozed = await transport.agendaPatch('a10', { snoozeUntil: '2025-10-21T00:10:00.000Z' });
    expect(snoozed.snoozedUntil).toBe('2025-10-21T00:10:00.000Z');
    await settle();
    expect(events.map((e) => e.type === 'agenda' && e.items?.map((i) => i.id))).toEqual([['a3'], ['a10']]);
    expect((await transport.agendaPatch('a3', { done: false })).done).toBeUndefined();
    await expect(transport.agendaPatch('zzz', { done: true })).rejects.toMatchObject({
      error: 'tidak_ditemukan',
    });
    await expect(transport.agendaPatch('a3', {})).rejects.toMatchObject({ error: 'tidak_valid' });
  });

  test('sisa kemarin: dikerjakan hari ini menjadi item baru; dilepas hilang; event membawa leftover', async () => {
    const { transport, events } = setup();
    const created = (await transport.agendaLeftover('today')) as AgendaItem;
    await settle();
    expect(created).toMatchObject({ title: 'Kirim penawaran katering ke Bu Sari', date: '2025-10-20', time: '17.00' });
    expect(events[0]).toMatchObject({ items: [{ id: created.id }], leftover: null });
    expect((await transport.agenda()).leftover).toBeNull();
    await expect(transport.agendaLeftover('drop')).rejects.toMatchObject({ error: 'tidak_ditemukan' });
  });

  test('sisa kemarin dilepas: event hanya membawa leftover null', async () => {
    const { transport, events } = setup();
    expect(await transport.agendaLeftover('drop')).toBeNull();
    await settle();
    expect(events).toEqual([{ type: 'agenda', leftover: null, rev: 2 }]);
  });

  test('tanda terima alarm dicatat; item yang tidak ada atau waktu salah ditolak', async () => {
    const { transport } = setup();
    await transport.agendaAlarmAck('a10', '2025-10-21T00:00:00.000Z');
    expect(transport.alarmAcks).toEqual([{ id: 'a10', scheduledFor: '2025-10-21T00:00:00.000Z' }]);
    await expect(transport.agendaAlarmAck('zzz', '2025-10-21T00:00:00.000Z')).rejects.toMatchObject({
      error: 'tidak_ditemukan',
    });
    await expect(transport.agendaAlarmAck('a10', '07.00')).rejects.toMatchObject({ error: 'tidak_valid' });
  });

  test('perubahan yang tidak menyentuh agenda tidak menyiarkan apa-apa', async () => {
    const { transport, events } = setup();
    transport.sample.dispatch({ type: 'setAc', on: false });
    await settle();
    expect(events).toHaveLength(0);
  });
});
