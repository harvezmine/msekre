import { BusinessController } from '@/api/businessController';
import type { Business, Device, DevicesRes, Home, StreamEvent } from '@/api/contract';
import { DevicesController } from '@/api/devicesController';
import { businessFrom } from '@/api/fake/business';
import { HomeController } from '@/api/homeController';
import type { Transport } from '@/api/transport';

// Muat yang berjalan lalu event yang lebih baru masuk: jawaban muat yang lebih lama tidak boleh menimpa keadaan, `rev`
// tidak boleh turun. Server palsu dikendalikan penuh oleh tes: jawaban bisa ditunda dan event disiarkan kapan saja.

const settle = () => jest.advanceTimersByTimeAsync(0);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function stub<T extends object>(methods: T) {
  let emit: (e: StreamEvent) => void = () => {};
  const transport = {
    ...methods,
    subscribe: (onEvent: (e: StreamEvent) => void) => {
      emit = onEvent;
      return () => {};
    },
  } as unknown as Transport;
  return { transport, emit: (e: StreamEvent) => emit(e) };
}

const home = (place: string, rev: number): Home => ({
  place,
  places: ['Rumah', 'Kedai Dago'],
  greetingName: null,
  summary: '',
  approvals: [],
  agendaToday: [],
  house: { lines: [] },
  business: null,
  ring: { nodes: [] },
  rev,
});

test('Beranda: event yang lebih baru masuk selagi memuat, jawaban lama dibuang dan dimuat sekali lagi', async () => {
  const slow = deferred<Home>();
  const load = jest
    .fn<Promise<Home>, []>()
    .mockResolvedValueOnce(home('Semua', 5))
    .mockReturnValueOnce(slow.promise)
    .mockResolvedValue(home('Rumah', 6));
  const { transport, emit } = stub({ home: load });
  const controller = new HomeController(transport);
  controller.start();
  await settle();
  expect(controller.getState().home?.rev).toBe(5);
  const loading = controller.load();
  emit({ type: 'home', home: home('Rumah', 6) });
  expect(controller.getState().home).toMatchObject({ place: 'Rumah', rev: 6 });
  slow.resolve(home('Semua', 5));
  await loading;
  expect(controller.getState().home).toMatchObject({ place: 'Rumah', rev: 6 });
  expect(load).toHaveBeenCalledTimes(3);
  controller.stop();
});

test('Beranda: rev tidak pernah turun, juga dari event dan jawaban pilih tempat; yang sama atau lebih baru dipakai', async () => {
  const setPlace = jest.fn<Promise<Home>, [string]>().mockResolvedValue(home('Kedai Dago', 4));
  const { transport, emit } = stub({ home: jest.fn(async () => home('Semua', 5)), setPlace });
  const controller = new HomeController(transport);
  controller.start();
  await settle();
  emit({ type: 'home', home: home('Rumah', 4) });
  expect(controller.getState().home?.place).toBe('Semua');
  expect(await controller.setPlace('Kedai Dago')).toBeNull();
  expect(controller.getState().home).toMatchObject({ place: 'Semua', rev: 5 });
  emit({ type: 'home', home: home('Rumah', 5) });
  expect(controller.getState().home?.place).toBe('Rumah');
  controller.stop();
});

const devices = (rev: number, on: boolean): DevicesRes => ({
  place: 'Semua',
  places: ['Rumah'],
  rooms: [],
  devices: [
    {
      id: 'ac',
      place: 'Rumah',
      room: 'Kamar',
      name: 'AC',
      icon: 'snow',
      kind: 'lamp',
      on,
      reachable: true,
      status: on ? 'Nyala' : 'Mati',
    } satisfies Device,
  ],
  box: null,
  routines: [],
  rev,
});

test('Perangkat: event yang lebih baru masuk selagi memuat, jawaban lama dibuang dan dimuat sekali lagi', async () => {
  const slow = deferred<DevicesRes>();
  const load = jest
    .fn<Promise<DevicesRes>, [string?]>()
    .mockResolvedValueOnce(devices(3, true))
    .mockReturnValueOnce(slow.promise)
    .mockResolvedValue(devices(4, false));
  const { transport, emit } = stub({ devices: load });
  const controller = new DevicesController(transport);
  controller.start();
  await controller.load('Semua');
  expect(controller.find('ac')?.on).toBe(true);
  const loading = controller.load('Semua');
  emit({ type: 'device', devices: devices(4, false).devices, rev: 4 });
  expect(controller.find('ac')?.on).toBe(false);
  slow.resolve(devices(3, true));
  await loading;
  expect(controller.find('ac')?.on).toBe(false);
  expect(controller.getState().entries.Semua?.data?.rev).toBe(4);
  expect(load).toHaveBeenCalledTimes(3);
  controller.stop();
});

test('Usaha: event yang lebih baru masuk selagi memuat, jawaban lama dibuang dan dimuat sekali lagi', async () => {
  const none = () => undefined;
  const at = (rev: number, total: number): Business => {
    const b = businessFrom('Semua', 'hari', none);
    return { ...b, sales: { ...b.sales, total }, rev };
  };
  const slow = deferred<Business>();
  const load = jest
    .fn<Promise<Business>, [string?, string?]>()
    .mockResolvedValueOnce(at(2, 100))
    .mockReturnValueOnce(slow.promise)
    .mockResolvedValue(at(3, 300));
  const { transport, emit } = stub({ business: load });
  const controller = new BusinessController(transport);
  controller.start();
  await controller.load('Semua', 'hari');
  const loading = controller.load('Semua', 'hari');
  emit({ type: 'business', business: at(3, 300) });
  slow.resolve(at(2, 100));
  await loading;
  const entry = controller.getState().entries['Semua|hari']?.data;
  expect(entry).toMatchObject({ rev: 3, sales: { total: 300 } });
  expect(load).toHaveBeenCalledTimes(3);
  controller.stop();
});
