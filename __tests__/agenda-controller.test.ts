import { AgendaController } from '@/api/agendaController';
import type { AgendaItem } from '@/api/contract';
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

test('event masuk selagi memuat: jawaban muat yang lebih lama dibuang, keadaan tidak mundur, lalu dimuat sekali lagi', async () => {
  const { transport, controller, state } = await setup();
  const older = await transport.agenda();
  let release!: (res: typeof older) => void;
  const spy = jest.spyOn(transport, 'agenda').mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const loading = controller.load();
  transport.sample.dispatch({ type: 'setDone', id: 'a3', done: true });
  await settle();
  expect(state().items.find((i) => i.id === 'a3')?.done).toBe(true);
  const rev = state().rev;
  release(older);
  await loading;
  // Jawaban lama tidak menimpa perubahan yang lebih baru, `rev` tidak turun, dan server ditanya sekali lagi.
  expect(state().items.find((i) => i.id === 'a3')?.done).toBe(true);
  expect(state().rev).toBe(rev);
  expect(spy).toHaveBeenCalledTimes(2);
  controller.stop();
});

test('rentang lain yang dimuat selagi ada event: jawaban lama dibuang, rentangnya tidak dianggap termuat', async () => {
  const { transport, controller, state } = await setup();
  const older = await transport.agenda({ from: '2025-11-03', to: '2025-11-30' });
  let release!: (res: typeof older) => void;
  const spy = jest.spyOn(transport, 'agenda').mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const ensuring = controller.ensureRange('2025-11-03', '2025-11-30');
  transport.sample.dispatch({ type: 'setDone', id: 'a3', done: true });
  await settle();
  release(older);
  expect(await ensuring).toBeNull();
  // Diminta lagi, dan sekarang sama baru dengan event.
  expect(spy).toHaveBeenCalledTimes(2);
  expect(state().ranges).toEqual([{ from: '2025-10-20', to: '2025-11-30' }]);
  controller.stop();
});

describe('jam dan rentang yang berjalan sendiri', () => {
  /** Server palsu: jamnya berjalan seperti jam sungguhan dari (today, now); rentang apa adanya. */
  function stub(today: string, now: string, rev = 1) {
    const startedAt = Date.now();
    const [h, m] = now.split('.').map(Number);
    const agenda = jest.fn(async (range?: { from: string; to: string }) => {
      const total = h! * 60 + m! + Math.floor((Date.now() - startedAt) / 60_000);
      const days = Math.floor(total / 1440);
      const minutes = total % 1440;
      const day = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        items: [] as AgendaItem[],
        leftover: null,
        from: range?.from ?? '2025-10-20',
        to: range?.to ?? '2025-11-02',
        today: day,
        now: `${pad(Math.floor(minutes / 60))}.${pad(minutes % 60)}`,
        tzOffsetMinutes: 480,
        rev,
      };
    });
    const transport = { subscribe: () => () => {}, agenda } as unknown as FakeTransport;
    return { agenda, controller: new AgendaController(transport) };
  }

  test('jam "sekarang" maju sendiri tiap menit, dan zona waktu pengguna ikut dari server', async () => {
    const { controller } = stub('2025-10-20', '09.41');
    controller.start();
    await settle();
    expect(controller.getState()).toMatchObject({ today: '2025-10-20', now: '09.41', tzOffsetMinutes: 480 });
    await jest.advanceTimersByTimeAsync(60_000);
    expect(controller.getState().now).toBe('09.42');
    await jest.advanceTimersByTimeAsync(18 * 60_000);
    expect(controller.getState().now).toBe('10.00');
    controller.stop();
  });

  test('lewat tengah malam: hari ini berganti dan rentangnya dimuat ulang', async () => {
    const { controller, agenda } = stub('2025-10-20', '23.58');
    controller.start();
    await settle();
    expect(agenda).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(3 * 60_000);
    expect(controller.getState()).toMatchObject({ today: '2025-10-21', now: '00.01' });
    expect(agenda).toHaveBeenCalledTimes(2);
    controller.stop();
  });

  test('pergantian pekan: muat ulang selalu menyertakan rentang bawaan (pekan ini dan depan) bersama rentang yang sudah ada', async () => {
    // Minggu 26 Okt 2025, 23.59: pekan ini mulai Senin 20 Okt; sebentar lagi pekan baru.
    const { controller, agenda } = stub('2025-10-26', '23.59');
    controller.start();
    await settle();
    expect(agenda).toHaveBeenLastCalledWith(undefined);
    await jest.advanceTimersByTimeAsync(2 * 60_000);
    expect(controller.getState().today).toBe('2025-10-27');
    // Senin 27 Okt: bawaan 27 Okt sampai 9 Nov, digabung dengan yang sudah dimuat (20 Okt sampai 2 Nov).
    expect(agenda).toHaveBeenLastCalledWith({ from: '2025-10-20', to: '2025-11-09' });
    controller.stop();
  });

  test('rentang bulan yang dibuka di Kalender ikut dimuat ulang bersama rentang bawaan', async () => {
    const { controller, agenda } = stub('2025-10-20', '09.41');
    controller.start();
    await settle();
    await controller.ensureRange('2026-01-01', '2026-01-31');
    agenda.mockClear();
    await controller.load();
    expect(agenda.mock.calls.map((c) => c[0])).toEqual([
      { from: '2025-10-20', to: '2025-11-02' },
      { from: '2026-01-01', to: '2026-01-31' },
    ]);
    controller.stop();
  });
});
