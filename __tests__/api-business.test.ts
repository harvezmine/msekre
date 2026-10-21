import { businessSchema, streamEventSchema } from '@/api/contract';
import { changeText, hasBusinessData, mimeOfName, stockLeft } from '@/api/business';
import { BusinessController, businessKey } from '@/api/businessController';
import { parseBusinessLenient, parseEventLenient } from '@/api/lenient';
import { businessFrom } from '@/api/fake/business';
import { FakeTransport } from '@/api/fake/FakeTransport';
import { createMemorySession } from '@/api/session';
import { ApiFailure } from '@/api/transport';

const none = () => undefined;
const sample = () => ({ ...businessFrom('Semua', 'hari', none), rev: 3 });

test('jawaban server tiruan memenuhi skema kontrak untuk semua tempat dan rentang', () => {
  for (const place of ['Semua', 'Kedai Dago', 'Kedai Riau', 'Rumah'])
    for (const period of ['hari', 'minggu', 'bulan'] as const)
      expect(businessSchema.safeParse({ ...businessFrom(place, period, none), rev: 1 }).success).toBe(true);
});

test('pembacaan longgar membuang baris rusak dan menerima saluran, status, dan sumber baru', () => {
  const raw = {
    ...sample(),
    moneyIn: [{ id: 'x' }, ...sample().moneyIn],
    orders: [{ ...sample().orders[0], channel: 'kanal_baru', status: 'status_baru' }, { oops: true }],
    sources: [{ key: 'baru', label: 'Baru', connected: false }, 5],
    report: { name: 'tanpa media' },
  };
  const b = parseBusinessLenient(raw)!;
  expect(b.moneyIn).toHaveLength(2);
  expect(b.orders).toEqual([expect.objectContaining({ channel: 'kanal_baru', status: 'status_baru' })]);
  expect(b.sources).toEqual([{ key: 'baru', label: 'Baru', connected: false }]);
  expect(b.report).toBeNull();
  expect(parseBusinessLenient({ ...raw, rev: 0 })).toBeNull();
  expect(parseBusinessLenient({ ...raw, sales: 'x' })).toBeNull();
  expect(parseBusinessLenient({ ...raw, period: 'tahun' })).toBeNull();
  expect(parseBusinessLenient(null)).toBeNull();
});

test('event business dibaca ketat dan longgar', () => {
  const event = { type: 'business', business: sample() };
  expect(streamEventSchema.safeParse(event).success).toBe(true);
  expect(parseEventLenient({ ...event, business: { ...sample(), lowStock: [1, ...sample().lowStock] } })).toEqual(
    event,
  );
  expect(parseEventLenient({ type: 'business', business: { place: 'x' } })).toBeNull();
});

test('teks bantu', () => {
  expect(changeText({ change: 12, down: false, compareLabel: 'Senin lalu' })).toBe('naik 12% dari Senin lalu');
  expect(changeText({ change: 4.5, down: true, compareLabel: '' })).toBe('turun 4,5%');
  expect(stockLeft({ left: 6, unit: 'karton' })).toBe('6 karton');
  expect(stockLeft({ left: 2, unit: '' })).toBe('2');
  expect(mimeOfName('a.XLSX')).toContain('spreadsheetml');
  expect(mimeOfName('a')).toBe('application/octet-stream');
  expect(hasBusinessData(businessFrom('Rumah', 'hari', none) as never)).toBe(false);
  expect(hasBusinessData(sample())).toBe(true);
});

describe('BusinessController', () => {
  const make = () => {
    const transport = new FakeTransport(createMemorySession(null));
    const controller = new BusinessController(transport);
    controller.start();
    return { transport, controller };
  };

  test('cache per tempat dan rentang, event menggantikan menurut rev, resync memuat ulang', async () => {
    const { transport, controller } = make();
    await controller.load('Semua', 'hari');
    await controller.load('Semua', 'minggu');
    const state = controller.getState();
    expect(Object.keys(state.entries).sort()).toEqual([businessKey('Semua', 'hari'), businessKey('Semua', 'minggu')]);
    const spy = jest.spyOn(transport, 'business');
    await controller.reloadAll();
    expect(spy).toHaveBeenCalledTimes(2);
    // perubahan di penyimpanan disiarkan hanya ke rentang yang pernah diminta
    const res = await controller.reorder('stok-susu-uht');
    expect(res.ok).toBe(true);
    await Promise.resolve();
    const day = controller.getState().entries[businessKey('Semua', 'hari')]!.data!;
    expect(day.lowStock.find((s) => s.id === 'stok-susu-uht')?.reorderDraftId).toBe(res.ok ? res.draftId : '');
    expect(day.rev).toBeGreaterThanOrEqual(2);
    controller.stop();
    transport.dispose();
  });

  test('reorder bersamaan untuk barang yang sama memakai satu permintaan, dan busy menyala selama berjalan', async () => {
    const { transport, controller } = make();
    const spy = jest.spyOn(transport, 'businessReorder');
    const a = controller.reorder('stok-kopi-gayo');
    const b = controller.reorder('stok-kopi-gayo');
    expect(controller.getState().busy.has('stok-kopi-gayo')).toBe(true);
    expect(await a).toEqual(await b);
    expect(spy).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(controller.getState().busy.size).toBe(0);
    controller.stop();
    transport.dispose();
  });

  test('gagal memuat tanpa data: error ramah; gagal reorder: pesan ramah', async () => {
    const { transport, controller } = make();
    jest.spyOn(transport, 'business').mockRejectedValueOnce(new ApiFailure('network'));
    await controller.load('Semua');
    expect(controller.getState().entries[businessKey('Semua', 'hari')]).toMatchObject({ status: 'error' });
    transport.failNext('network');
    expect(await controller.reorder('stok-susu-uht')).toMatchObject({ ok: false });
    controller.stop();
    transport.dispose();
  });
});
