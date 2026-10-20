import { AgendaController } from '@/api/agendaController';
import { ERROR_TEXT } from '@/api/errors';
import { FakeTransport } from '@/api/fake/FakeTransport';
import { createMemorySession } from '@/api/session';

const settle = () => jest.advanceTimersByTimeAsync(0);

async function setup() {
  const transport = new FakeTransport(createMemorySession(null));
  const controller = new AgendaController(transport);
  controller.start();
  await settle();
  return { transport, controller, state: () => controller.getState() };
}

test('memuat rentang bawaan, hari ini, dan sisa kemarin', async () => {
  const { controller, state } = await setup();
  expect(state()).toMatchObject({ status: 'ready', today: '2025-10-20', now: '09.41', error: null });
  expect(state().items).toHaveLength(11);
  expect(state().leftover?.id).toBe('l1');
  expect(state().ranges).toEqual([{ from: '2025-10-20', to: '2025-11-02' }]);
  controller.stop();
});

test('gagal memuat sebelum ada isi: status error dengan teks ramah, lalu bisa dicoba lagi', async () => {
  const transport = new FakeTransport(createMemorySession(null));
  transport.failNext('network');
  const controller = new AgendaController(transport);
  controller.start();
  await settle();
  expect(controller.getState()).toMatchObject({ status: 'error', error: ERROR_TEXT, today: null });
  await controller.load();
  expect(controller.getState().status).toBe('ready');
  controller.stop();
});

test('gagal memuat ulang tidak menghapus agenda yang sudah tampil', async () => {
  const { transport, controller, state } = await setup();
  transport.failNext('network');
  await controller.load();
  expect(state().status).toBe('ready');
  expect(state().items).toHaveLength(11);
  controller.stop();
});

test('rentang lain dimuat sekali dan digabung; rentang yang sudah tercakup tidak diminta lagi', async () => {
  const { transport, controller, state } = await setup();
  const spy = jest.spyOn(transport, 'agenda');
  expect(await controller.ensureRange('2025-10-21', '2025-10-25')).toBeNull();
  expect(spy).not.toHaveBeenCalled();
  transport.sample.dispatch({
    type: 'addAgenda',
    item: { date: '2025-11-10', time: '10.00', title: 'Bayar sewa', kind: 'reminder' },
  });
  await settle();
  expect(await controller.ensureRange('2025-11-01', '2025-11-30')).toBeNull();
  expect(spy).toHaveBeenCalledTimes(1);
  expect(state().items.some((i) => i.title === 'Bayar sewa')).toBe(true);
  expect(state().ranges).toEqual([{ from: '2025-10-20', to: '2025-11-30' }]);
  transport.failNext('network');
  expect(await controller.ensureRange('2026-01-01', '2026-01-31')).toBe(ERROR_TEXT);
  controller.stop();
});

test('event agenda menambah, mengubah, dan membuang; rev yang lebih lama dibuang', async () => {
  const { transport, controller, state } = await setup();
  transport.sample.dispatch({ type: 'setDone', id: 'a3', done: true });
  await settle();
  expect(state().items.find((i) => i.id === 'a3')?.done).toBe(true);
  const rev = state().rev;
  expect(rev).toBe(2);
  // Event usang (rev lebih kecil) tidak menimpa.
  transport.sample.dispatch({ type: 'setDone', id: 'a3', done: false });
  await settle();
  expect(state().items.find((i) => i.id === 'a3')?.done).toBeUndefined();
  expect(state().rev).toBe(3);
  controller.stop();
});

test('toggle langsung berubah, memanggil server, dan kembali bila gagal', async () => {
  const { transport, controller, state } = await setup();
  const seen: (boolean | undefined)[] = [];
  controller.subscribe(() => seen.push(state().items.find((i) => i.id === 'a3')?.done));
  expect(await controller.toggle('a3')).toBeNull();
  expect(seen[0]).toBe(true);
  expect(state().items.find((i) => i.id === 'a3')?.done).toBe(true);
  transport.failNext('network');
  expect(await controller.toggle('a3')).toBe(ERROR_TEXT);
  expect(state().items.find((i) => i.id === 'a3')?.done).toBe(true);
  expect(await controller.toggle('tidak-ada')).toBeNull();
  controller.stop();
});

test('tunda memakai jawaban server; sisa kemarin dikerjakan atau dilepas', async () => {
  const { controller, state } = await setup();
  expect(await controller.snooze('a10', '2025-10-21T00:10:00.000Z')).toBeNull();
  expect(state().items.find((i) => i.id === 'a10')?.snoozedUntil).toBe('2025-10-21T00:10:00.000Z');
  expect(await controller.resolveLeftover('today')).toBeNull();
  expect(state().leftover).toBeNull();
  expect(state().items.some((i) => i.title === 'Kirim penawaran katering ke Bu Sari' && i.date === '2025-10-20')).toBe(
    true,
  );
  controller.stop();
});

test('item di luar rentang diambil dari server sekali; yang tidak ada: null', async () => {
  const { transport, controller, state } = await setup();
  transport.sample.dispatch({
    type: 'addAgenda',
    item: { date: '2026-03-01', time: '10.00', title: 'Jauh', kind: 'reminder' },
  });
  const id = transport.sample.getState().agenda.at(-1)!.id;
  await settle();
  const spy = jest.spyOn(transport, 'agendaItem');
  // Event membawa item itu walau di luar rentang, jadi sudah dikenal tanpa bertanya.
  expect((await controller.item(id))?.title).toBe('Jauh');
  expect(spy).not.toHaveBeenCalled();
  expect(await controller.item('zzz')).toBeNull();
  expect(state().items.some((i) => i.id === 'zzz')).toBe(false);
  controller.stop();
});

test('tambah memakai item pratinjau; pratinjau gagal memberi teks ramah', async () => {
  const { transport, controller, state } = await setup();
  const res = await controller.preview('Ingatkan saya minum obat jam 8 malam');
  expect(res).toMatchObject({ ok: true, guessedTime: false, item: { time: '20.00' } });
  if (!res.ok) throw new Error('pratinjau gagal');
  expect(await controller.add(res.item)).toBeNull();
  expect(state().items.some((i) => i.title === 'Minum obat')).toBe(true);
  transport.failNext('server');
  expect(await controller.preview('apa saja')).toEqual({ ok: false, error: ERROR_TEXT });
  expect(await controller.ackAlarm('a10', '2025-10-21T00:00:00.000Z')).toBe(true);
  expect(await controller.ackAlarm('zzz', '2025-10-21T00:00:00.000Z')).toBe(false);
  controller.stop();
});

test('setelah stop, event tidak mengubah keadaan', async () => {
  const { transport, controller, state } = await setup();
  controller.stop();
  const before = state();
  transport.sample.dispatch({ type: 'setDone', id: 'a3', done: true });
  await settle();
  expect(state()).toBe(before);
});

test('event dengan rev lebih lama dari yang dipegang dibuang; yang lebih baru dipakai', async () => {
  const transport = new FakeTransport(createMemorySession(null));
  let emit: (e: Parameters<Parameters<typeof transport.subscribe>[0]>[0]) => void = () => {};
  jest.spyOn(transport, 'subscribe').mockImplementation((onEvent) => {
    emit = onEvent;
    return () => {};
  });
  const controller = new AgendaController(transport);
  controller.start();
  await settle();
  const a3 = controller.getState().items.find((i) => i.id === 'a3')!;
  emit({ type: 'agenda', items: [{ ...a3, done: true }], rev: 5 });
  expect(controller.getState().rev).toBe(5);
  emit({ type: 'agenda', items: [{ ...a3, title: 'Usang' }], removed: ['a2'], rev: 4 });
  expect(controller.getState().items.find((i) => i.id === 'a3')).toMatchObject({ title: a3.title, done: true });
  expect(controller.getState().items.some((i) => i.id === 'a2')).toBe(true);
  emit({ type: 'agenda', removed: ['a2'], leftover: null, rev: 6 });
  expect(controller.getState().items.some((i) => i.id === 'a2')).toBe(false);
  expect(controller.getState().leftover).toBeNull();
  controller.stop();
});
