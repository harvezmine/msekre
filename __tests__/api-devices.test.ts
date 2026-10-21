import {
  boxSchema,
  deviceControlReqSchema,
  deviceSchema,
  devicesResSchema,
  routineRunResSchema,
  streamEventSchema,
  type Device,
  type StreamEvent,
} from '@/api/contract';
import { DevicesController } from '@/api/devicesController';
import { withoutGuardedActions } from '@/api/fake/devices';
import { FakeTransport } from '@/api/fake/FakeTransport';
import { HttpTransport, type SocketLike } from '@/api/http';
import {
  parseBoxResLenient,
  parseDeviceControlResLenient,
  parseDevicesLenient,
  parseEventLenient,
  parseRoutineRunResLenient,
} from '@/api/lenient';
import { createMemorySession } from '@/api/session';
import { friendlyError, PIN_NEEDED_TEXT, WRONG_PIN_TEXT } from '@/api/errors';
import { initialSampleState, type SampleAction } from '@/sample/store';

function setup(options: ConstructorParameters<typeof FakeTransport>[1] = {}) {
  const transport = new FakeTransport(createMemorySession(null), options);
  const events: StreamEvent[] = [];
  transport.subscribe(
    (e) => e.type === 'device' && events.push(e),
    () => {},
  );
  return { transport, events };
}
const settle = () => jest.advanceTimersByTimeAsync(0);
const PIN = { security: { pinEnabled: true, pin: '123456' } };

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

describe('kontrak perangkat', () => {
  test('perangkat sah; jenis baru dibaca other, via asing dibuang, bentuk rusak ditolak', () => {
    expect(deviceSchema.safeParse(lamp).success).toBe(true);
    expect(deviceSchema.parse({ ...lamp, kind: 'kulkas' }).kind).toBe('other');
    expect(deviceSchema.parse({ ...lamp, via: 'zigbee' }).via).toBeUndefined();
    for (const bad of [{ id: '' }, { on: 'ya' }, { level: 120 }, { status: undefined }, { ac: { temp: 24 } }]) {
      expect(deviceSchema.safeParse({ ...lamp, ...bad }).success).toBe(false);
    }
  });

  test('permintaan kendali: minimal satu pengaturan, pin 6 angka, tanpa bidang asing', () => {
    for (const ok of [{ on: false }, { temp: 22 }, { fan: 'Pelan' }, { level: 0 }, { on: false, pin: '123456' }]) {
      expect(deviceControlReqSchema.safeParse(ok).success).toBe(true);
    }
    for (const bad of [{}, { pin: '123456' }, { on: false, pin: '12345' }, { level: 101 }, { warna: 'merah' }]) {
      expect(deviceControlReqSchema.safeParse(bad).success).toBe(false);
    }
  });

  test('event device: rev wajib, devices dan box opsional', () => {
    expect(streamEventSchema.safeParse({ type: 'device', rev: 3 }).success).toBe(true);
    expect(streamEventSchema.safeParse({ type: 'device', devices: [lamp], rev: 3 }).success).toBe(true);
    expect(streamEventSchema.safeParse({ type: 'device', devices: [lamp] }).success).toBe(false);
  });

  test('pembacaan longgar: perangkat rusak dibuang satu per satu, kotak rusak jadi null', () => {
    const res = parseDevicesLenient({
      place: 'Rumah',
      places: ['Rumah'],
      rooms: [{ place: 'Rumah', name: 'Kamar' }, { place: 5 }],
      devices: [lamp, { id: 'rusak' }, { ...lamp, id: 'l2', kind: 'kulkas' }],
      box: { deviceId: 'b' },
      routines: [{ id: 'r', name: 'Pulang', icon: 'home', summary: 'x', places: [] }, 7],
      rev: 4,
    });
    expect(res?.devices.map((d) => [d.id, d.kind])).toEqual([
      ['l1', 'lamp'],
      ['l2', 'other'],
    ]);
    expect(res?.rooms).toHaveLength(1);
    expect(res?.routines).toHaveLength(1);
    expect(res?.box).toBeNull();
    expect(parseDevicesLenient({ place: 'Rumah' })).toBeNull();
    expect(parseEventLenient({ type: 'device', devices: [lamp, { id: 'x' }], rev: 9 })).toEqual({
      type: 'device',
      devices: [lamp],
      rev: 9,
    });
    expect(parseEventLenient({ type: 'device', devices: [lamp] })).toBeNull();
  });

  test('teks ramah untuk PIN', () => {
    expect(PIN_NEEDED_TEXT).toMatch(/PIN/);
    expect(WRONG_PIN_TEXT).toBe('PIN belum cocok, coba lagi.');
  });
});

describe('perangkat di server tiruan', () => {
  test('GET /devices: Semua, Rumah, kedai; ruangan, kotak, rutinitas, dan rev', async () => {
    const { transport } = setup();
    const semua = await transport.devices();
    expect(devicesResSchema.safeParse(semua).success).toBe(true);
    expect(semua).toMatchObject({ place: 'Semua', places: ['Rumah', 'Kedai Dago', 'Kedai Riau'] });
    // Kotak ikut sebagai perangkat berjenis `box` (id sama dengan `box.deviceId`).
    expect(semua.devices).toHaveLength(initialSampleState.devices.length + 1);
    expect(semua.devices.find((d) => d.id === semua.box!.deviceId)).toMatchObject({ kind: 'box', room: 'Ruang tamu' });
    expect(semua.routines.map((r) => r.id)).toEqual(['pulang', 'tutup-kedai', 'tidur']);
    expect(semua.routines[1]!.places).toEqual(['Kedai Dago', 'Kedai Riau']);

    const rumah = await transport.devices('Rumah');
    expect(rumah.rooms.map((r) => r.name)).toEqual(['Ruang tamu', 'Kamar', 'Dapur', 'Teras']);
    expect(rumah.devices.every((d) => d.place === 'Rumah')).toBe(true);
    expect(boxSchema.safeParse(rumah.box).success).toBe(true);
    expect(rumah.box).toMatchObject({
      micOn: true,
      online: true,
      speaker: 'JBL Ruang Tamu',
      roomTemp: 27,
      humidity: 68,
    });
    expect(rumah.rev).toBe(semua.rev);

    const dago = await transport.devices('Kedai Dago');
    expect(dago.box).toBeNull();
    expect(dago.rooms.map((r) => r.name)).toEqual(['Dalam kedai', 'Depan', 'Kasir']);
    await expect(transport.devices('Bulan')).rejects.toMatchObject({ error: 'tidak_valid' });
  });

  test('tanpa tempat: tempat terpilih pengguna', async () => {
    const { transport } = setup();
    await transport.setPlace('Kedai Riau');
    expect((await transport.devices()).place).toBe('Kedai Riau');
  });

  test('perangkat dibentuk dari data contoh: jenis, sensitif, ikon, status dari server', async () => {
    const { transport } = setup();
    const { devices } = await transport.devices('Rumah');
    const by = (id: string) => devices.find((d) => d.id === id)!;
    expect(by('pintu-depan')).toMatchObject({ kind: 'lock', sensitive: true, status: 'Terkunci', via: 'cloud' });
    expect(by('kamera-tamu')).toMatchObject({ kind: 'camera', sensitive: true, status: 'Merekam', short: 'Kamera' });
    expect(by('ac-kamar')).toMatchObject({
      kind: 'ac',
      via: 'ir',
      brand: 'LG',
      roomTemp: 27,
      ac: { temp: 24, mode: 'Dingin', fan: 'Otomatis' },
      status: 'Nyala · 24°',
    });
    expect(by('lampu-sudut')).toMatchObject({ reachable: false, unreachableSince: '10.12' });
    expect(by('lampu-utama').sensitive).toBeUndefined();
  });

  test('kendali: AC, lampu (nyala dan terang), riwayat; jawabannya perangkat dan kartu', async () => {
    const { transport } = setup();
    const ac = await transport.controlDevice('ac-kamar', { temp: 22, mode: 'Kipas', fan: 'Pelan' });
    expect(ac.device).toMatchObject({ on: true, ac: { temp: 22, mode: 'Kipas', fan: 'Pelan' }, status: 'Nyala · 22°' });
    expect(ac.card).toEqual({
      kind: 'device',
      deviceId: 'ac-kamar',
      name: 'AC kamar',
      on: true,
      deviceKind: 'ac',
      switchable: true,
      temp: 22,
      mode: 'Kipas',
      note: 'suhu ruangan sekarang 27°',
    });
    const off = await transport.controlDevice('lampu-utama', { on: false });
    expect(off.device).toMatchObject({ on: false, status: 'Mati', level: 80 });
    const dim = await transport.controlDevice('lampu-utama', { on: true, level: 30 });
    expect(dim.device).toMatchObject({ on: true, level: 30, status: 'Nyala · 30%' });
  });

  test('kendali: bentuk salah ditolak (suhu untuk lampu, mode asing, perangkat tak ada)', async () => {
    const { transport } = setup();
    await expect(transport.controlDevice('lampu-utama', { temp: 22 })).rejects.toMatchObject({
      error: 'tidak_didukung',
    });
    await expect(transport.controlDevice('ac-kamar', { level: 5 })).rejects.toMatchObject({ error: 'tidak_didukung' });
    await expect(transport.controlDevice('ac-kamar', { mode: 'Panas' })).rejects.toMatchObject({
      error: 'tidak_valid',
    });
    await expect(transport.controlDevice('x', { on: true })).rejects.toMatchObject({ error: 'tidak_ditemukan' });
  });

  test('perangkat tidak terjangkau tidak berubah; jawabannya keadaan sebenarnya', async () => {
    const { transport } = setup();
    const res = await transport.controlDevice('lampu-sudut', { on: true });
    expect(res.device).toMatchObject({ on: false, reachable: false });
  });

  test('PIN mati (bawaan): kamera dan kunci langsung dijalankan', async () => {
    const { transport } = setup();
    expect((await transport.controlDevice('kamera-tamu', { on: false })).device.on).toBe(false);
    expect((await transport.controlDevice('pintu-depan', { on: false })).device.status).toBe('Terbuka');
  });

  test('PIN hidup: mematikan kamera tanpa pin 428 pin_diperlukan, pin salah 403 pin_salah, pin benar jalan', async () => {
    const { transport } = setup(PIN);
    const e = await transport.controlDevice('kamera-tamu', { on: false }).catch((x: unknown) => x);
    expect(e).toMatchObject({ code: 'pin_required', status: 428, error: 'pin_diperlukan' });
    expect(friendlyError(e)).toBe(PIN_NEEDED_TEXT);
    expect(
      await transport.controlDevice('kamera-tamu', { on: false, pin: '000000' }).catch((x: unknown) => x),
    ).toMatchObject({ code: 'pin_wrong', status: 403, error: 'pin_salah' });
    expect((await transport.devices('Rumah')).devices.find((d) => d.id === 'kamera-tamu')!.on).toBe(true);
    const ok = await transport.controlDevice('kamera-tamu', { on: false, pin: '123456' });
    expect(ok.device).toMatchObject({ on: false, status: 'Mati' });
  });

  test('PIN hidup: yang tidak dijaga, atau menyalakan kembali / mengunci, tidak minta PIN', async () => {
    const { transport } = setup(PIN);
    await transport.controlDevice('lampu-utama', { on: false });
    await transport.controlDevice('ac-kamar', { on: false });
    expect((await transport.controlDevice('pintu-depan', { on: true })).device.on).toBe(true);
    await transport.controlDevice('pintu-depan', { on: false, pin: '123456' });
    expect((await transport.controlDevice('pintu-depan', { on: true })).device.status).toBe('Terkunci');
  });

  test('rutinitas Tutup kedai per kedai terpilih; di Semua dan Rumah kedua kedai', async () => {
    const { transport } = setup();
    const dago = await transport.runRoutine('tutup-kedai', 'Kedai Dago');
    expect(routineRunResSchema.safeParse(dago).success).toBe(true);
    expect(dago.summary).toBe('Rutinitas Tutup kedai dijalankan di Kedai Dago.');
    expect(dago.devices.map((d) => d.id).sort()).toEqual(['dago-ac', 'dago-lampu', 'dago-papan-nama']);
    const semua = await transport.runRoutine('tutup-kedai', 'Semua');
    expect(semua.summary).toBe('Rutinitas Tutup kedai dijalankan di semua kedai.');
    expect(semua.devices.map((d) => d.id)).toEqual(['riau-lampu'].filter(() => false));
    const pulang = await transport.runRoutine('pulang');
    expect(pulang.summary).toBe('Rutinitas Saya pulang dijalankan.');
    expect(pulang.devices.map((d) => d.id)).toEqual(['ac-kamar']);
    await expect(transport.runRoutine('tidak-ada')).rejects.toMatchObject({ error: 'tidak_ditemukan' });
    await expect(transport.runRoutine('pulang', 'Bulan')).rejects.toMatchObject({ error: 'tidak_valid' });
  });

  test('mic Kotak: PUT /box mengubah kotak dan riwayat', async () => {
    const { transport } = setup();
    expect((await transport.setBoxMic(false)).box.micOn).toBe(false);
    expect((await transport.devices('Rumah')).box!.micOn).toBe(false);
    expect((await transport.setBoxMic(true)).box.micOn).toBe(true);
  });

  test('event device: satu event per giliran dengan rev naik; GET membawa rev yang sama; kotak ikut', async () => {
    const { transport, events } = setup();
    const before = (await transport.devices()).rev;
    await transport.controlDevice('lampu-utama', { on: false });
    await settle();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'device', rev: before + 1, devices: [{ id: 'lampu-utama', on: false }] });
    expect((await transport.devices()).rev).toBe(before + 1);
    await transport.setBoxMic(false);
    await settle();
    expect(events[1]).toMatchObject({ type: 'device', rev: before + 2, box: { micOn: false } });
    expect(events[1]).not.toHaveProperty('devices');
    // tidak ada yang berubah: tidak ada event
    await transport.controlDevice('lampu-utama', { on: false });
    await settle();
    expect(events).toHaveLength(2);
  });

  test('perubahan dari layar lain (penyimpanan bersama) ikut disiarkan', async () => {
    const { transport, events } = setup();
    transport.sample.dispatch({ type: 'setAc', deviceId: 'ac-kamar', on: false });
    await settle();
    expect(events[0]).toMatchObject({ devices: [{ id: 'ac-kamar', status: 'Mati' }] });
  });
});

describe('perangkat lewat HTTP', () => {
  const BASE = 'https://app.sekertaris.com';
  const box = { deviceId: 'b', online: true, micOn: true, speaker: 'JBL', roomTemp: 27, humidity: 60 };
  const res = {
    place: 'Kedai Dago',
    places: ['Rumah', 'Kedai Dago'],
    rooms: [{ place: 'Kedai Dago', name: 'Kasir' }],
    devices: [lamp],
    box: null,
    routines: [],
    rev: 2,
  };
  class Sock implements SocketLike {
    onopen = null;
    onmessage = null;
    onerror = null;
    onclose = null;
    close() {}
  }
  function http(reply: (path: string, init: RequestInit) => { status?: number; body?: unknown }) {
    const fetch = jest.fn(async (url: string, init: RequestInit) => {
      const r = reply(url.replace(`${BASE}/app/v1`, ''), init);
      const status = r.status ?? 200;
      return { status, ok: status < 300, text: async () => JSON.stringify(r.body ?? {}) };
    });
    const transport = new HttpTransport(BASE, createMemorySession('tok'), {
      fetch: fetch as unknown as typeof globalThis.fetch,
      socket: () => new Sock(),
      appVersion: '1.0.0',
    });
    return { transport, fetch };
  }
  const last = (fetch: jest.Mock) => {
    const [url, init] = fetch.mock.calls.at(-1)!;
    return { url: String(url).replace(`${BASE}/app/v1`, ''), method: init.method, body: init.body };
  };

  test('jalur, metode, dan isi sesuai kontrak', async () => {
    const { transport, fetch } = http((path) => {
      if (path.startsWith('/devices')) return { body: res };
      if (path.startsWith('/routines')) return { body: { devices: [lamp], summary: 'Rutinitas Tidur dijalankan.' } };
      if (path === '/box') return { body: { box } };
      return { body: { device: lamp, card: { kind: 'device', deviceId: 'l1', name: 'Lampu', on: true } } };
    });
    expect(await transport.devices('Kedai Dago')).toEqual(res);
    expect(last(fetch)).toEqual({ url: '/devices?place=Kedai%20Dago', method: 'GET', body: undefined });
    await transport.devices();
    expect(last(fetch).url).toBe('/devices');
    await transport.runRoutine('tutup-kedai', 'Kedai Dago');
    expect(last(fetch)).toEqual({
      url: '/routines/tutup-kedai/run',
      method: 'POST',
      body: '{"place":"Kedai Dago"}',
    });
    await transport.runRoutine('tidur');
    expect(last(fetch).body).toBe('{}');
    expect((await transport.setBoxMic(false)).box).toEqual(box);
    expect(last(fetch)).toEqual({ url: '/box', method: 'PUT', body: '{"micOn":false}' });
    await transport.controlDevice('l1', { on: false, pin: '123456' });
    expect(last(fetch)).toEqual({ url: '/home/devices/l1', method: 'POST', body: '{"on":false,"pin":"123456"}' });
  });

  test('428 pin_diperlukan -> pin_required; 403 pin_salah -> pin_wrong', async () => {
    const { transport } = http(() => ({ status: 428, body: { error: 'pin_diperlukan' } }));
    expect(await transport.controlDevice('l1', { on: false }).catch((x: unknown) => x)).toMatchObject({
      code: 'pin_required',
      status: 428,
    });
    const wrong = http(() => ({ status: 403, body: { error: 'pin_salah' } }));
    expect(
      await wrong.transport.controlDevice('l1', { on: false, pin: '000000' }).catch((x: unknown) => x),
    ).toMatchObject({
      code: 'pin_wrong',
    });
  });

  test('jawaban rusak: perangkat yang rusak dibuang, bukan menggagalkan daftar', async () => {
    const { transport } = http(() => ({ body: { ...res, devices: [lamp, { id: 'rusak' }] } }));
    expect((await transport.devices('Kedai Dago')).devices).toEqual([lamp]);
  });
});

describe('jawaban perintah dibaca longgar dan membawa rev', () => {
  test('rev, kartu, dan kalimat yang hilang atau rusak tidak menggagalkan jawaban', () => {
    expect(
      parseDeviceControlResLenient({
        device: lamp,
        card: { kind: 'device', deviceId: 'l1', name: 'Lampu', on: true },
        rev: 7,
      }),
    ).toMatchObject({ rev: 7, card: { deviceId: 'l1' } });
    // Kartu rusak disusun dari perangkatnya; rev hilang dibaca 0.
    const res = parseDeviceControlResLenient({ device: lamp, card: { kind: 'aneh' } });
    expect(res).toMatchObject({ rev: 0, card: { kind: 'device', deviceId: 'l1', deviceKind: 'lamp', name: 'Lampu' } });
    expect(parseDeviceControlResLenient({ device: { id: 'x' } })).toBeNull();
    expect(parseDeviceControlResLenient({ device: lamp, card: {}, rev: -3 })!.rev).toBe(0);

    expect(parseRoutineRunResLenient({ devices: [lamp, { id: 'rusak' }], summary: '', rev: 'x' })).toEqual({
      devices: [lamp],
      summary: 'Rutinitas dijalankan.',
      rev: 0,
    });
    const box = { deviceId: 'b', online: true, micOn: true, speaker: 'JBL', roomTemp: 27, humidity: 60 };
    expect(parseBoxResLenient({ box, rev: 5 })).toEqual({ box, rev: 5 });
    expect(parseBoxResLenient({ box })).toEqual({ box, rev: 0 });
    expect(parseBoxResLenient({ box: { deviceId: 'b' } })).toBeNull();
  });

  test('server tiruan menjawab dengan rev yang sama dengan event device dan GET /devices', async () => {
    const { transport, events } = setup();
    const res = await transport.controlDevice('lampu-utama', { on: false });
    await settle();
    expect(res.rev).toBe((events.at(-1) as Extract<StreamEvent, { type: 'device' }>).rev);
    expect((await transport.devices('Rumah')).rev).toBe(res.rev);
    const routine = await transport.runRoutine('pulang');
    expect(routine.rev).toBeGreaterThan(res.rev);
    const mic = await transport.setBoxMic(false);
    expect(mic.rev).toBeGreaterThan(routine.rev);
  });
});

describe('rutinitas tidak menyentuh perangkat yang dijaga', () => {
  test('membuka kunci, mematikan kamera atau alarm dilewati; mengunci dan menghidupkan kamera tidak', () => {
    const state = initialSampleState;
    const actions: SampleAction[] = [
      { type: 'toggleDevice', id: 'pintu-depan', on: false },
      { type: 'toggleDevice', id: 'kamera-tamu', on: false },
      { type: 'toggleDevice', id: 'kamera-tamu', on: true },
      { type: 'toggleDevice', id: 'pintu-depan', on: true },
      { type: 'toggleDevice', id: 'lampu-utama', on: false },
    ];
    const { allowed, skipped } = withoutGuardedActions(actions, state);
    expect(allowed).toEqual([actions[2], actions[3], actions[4]]);
    expect(skipped).toEqual(['Pintu depan', 'Kamera ruang tamu']);
  });

  test('contoh rutinitas yang ada tidak berisi aksi dijaga, jadi ringkasannya tanpa catatan', async () => {
    const { transport } = setup();
    for (const id of ['pulang', 'tutup-kedai', 'tidur']) {
      const res = await transport.runRoutine(id, id === 'tutup-kedai' ? 'Kedai Dago' : 'Rumah');
      expect(res.summary).not.toContain('dijaga PIN');
    }
    expect((await transport.devices('Rumah')).devices.find((d) => d.id === 'pintu-depan')!.on).toBe(true);
  });
});

describe('DevicesController', () => {
  async function ready() {
    const transport = new FakeTransport(createMemorySession(null), {});
    const controller = new DevicesController(transport);
    controller.start();
    await controller.load('Rumah');
    return { transport, controller };
  }
  const deviceOf = (c: DevicesController, id: string) => c.find(id)!;

  test('hanya perintah terakhir per perangkat yang menimpa layar, juga bila jawaban lama datang belakangan', async () => {
    const { transport, controller } = await ready();
    const real = transport.controlDevice.bind(transport);
    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => (releaseFirst = r));
    const spy = jest.spyOn(transport, 'controlDevice');
    // Server memproses berurutan; hanya jawaban pertama yang sampai terlambat.
    spy.mockImplementationOnce(async (id, req) => {
      const res = await real(id, req);
      await gate;
      return res;
    });
    const first = controller.controlDevice('lampu-utama', { level: 30 });
    const second = controller.controlDevice('lampu-utama', { level: 60 });
    await second;
    expect(deviceOf(controller, 'lampu-utama').level).toBe(60);
    releaseFirst();
    await first;
    // Jawaban pertama (30) datang paling akhir tetapi tidak menimpa 60.
    expect(deviceOf(controller, 'lampu-utama').level).toBe(60);
    controller.stop();
    transport.dispose();
  });

  test('event device yang lebih lama dari jawaban perintah tidak menimpa perangkat itu', async () => {
    const { transport, controller } = await ready();
    const base = controller.getState().entries.Rumah!.data!;
    const lampOff = { ...deviceOf(controller, 'lampu-utama'), on: false, level: undefined, status: 'Mati' };
    jest.spyOn(transport, 'controlDevice').mockResolvedValue({
      device: lampOff,
      card: { kind: 'device', deviceId: 'lampu-utama', name: 'Lampu utama', on: false },
      rev: base.rev + 5,
    });
    await controller.controlDevice('lampu-utama', { on: false });
    expect(deviceOf(controller, 'lampu-utama').on).toBe(false);
    const emit = (transport as unknown as { emit(e: StreamEvent): void }).emit.bind(transport);
    const stale = { ...lampOff, on: true, status: 'Nyala' };
    emit({ type: 'device', devices: [stale], rev: base.rev + 4 });
    expect(deviceOf(controller, 'lampu-utama').on).toBe(false);
    // Perangkat lain di event yang sama tetap diterapkan, dan event yang lebih baru menang.
    emit({ type: 'device', devices: [{ ...stale, on: true }], rev: base.rev + 6 });
    expect(deviceOf(controller, 'lampu-utama').on).toBe(true);
    controller.stop();
    transport.dispose();
  });

  test('membuka kunci: PIN mati bertanya dulu (confirm), setelah dikonfirmasi jalan; PIN hidup meminta PIN', async () => {
    const { transport, controller } = await ready();
    expect(await controller.controlDevice('pintu-depan', { on: false })).toEqual({ ok: false, reason: 'confirm' });
    expect(deviceOf(controller, 'pintu-depan').on).toBe(true);
    const done = await controller.controlDevice('pintu-depan', { on: false }, { confirmed: true });
    expect(done).toMatchObject({ ok: true });
    expect(deviceOf(controller, 'pintu-depan').status).toBe('Terbuka');
    // Mengunci tidak bertanya; mematikan kamera tidak bertanya.
    expect(await controller.controlDevice('pintu-depan', { on: true })).toMatchObject({ ok: true });
    expect(await controller.controlDevice('kamera-tamu', { on: false })).toMatchObject({ ok: true });
    controller.stop();
    transport.dispose();

    const pinned = new FakeTransport(createMemorySession(null), PIN);
    const guarded = new DevicesController(pinned);
    guarded.start();
    await guarded.load('Rumah');
    expect(await guarded.controlDevice('pintu-depan', { on: false })).toEqual({ ok: false, reason: 'pin' });
    guarded.stop();
    pinned.dispose();
  });
});
