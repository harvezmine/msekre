import { deviceFavoriteReqSchema, deviceSchema, type Device, type StreamEvent } from '@/api/contract';
import { DevicesController } from '@/api/devicesController';
import { FakeTransport } from '@/api/fake/FakeTransport';
import { HttpTransport, type SocketLike } from '@/api/http';
import { parseDeviceFavoriteResLenient } from '@/api/lenient';
import { createMemorySession } from '@/api/session';
import { DEVICE_UNAVAILABLE_TEXT } from '@/api/errors';
import { SAMPLE_FAVORITES } from '@/sample/devices';

// Favorit Beranda (kontrak §2.14): `Device.favorite`, `Device.lastUsedAt`, dan `PUT /home/devices/:id/favorite`.

const lamp: Device = {
  id: 'l1',
  place: 'Rumah',
  room: 'Kamar',
  name: 'Lampu',
  icon: 'bulb',
  kind: 'lamp',
  on: true,
  reachable: true,
  capabilities: [],
  state: {},
  status: 'Nyala',
};

describe('kontrak', () => {
  test('favorite dan lastUsedAt opsional dan dibaca longgar', () => {
    expect(deviceSchema.parse(lamp).favorite).toBeUndefined();
    const full = deviceSchema.parse({ ...lamp, favorite: true, lastUsedAt: '2025-10-20T03:42:00.000Z' });
    expect(full).toMatchObject({ favorite: true, lastUsedAt: '2025-10-20T03:42:00.000Z' });
    // Rusak: dibuang, perangkatnya tetap terbaca.
    const broken = deviceSchema.parse({ ...lamp, favorite: 'ya', lastUsedAt: 'kemarin' });
    expect(broken.favorite).toBeUndefined();
    expect(broken.lastUsedAt).toBeUndefined();
  });

  test('permintaan ketat: hanya { favorite: boolean }', () => {
    expect(deviceFavoriteReqSchema.safeParse({ favorite: true }).success).toBe(true);
    expect(deviceFavoriteReqSchema.safeParse({ favorite: 'ya' }).success).toBe(false);
    expect(deviceFavoriteReqSchema.safeParse({ favorite: true, extra: 1 }).success).toBe(false);
  });

  test('jawaban dibaca longgar: rev hilang = 0, perangkat rusak = null', () => {
    expect(parseDeviceFavoriteResLenient({ device: { ...lamp, favorite: true } })).toEqual({
      device: { ...lamp, favorite: true },
      rev: 0,
    });
    expect(parseDeviceFavoriteResLenient({ device: { id: '' }, rev: 3 })).toBeNull();
  });
});

describe('server tiruan', () => {
  function setup() {
    const transport = new FakeTransport(createMemorySession(null), {});
    const events: StreamEvent[] = [];
    transport.subscribe(
      (e) => e.type === 'device' && events.push(e),
      () => {},
    );
    return { transport, events };
  }

  test('data contoh: AC kamar, lampu teras, dan TV disematkan', async () => {
    const { transport } = setup();
    const { devices } = await transport.devices('Semua');
    expect(devices.filter((d) => d.favorite).map((d) => d.id)).toEqual(SAMPLE_FAVORITES);
  });

  test('menyematkan dan melepas: jawabannya perangkat dan rev, disiarkan lewat event device', async () => {
    const { transport, events } = setup();
    const res = await transport.setDeviceFavorite('lampu-dapur', true);
    expect(res.device).toMatchObject({ id: 'lampu-dapur', favorite: true });
    await jest.advanceTimersByTimeAsync(0);
    expect(events.at(-1)).toMatchObject({ type: 'device', rev: res.rev });
    expect((await transport.devices('Semua')).devices.find((d) => d.id === 'lampu-dapur')!.favorite).toBe(true);
    const off = await transport.setDeviceFavorite('lampu-dapur', false);
    expect(off.device.favorite).toBeUndefined();
    await expect(transport.setDeviceFavorite('tidak-ada', true)).rejects.toMatchObject({ error: 'tidak_ditemukan' });
  });

  test('mengatur perangkat mencatat lastUsedAt', async () => {
    const { transport } = setup();
    expect((await transport.devices('Semua')).devices.find((d) => d.id === 'lampu-dapur')!.lastUsedAt).toBeUndefined();
    const { device } = await transport.controlDevice('lampu-dapur', { on: true });
    expect(device.lastUsedAt).toBe('2025-10-20T03:42:00.000Z');
  });
});

describe('DevicesController.setFavorite', () => {
  async function ready() {
    const transport = new FakeTransport(createMemorySession(null), {});
    const controller = new DevicesController(transport);
    controller.start();
    await controller.load('Semua');
    return { transport, controller };
  }

  test('layar berubah lebih dulu, lalu memakai jawaban server', async () => {
    const { controller } = await ready();
    const job = controller.setFavorite('lampu-dapur', true);
    expect(controller.find('lampu-dapur')!.favorite).toBe(true);
    expect(await job).toBeNull();
    expect(controller.find('lampu-dapur')!.favorite).toBe(true);
  });

  test('gagal: dikembalikan dan teks ramah', async () => {
    const { transport, controller } = await ready();
    transport.failNext('network');
    const error = await controller.setFavorite('lampu-dapur', true);
    expect(error).not.toBeNull();
    expect(controller.find('lampu-dapur')!.favorite).toBe(false);
  });
});

describe('lewat HTTP', () => {
  const BASE = 'https://app.sekertaris.com';
  class Sock implements SocketLike {
    onopen = null;
    onmessage = null;
    onerror = null;
    onclose = null;
    close() {}
  }

  test('PUT /home/devices/:id/favorite dengan { favorite }', async () => {
    const fetch = jest.fn(async (url: string, init: RequestInit) => {
      void init;
      const status = url.includes('tidak') ? 501 : 200;
      const body = status === 200 ? { device: { ...lamp, favorite: true }, rev: 7 } : { error: 'belum_tersedia' };
      return { status, ok: status < 300, text: async () => JSON.stringify(body) };
    });
    const transport = new HttpTransport(BASE, createMemorySession('tok'), {
      fetch: fetch as unknown as typeof globalThis.fetch,
      socket: () => new Sock(),
      appVersion: '1.0.0',
    });
    expect(await transport.setDeviceFavorite('l/1', true)).toEqual({ device: { ...lamp, favorite: true }, rev: 7 });
    const [url, init] = fetch.mock.calls.at(-1)!;
    expect(String(url)).toBe(`${BASE}/app/v1/home/devices/l%2F1/favorite`);
    expect(init.method).toBe('PUT');
    expect(init.body).toBe('{"favorite":true}');

    const controller = new DevicesController(transport);
    expect(await controller.setFavorite('tidak', true)).toBe(DEVICE_UNAVAILABLE_TEXT);
  });
});
