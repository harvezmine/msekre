import {
  capabilitySchema,
  deviceSchema,
  deviceControlReqSchema,
  type Device,
  type DeviceControlRes,
} from '@/api/contract';
import { DEBOUNCE_MS, DevicesController } from '@/api/devicesController';
import { deviceStateOf, isContinuousRequest, isGuardedAction } from '@/api/devices';
import { DEVICE_NOT_SUPPORTED_TEXT, deviceError, friendlyError } from '@/api/errors';
import { FakeTransport } from '@/api/fake/FakeTransport';
import { parseDeviceControlResLenient, parseDevicesLenient } from '@/api/lenient';
import { createMemorySession } from '@/api/session';

const PIN = { security: { pinEnabled: true, pin: '123456' } };
const base = {
  id: 'd1',
  place: 'Rumah',
  room: 'Kamar',
  name: 'X',
  icon: 'bulb',
  kind: 'lamp',
  on: true,
  reachable: true,
  status: 'Nyala',
};

function setup(options: ConstructorParameters<typeof FakeTransport>[1] = {}) {
  return new FakeTransport(createMemorySession(null), options);
}
async function ctl(t: FakeTransport, id: string, req: Parameters<FakeTransport['controlDevice']>[1]) {
  return (await t.controlDevice(id, req)).device;
}

describe('kontrak kemampuan: pembacaan longgar', () => {
  test('perangkat lama tanpa capabilities/state dibaca kosong; jenis asing menjadi other', () => {
    const d = deviceSchema.parse(base);
    expect(d.capabilities).toEqual([]);
    expect(d.state).toEqual({});
    expect(deviceSchema.parse({ ...base, kind: 'kulkas' }).kind).toBe('other');
    for (const kind of ['ac', 'tv', 'speaker', 'lamp', 'fan', 'plug', 'curtain', 'lock', 'camera', 'sensor', 'box']) {
      expect(deviceSchema.parse({ ...base, kind }).kind).toBe(kind);
    }
  });

  test('kemampuan asing atau rusak dibuang satu per satu; tombol asing dibuang dari keys', () => {
    const d = deviceSchema.parse({
      ...base,
      capabilities: [
        { type: 'power' },
        { type: 'hologram' },
        { type: 'temperature', min: 16 },
        { type: 'volume', min: 0, max: 100, step: 1 },
        { type: 'keys', keys: ['ok', 'turbo', 'vol_up'] },
        'bukan objek',
      ],
    });
    expect(d.capabilities.map((c) => c.type)).toEqual(['power', 'volume', 'keys']);
    expect(d.capabilities[2]).toEqual({ type: 'keys', keys: ['ok', 'vol_up'] });
    expect(deviceSchema.parse({ ...base, capabilities: 'rusak' }).capabilities).toEqual([]);
  });

  test('bidang keadaan rusak atau asing dibuang, bukan menggagalkan perangkat', () => {
    const d = deviceSchema.parse({
      ...base,
      state: {
        volume: 20,
        muted: 'ya',
        brightness: 500,
        warna_baru: 1,
        track: { title: '' },
        readings: { temp: 27.5 },
      },
    });
    expect(d.state).toEqual({ volume: 20, readings: { temp: 27.5 } });
    expect(deviceSchema.parse({ ...base, state: 7 }).state).toEqual({});
  });

  test('perangkat dengan kemampuan rusak tetap lolos di GET /devices dan jawaban perintah', () => {
    const raw = { ...base, capabilities: [{ type: 'baru' }, { type: 'power' }], state: { on: true, aneh: 1 } };
    const list = parseDevicesLenient({
      place: 'Rumah',
      places: ['Rumah'],
      rooms: [],
      devices: [raw],
      box: null,
      routines: [],
      rev: 2,
    });
    expect(list?.devices[0]?.capabilities).toEqual([{ type: 'power' }]);
    const res = parseDeviceControlResLenient({ device: raw, rev: 3 });
    expect(res?.device.state).toEqual({ on: true });
  });

  test('kemampuan sah: semua jenis lolos, bentuk salah ditolak', () => {
    const ok = [
      { type: 'temperature', min: 16, max: 30, step: 1, unit: 'C' },
      { type: 'mode', options: [{ id: 'cool', label: 'Dingin' }] },
      { type: 'timer', maxMinutes: 60 },
      { type: 'colorTemp', minK: 2200, maxK: 6500 },
      { type: 'color', presets: [{ id: 'a', label: 'A', hex: '#fff' }] },
      { type: 'sensor', readings: [{ id: 't', label: 'Suhu', unit: '°C' }] },
      { type: 'position' },
      { type: 'camera' },
    ];
    for (const c of ok) expect(capabilitySchema.safeParse(c).success).toBe(true);
    expect(capabilitySchema.safeParse({ type: 'mode', options: [] }).success).toBe(false);
  });

  test('permintaan: bidang baru sah, minimal satu selain pin, rentang dan bidang asing ditolak', () => {
    const ok = [
      { brightness: 40 },
      { volume: 18 },
      { key: 'vol_up' },
      { key: '7' },
      { playback: 'next' },
      { position: 60, pin: '123456' },
      { locked: false, pin: '123456' },
      { privacy: true },
      { color: '#FF0000' },
      { timerMinutes: 0 },
    ];
    for (const r of ok) expect(deviceControlReqSchema.safeParse(r).success).toBe(true);
    const bad = [
      { pin: '123456' },
      { key: 'turbo' },
      { playback: 'stop' },
      { position: 101 },
      { volume: -1 },
      { x: 1 },
    ];
    for (const r of bad) expect(deviceControlReqSchema.safeParse(r).success).toBe(false);
  });

  test('adapter: keadaan dari bidang datar lama bila state kosong; state menang atas bidang lama', () => {
    const lamp = deviceSchema.parse({ ...base, level: 40 });
    expect(deviceStateOf(lamp)).toEqual({ on: true, brightness: 40 });
    const ac = deviceSchema.parse({
      ...base,
      kind: 'ac',
      ac: { temp: 24, mode: 'Dingin', fan: 'Otomatis' },
      roomTemp: 27,
      state: { temp: 25 },
    });
    expect(deviceStateOf(ac)).toMatchObject({ temp: 25, mode: 'Dingin', fan: 'Otomatis', roomTemp: 27 });
    expect(deviceStateOf(deviceSchema.parse({ ...base, kind: 'lock', on: false })).locked).toBe(false);
    expect(isContinuousRequest({ temp: 22 })).toBe(true);
    expect(isContinuousRequest({ temp: 22, mode: 'Kipas' })).toBe(false);
    expect(isContinuousRequest({ key: 'ok' })).toBe(false);
    expect(isGuardedAction({ locked: false })).toBe(true);
    expect(isGuardedAction({ privacy: true })).toBe(true);
    expect(isGuardedAction({ locked: true })).toBe(false);
  });
});

describe('server tiruan: perangkat contoh', () => {
  test('setiap jenis punya contoh lengkap dengan kemampuan dan keadaan', async () => {
    const t = setup();
    const { devices } = await t.devices('Semua');
    const kinds = new Set(devices.map((d) => d.kind));
    for (const k of ['ac', 'tv', 'speaker', 'lamp', 'fan', 'plug', 'curtain', 'lock', 'camera', 'sensor', 'box']) {
      expect(kinds.has(k as Device['kind'])).toBe(true);
    }
    const by = (id: string) => devices.find((d) => d.id === id)!;
    expect(by('ac-kamar')).toMatchObject({
      stateIsAssumed: true,
      state: { on: true, temp: 24, mode: 'Dingin', fan: 'Otomatis', swing: false, roomTemp: 27 },
    });
    expect(by('tv-ruang-tamu').state).toMatchObject({ source: 'hdmi1', volume: 18, channel: 12, on: true });
    expect(by('speaker-dapur').state).toMatchObject({
      playing: true,
      track: { title: 'Bengawan Solo', artist: 'Keroncong' },
      volume: 40,
      source: 'bluetooth',
    });
    expect(by('lampu-teras').state).toMatchObject({ brightness: 70, colorTemp: 2700 });
    expect(by('lampu-kamar').capabilities.map((c) => c.type)).toContain('color');
    expect(by('kipas-kamar-anak').state).toMatchObject({ fan: '2', swing: true });
    expect(by('colokan-mesin-cuci').state).toMatchObject({ on: true, powerW: 450, energyTodayKWh: 1.2 });
    expect(by('tirai-ruang-tamu').state.position).toBe(60);
    expect(by('pintu-depan').state).toMatchObject({ locked: true });
    expect(by('kamera-teras')).toMatchObject({ sensitive: true, state: { privacy: false } });
    expect(by('kamera-teras').state.snapshotMediaId).toBeTruthy();
    expect(by('sensor-dapur').state).toMatchObject({ readings: { temp: 27.5, humidity: 64 } });
    expect(by('lampu-teras').stateIsAssumed).toBeUndefined();
    for (const id of [
      'dago-ac',
      'dago-speaker',
      'dago-papan-nama',
      'dago-colokan-kulkas',
      'riau-speaker',
      'riau-colokan-kulkas',
    ]) {
      expect(by(id)).toBeTruthy();
    }
    t.dispose();
  });
});

describe('server tiruan: kendali menurut kemampuan', () => {
  test('daya, suhu (batas), mode, kipas, swing, timer pada AC; Beranda ikut berubah', async () => {
    const t = setup();
    const d = await ctl(t, 'ac-kamar', { temp: 22, mode: 'Kipas', fan: 'Pelan', swing: true, timerMinutes: 90 });
    expect(d).toMatchObject({
      ac: { temp: 22, mode: 'Kipas', fan: 'Pelan' },
      state: { temp: 22, mode: 'Kipas', fan: 'Pelan', swing: true, timerMinutes: 90 },
      status: 'Nyala · 22°',
    });
    await expect(t.controlDevice('ac-kamar', { temp: 15 })).rejects.toMatchObject({
      status: 400,
      error: 'tidak_valid',
    });
    await expect(t.controlDevice('ac-kamar', { temp: 31 })).rejects.toMatchObject({ error: 'tidak_valid' });
    await expect(t.controlDevice('ac-kamar', { timerMinutes: 5000 })).rejects.toMatchObject({ error: 'tidak_valid' });
    expect((await ctl(t, 'ac-kamar', { temp: 16 })).state.temp).toBe(16);
    expect((await ctl(t, 'ac-kamar', { on: false })).state.on).toBe(false);
    const home = await t.home();
    expect(home.house.lines.find((l) => l.deviceId === 'ac-kamar')!.text).toBe('AC kamar mati');
    await ctl(t, 'ac-kamar', { on: true, temp: 19 });
    const again = await t.home();
    expect(again.house.lines.find((l) => l.deviceId === 'ac-kamar')!.text).toBe('AC kamar nyala · 19°');
    t.dispose();
  });

  test('lampu: terang, suhu warna, warna preset dan bebas, batas', async () => {
    const t = setup();
    expect((await ctl(t, 'lampu-teras', { brightness: 30 })).state.brightness).toBe(30);
    expect((await ctl(t, 'lampu-teras', { level: 55 })).level).toBe(55);
    expect((await ctl(t, 'lampu-teras', { colorTemp: 4000 })).state.colorTemp).toBe(4000);
    await expect(t.controlDevice('lampu-teras', { colorTemp: 900 })).rejects.toMatchObject({ error: 'tidak_valid' });
    expect((await ctl(t, 'lampu-kamar', { color: 'biru' })).state.color).toBe('biru');
    expect((await ctl(t, 'lampu-kamar', { color: '#00ff99' })).state.color).toBe('#00ff99');
    await expect(t.controlDevice('lampu-kamar', { color: 'pelangi' })).rejects.toMatchObject({ error: 'tidak_valid' });
    // Lampu tanpa warna tidak punya tombol itu.
    await expect(t.controlDevice('lampu-utama', { color: 'biru' })).rejects.toMatchObject({ error: 'tidak_didukung' });
    t.dispose();
  });

  test('TV: tombol volume, channel, angka, sumber, bisu; navigasi tidak mengubah; mati mengabaikan tombol', async () => {
    const t = setup();
    expect((await ctl(t, 'tv-ruang-tamu', { key: 'vol_up' })).state.volume).toBe(19);
    expect((await ctl(t, 'tv-ruang-tamu', { key: 'vol_down' })).state.volume).toBe(18);
    expect((await ctl(t, 'tv-ruang-tamu', { key: 'ch_up' })).state.channel).toBe(13);
    expect((await ctl(t, 'tv-ruang-tamu', { key: '2' })).state.channel).toBe(2);
    expect((await ctl(t, 'tv-ruang-tamu', { key: '5' })).state.channel).toBe(25);
    const before = await ctl(t, 'tv-ruang-tamu', { key: 'ok' });
    expect(before.state).toMatchObject({ channel: 25, volume: 18 });
    expect((await ctl(t, 'tv-ruang-tamu', { source: 'hdmi2', muted: true })).state).toMatchObject({
      source: 'hdmi2',
      muted: true,
    });
    await expect(t.controlDevice('tv-ruang-tamu', { source: 'vga' })).rejects.toMatchObject({ error: 'tidak_valid' });
    await expect(t.controlDevice('tv-ruang-tamu', { volume: 101 })).rejects.toThrow();
    await ctl(t, 'tv-ruang-tamu', { on: false });
    expect((await ctl(t, 'tv-ruang-tamu', { key: 'vol_up' })).state.volume).toBe(18);
    t.dispose();
  });

  test('speaker: putar/jeda, berikutnya dan sebelumnya berputar di daftar putar, volume', async () => {
    const t = setup();
    expect((await ctl(t, 'speaker-dapur', { playback: 'pause' })).state.playing).toBe(false);
    const next = await ctl(t, 'speaker-dapur', { playback: 'next' });
    expect(next.state).toMatchObject({ playing: true, track: { title: 'Rumah Kita', artist: 'God Bless' } });
    const prev = await ctl(t, 'speaker-dapur', { playback: 'prev' });
    expect(prev.state.track?.title).toBe('Bengawan Solo');
    expect((await ctl(t, 'speaker-dapur', { playback: 'prev' })).state.track?.title).toBe('Laskar Pelangi');
    expect((await ctl(t, 'speaker-dapur', { volume: 65 })).state.volume).toBe(65);
    // Speaker tidak punya tombol remote.
    await expect(t.controlDevice('speaker-dapur', { key: 'ok' })).rejects.toMatchObject({ error: 'tidak_didukung' });
    t.dispose();
  });

  test('kipas, colokan, tirai', async () => {
    const t = setup();
    expect((await ctl(t, 'kipas-kamar-anak', { fan: '3', swing: false })).state).toMatchObject({
      fan: '3',
      swing: false,
    });
    await expect(t.controlDevice('kipas-kamar-anak', { fan: 'Pelan' })).rejects.toMatchObject({ error: 'tidak_valid' });
    const off = await ctl(t, 'colokan-mesin-cuci', { on: false });
    expect(off.state).toMatchObject({ on: false, powerW: 0, energyTodayKWh: 1.2 });
    expect((await ctl(t, 'colokan-mesin-cuci', { on: true })).state.powerW).toBe(450);
    const half = await ctl(t, 'tirai-ruang-tamu', { position: 20 });
    expect(half).toMatchObject({ state: { position: 20 }, on: true });
    expect(await ctl(t, 'tirai-ruang-tamu', { position: 0 })).toMatchObject({ on: false });
    await expect(t.controlDevice('tirai-ruang-tamu', { on: true })).rejects.toMatchObject({ error: 'tidak_didukung' });
    t.dispose();
  });

  test('kemampuan yang tidak dimiliki: tidak_didukung dengan teks ramah', async () => {
    const t = setup();
    const e = await t.controlDevice('lampu-utama', { temp: 22 }).catch((x: unknown) => x);
    expect(e).toMatchObject({ code: 'not_supported', status: 400, error: 'tidak_didukung' });
    expect(deviceError(e)).toBe(DEVICE_NOT_SUPPORTED_TEXT);
    expect(DEVICE_NOT_SUPPORTED_TEXT).toBe('Perangkat ini tidak punya tombol itu.');
    expect(friendlyError(e)).toBe(DEVICE_NOT_SUPPORTED_TEXT);
    await expect(t.controlDevice('sensor-dapur', { on: false })).rejects.toMatchObject({ error: 'tidak_didukung' });
    await expect(t.controlDevice('pintu-depan', { volume: 3 })).rejects.toMatchObject({ error: 'tidak_didukung' });
    t.dispose();
  });

  test('kunci: locked:false dijaga PIN (tanpa pin 428, salah 403, benar jalan); PIN mati langsung; mengunci bebas', async () => {
    const guarded = setup(PIN);
    await expect(guarded.controlDevice('pintu-depan', { locked: false })).rejects.toMatchObject({
      error: 'pin_diperlukan',
    });
    await expect(guarded.controlDevice('pintu-depan', { locked: false, pin: '000000' })).rejects.toMatchObject({
      error: 'pin_salah',
    });
    const open = await ctl(guarded, 'pintu-depan', { locked: false, pin: '123456' });
    expect(open).toMatchObject({ on: false, state: { locked: false }, status: 'Terbuka' });
    expect((await ctl(guarded, 'pintu-depan', { locked: true })).state.locked).toBe(true);
    guarded.dispose();
    const open2 = setup();
    expect((await ctl(open2, 'pintu-depan', { locked: false })).state.locked).toBe(false);
    open2.dispose();
  });

  test('kamera: privacy:true dijaga sama dengan on:false; privacy:false menyalakan lagi tanpa PIN', async () => {
    const t = setup(PIN);
    await expect(t.controlDevice('kamera-teras', { privacy: true })).rejects.toMatchObject({ error: 'pin_diperlukan' });
    const priv = await ctl(t, 'kamera-teras', { privacy: true, pin: '123456' });
    expect(priv).toMatchObject({ on: false, state: { privacy: true } });
    expect(priv.state.snapshotMediaId).toBeUndefined();
    const back = await ctl(t, 'kamera-teras', { privacy: false });
    expect(back).toMatchObject({ on: true, state: { privacy: false } });
    await expect(t.controlDevice('kamera-teras', { on: false, privacy: false })).rejects.toMatchObject({
      error: 'tidak_valid',
    });
    t.dispose();
  });

  test('perubahan dari remote ikut disiarkan dengan rev yang sama dengan jawaban', async () => {
    const t = setup();
    const events: { rev: number; ids: string[] }[] = [];
    t.subscribe(
      (e) => e.type === 'device' && events.push({ rev: e.rev, ids: (e.devices ?? []).map((d) => d.id) }),
      () => {},
    );
    const res: DeviceControlRes = await t.controlDevice('tv-ruang-tamu', { key: 'vol_up' });
    await jest.advanceTimersByTimeAsync(0);
    expect(events.at(-1)).toMatchObject({ rev: res.rev, ids: ['tv-ruang-tamu'] });
    t.dispose();
  });
});

describe('DevicesController: nilai kontinu dan tombol remote', () => {
  async function ready(options: ConstructorParameters<typeof FakeTransport>[1] = {}) {
    const transport = setup(options);
    const controller = new DevicesController(transport);
    controller.start();
    await controller.load('Rumah');
    return { transport, controller };
  }
  const of = (c: DevicesController, id: string) => c.find(id)!;

  test('geseran beruntun: layar berubah seketika, hanya nilai akhir dikirim ~400 ms setelah yang terakhir', async () => {
    const { transport, controller } = await ready();
    await jest.advanceTimersByTimeAsync(0);
    const spy = jest.spyOn(transport, 'controlDevice');
    const first = controller.controlDeviceDebounced('speaker-dapur', { volume: 41 });
    expect(of(controller, 'speaker-dapur').state.volume).toBe(41);
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS - 100);
    const second = controller.controlDeviceDebounced('speaker-dapur', { volume: 45 });
    const last = controller.controlDeviceDebounced('speaker-dapur', { volume: 50 });
    expect(of(controller, 'speaker-dapur').state.volume).toBe(50);
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
    expect(spy).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('speaker-dapur', { volume: 50 });
    expect(await first).toMatchObject({ ok: true });
    expect(await second).toMatchObject({ ok: true });
    expect(await last).toMatchObject({ ok: true });
    expect(of(controller, 'speaker-dapur').state.volume).toBe(50);
    controller.stop();
    transport.dispose();
  });

  test('flush mengirim sekarang (layar ditutup); perubahan beda bidang digabung', async () => {
    const { transport, controller } = await ready();
    const spy = jest.spyOn(transport, 'controlDevice');
    void controller.controlDeviceDebounced('lampu-teras', { brightness: 20 });
    void controller.controlDeviceDebounced('lampu-teras', { colorTemp: 3000 });
    await controller.flush();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('lampu-teras', { brightness: 20, colorTemp: 3000 });
    expect(of(controller, 'lampu-teras').state).toMatchObject({ brightness: 20, colorTemp: 3000 });
    // Tidak ada kiriman kedua saat waktunya habis.
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    expect(spy).toHaveBeenCalledTimes(1);
    controller.stop();
    transport.dispose();
  });

  test('gagal: dikembalikan ke keadaan sebelum geseran pertama dan hasilnya error', async () => {
    const { transport, controller } = await ready();
    const before = of(controller, 'tirai-ruang-tamu');
    jest.spyOn(transport, 'controlDevice').mockRejectedValue(new Error('putus'));
    void controller.controlDeviceDebounced('tirai-ruang-tamu', { position: 10 });
    const last = controller.controlDeviceDebounced('tirai-ruang-tamu', { position: 90 });
    expect(of(controller, 'tirai-ruang-tamu').state.position).toBe(90);
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(await last).toMatchObject({ ok: false, reason: 'error' });
    expect(of(controller, 'tirai-ruang-tamu')).toEqual(before);
    controller.stop();
    transport.dispose();
  });

  test('perintah langsung mengirim lebih dulu nilai yang menunggu, urutan tetap', async () => {
    const { transport, controller } = await ready();
    const calls: unknown[] = [];
    const real = transport.controlDevice.bind(transport);
    jest.spyOn(transport, 'controlDevice').mockImplementation(async (id, req) => {
      calls.push(req);
      return real(id, req);
    });
    void controller.controlDeviceDebounced('tv-ruang-tamu', { volume: 30 });
    await controller.controlDevice('tv-ruang-tamu', { muted: true });
    expect(calls).toEqual([{ volume: 30 }, { muted: true }]);
    expect(of(controller, 'tv-ruang-tamu').state).toMatchObject({ volume: 30, muted: true });
    controller.stop();
    transport.dispose();
  });

  test('tombol: volume ditebak di layar, navigasi dan channel tidak; jawaban server menimpa', async () => {
    const { transport, controller } = await ready();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const real = transport.controlDevice.bind(transport);
    jest.spyOn(transport, 'controlDevice').mockImplementation(async (id, req) => {
      await gate;
      return real(id, req);
    });
    const vol = controller.controlDevice('tv-ruang-tamu', { key: 'vol_up' });
    await jest.advanceTimersByTimeAsync(0);
    expect(of(controller, 'tv-ruang-tamu').state.volume).toBe(19);
    const ch = controller.controlDevice('tv-ruang-tamu', { key: 'ch_up' });
    const ok = controller.controlDevice('tv-ruang-tamu', { key: 'ok' });
    await jest.advanceTimersByTimeAsync(0);
    expect(of(controller, 'tv-ruang-tamu').state.channel).toBe(12);
    release();
    await Promise.all([vol, ch, ok]);
    expect(of(controller, 'tv-ruang-tamu').state).toMatchObject({ volume: 19, channel: 13 });
    controller.stop();
    transport.dispose();
  });

  test('membuka kunci lewat locked:false: PIN mati bertanya dulu, PIN hidup meminta PIN', async () => {
    const { transport, controller } = await ready();
    expect(await controller.controlDevice('pintu-depan', { locked: false })).toEqual({ ok: false, reason: 'confirm' });
    expect(of(controller, 'pintu-depan').on).toBe(true);
    expect(await controller.controlDevice('pintu-depan', { locked: false }, { confirmed: true })).toMatchObject({
      ok: true,
    });
    expect(of(controller, 'pintu-depan').state.locked).toBe(false);
    controller.stop();
    transport.dispose();
    const pinned = await ready(PIN);
    expect(await pinned.controller.controlDevice('kamera-teras', { privacy: true })).toEqual({
      ok: false,
      reason: 'pin',
    });
    pinned.controller.stop();
    pinned.transport.dispose();
  });

  test('Beranda dan kartu chat konsisten setelah suhu diubah dari remote', async () => {
    const { transport, controller } = await ready();
    const pending = controller.controlDeviceDebounced('ac-kamar', { temp: 21 });
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    const result = await pending;
    expect(result).toMatchObject({ ok: true });
    const home = await transport.home();
    expect(home.house.lines.find((l) => l.deviceId === 'ac-kamar')!.text).toBe('AC kamar nyala · 21°');
    const res = await transport.controlDevice('ac-kamar', { mode: 'Kering' });
    expect(res.card).toMatchObject({ temp: 21, mode: 'Kering' });
    controller.stop();
    transport.dispose();
  });
});
