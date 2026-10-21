import { AlarmNative, type AlarmNativeModule } from '../modules/alarm';
import {
  createAlarmScheduler,
  getAlarmScheduler,
  MemoryAlarmScheduler,
  NativeAlarmScheduler,
  setAlarmScheduler,
} from '@/alarm';
import { alarmBlocked } from '@/alarm/useAlarmStatus';

function fakeModule(overrides: Partial<AlarmNativeModule> = {}): jest.Mocked<AlarmNativeModule> {
  return {
    schedule: jest.fn(async () => true),
    cancel: jest.fn(async () => {}),
    cancelAll: jest.fn(async () => {}),
    list: jest.fn(async () => []),
    getRinging: jest.fn(async () => null),
    status: jest.fn(() => ({
      exact: 'granted',
      fullScreen: 'granted',
      notifications: 'granted',
      batteryOptimized: false,
    })),
    openSettings: jest.fn(async () => true),
    releaseLockScreen: jest.fn(async () => {}),
    dismissKeyguard: jest.fn(async () => true),
    ...overrides,
  } as jest.Mocked<AlarmNativeModule>;
}

afterEach(() => setAlarmScheduler(null));

describe('pilihan penjadwal', () => {
  test('tanpa modul native (Expo Go, iOS, tes) jatuh ke tiruan di memori', () => {
    expect(AlarmNative).toBeNull();
    const scheduler = createAlarmScheduler(null);
    expect(scheduler).toBeInstanceOf(MemoryAlarmScheduler);
    expect(scheduler.native).toBe(false);
    expect(getAlarmScheduler()).toBeInstanceOf(MemoryAlarmScheduler);
  });

  test('dengan modul native memakai NativeAlarmScheduler; setAlarmScheduler menggantikan yang bersama', () => {
    const scheduler = createAlarmScheduler(fakeModule());
    expect(scheduler).toBeInstanceOf(NativeAlarmScheduler);
    expect(scheduler.native).toBe(true);
    const memory = new MemoryAlarmScheduler();
    setAlarmScheduler(memory);
    expect(getAlarmScheduler()).toBe(memory);
    setAlarmScheduler(null);
    expect(getAlarmScheduler()).not.toBe(memory);
  });
});

describe('MemoryAlarmScheduler', () => {
  test('menjadwalkan, mengganti yang berid sama, mencantumkan urut waktu, membatalkan', async () => {
    const s = new MemoryAlarmScheduler();
    await s.schedule({ id: 'b', at: 2000, title: 'B' });
    await s.schedule({ id: 'a', at: 1000, title: 'A', note: 'x' });
    await s.schedule({ id: 'b', at: 3000, title: 'B2' });
    expect(await s.list()).toEqual([
      { id: 'a', at: 1000, title: 'A', note: 'x' },
      { id: 'b', at: 3000, title: 'B2' },
    ]);
    await s.cancel('a');
    expect((await s.list()).map((a) => a.id)).toEqual(['b']);
    await s.cancelAll();
    expect(await s.list()).toEqual([]);
  });

  test('notifikasi mati: terpasang tapi bukan "terjadwal" (tidak akan terdengar), jadi tidak dikabarkan', async () => {
    const s = new MemoryAlarmScheduler({ native: true, status: { notifications: 'denied' } });
    expect(await s.schedule({ id: 'a', at: 1, title: 'A' })).toBe(false);
    expect((await s.list()).map((a) => a.id)).toEqual(['a']);
  });

  test('getRinging membaca alarm yang berbunyi atau terjadwal; dismissKeyguard mencatat dan menjawab sesuai isian', async () => {
    const s = new MemoryAlarmScheduler({ native: true });
    s.ringing.set('r', { id: 'r', at: 1, title: 'R' });
    await s.schedule({ id: 'j', at: 2, title: 'J' });
    expect(await s.getRinging('r')).toEqual({ id: 'r', at: 1, title: 'R' });
    expect(await s.getRinging('j')).toMatchObject({ id: 'j' });
    expect(await s.getRinging('x')).toBeNull();
    await s.cancel('r');
    expect(await s.getRinging('r')).toBeNull();
    expect(await s.dismissKeyguard()).toBe(true);
    s.unlockResult = false;
    expect(await s.dismissKeyguard()).toBe(false);
    expect(s.unlockAsked).toBe(2);
  });

  test('izin alarm tepat waktu ditolak: tidak terjadwal; pengaturan dan layar kunci tercatat', async () => {
    const s = new MemoryAlarmScheduler({ native: true, status: { exact: 'denied' } });
    expect(await s.schedule({ id: 'a', at: 1, title: 'A' })).toBe(false);
    expect(await s.list()).toEqual([]);
    await s.openSettings('exact');
    await s.releaseLockScreen();
    expect(s.opened).toEqual(['exact']);
    expect(s.released).toBe(1);
    expect(await s.status()).toMatchObject({ exact: 'denied', fullScreen: 'granted' });
  });
});

describe('NativeAlarmScheduler', () => {
  test('meneruskan ke modul dengan waktu milidetik dan catatan kosong menjadi null', async () => {
    const m = fakeModule();
    const s = new NativeAlarmScheduler(m);
    expect(await s.schedule({ id: 'a1', at: 1_700_000_000_000, title: 'Judul', note: 'Catatan' })).toBe(true);
    expect(m.schedule).toHaveBeenCalledWith('a1', 1_700_000_000_000, 'Judul', 'Catatan');
    await s.schedule({ id: 'a2', at: 5, title: 'T' });
    expect(m.schedule).toHaveBeenLastCalledWith('a2', 5, 'T', null);
    await s.cancel('a1');
    await s.cancelAll();
    await s.releaseLockScreen();
    await s.openSettings('battery');
    expect(m.cancel).toHaveBeenCalledWith('a1');
    expect(m.cancelAll).toHaveBeenCalled();
    expect(m.releaseLockScreen).toHaveBeenCalled();
    expect(m.openSettings).toHaveBeenCalledWith('battery');
  });

  test('schedule menjawab false bila native menolak (izin atau notifikasi mati): bukan alasan untuk mengabarkan server', async () => {
    const s = new NativeAlarmScheduler(fakeModule({ schedule: jest.fn(async () => false) }));
    expect(await s.schedule({ id: 'a', at: 1, title: 'A' })).toBe(false);
  });

  test('getRinging memetakan catatan alarm yang berbunyi; dismissKeyguard meneruskan hasilnya', async () => {
    const m = fakeModule({
      getRinging: jest.fn(async (id: string) =>
        id === 'a' ? { id: 'a', at: 5, title: 'Obat', note: 'Setelah makan' } : null,
      ),
      dismissKeyguard: jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    });
    const s = new NativeAlarmScheduler(m);
    expect(await s.getRinging('a')).toEqual({ id: 'a', at: 5, title: 'Obat', note: 'Setelah makan' });
    expect(await s.getRinging('b')).toBeNull();
    expect(await s.dismissKeyguard()).toBe(true);
    expect(await s.dismissKeyguard()).toBe(false);
  });

  test('list memetakan catatan; status memetakan izin dan baterai', async () => {
    const m = fakeModule({
      list: jest.fn(async () => [
        { id: 'a', at: 1, title: 'A', note: 'n' },
        { id: 'b', at: 2, title: 'B', note: null },
      ]),
      status: jest.fn(() => ({
        exact: 'denied',
        fullScreen: 'granted',
        notifications: 'granted',
        batteryOptimized: true,
      })),
    });
    const s = new NativeAlarmScheduler(m);
    expect(await s.list()).toEqual([
      { id: 'a', at: 1, title: 'A', note: 'n' },
      { id: 'b', at: 2, title: 'B' },
    ]);
    expect(await s.status()).toEqual({
      exact: 'denied',
      fullScreen: 'granted',
      notifications: 'granted',
      batteryOptimized: true,
    });
  });

  test('kegagalan native tidak menjatuhkan aplikasi: false, kosong, tidak diketahui', async () => {
    const boom = jest.fn(async () => {
      throw new Error('native');
    });
    const m = fakeModule({
      schedule: boom,
      cancel: boom,
      cancelAll: boom,
      list: boom,
      getRinging: boom,
      openSettings: boom,
      releaseLockScreen: boom,
      dismissKeyguard: boom,
      status: jest.fn(() => {
        throw new Error('native');
      }),
    });
    const s = new NativeAlarmScheduler(m);
    expect(await s.schedule({ id: 'a', at: 1, title: 'A' })).toBe(false);
    expect(await s.list()).toEqual([]);
    expect(await s.getRinging('a')).toBeNull();
    // Tidak jadi membuka kunci: layar tidak boleh pindah.
    expect(await s.dismissKeyguard()).toBe(false);
    expect(await s.status()).toEqual({ exact: 'unknown', fullScreen: 'unknown', notifications: 'unknown' });
    await expect(s.cancel('a')).resolves.toBeUndefined();
    await expect(s.cancelAll()).resolves.toBeUndefined();
    await expect(s.openSettings('exact')).resolves.toBeUndefined();
    await expect(s.releaseLockScreen()).resolves.toBeUndefined();
  });
});

test('alarmBlocked: hanya izin yang ditolak yang menghalangi; baterai dan tidak diketahui tidak', () => {
  const ok = { exact: 'granted', fullScreen: 'granted', notifications: 'granted' } as const;
  expect(alarmBlocked(null)).toBe(false);
  expect(alarmBlocked(ok)).toBe(false);
  expect(alarmBlocked({ ...ok, batteryOptimized: true })).toBe(false);
  expect(alarmBlocked({ ...ok, exact: 'unknown' })).toBe(false);
  expect(alarmBlocked({ ...ok, exact: 'denied' })).toBe(true);
  expect(alarmBlocked({ ...ok, fullScreen: 'denied' })).toBe(true);
  expect(alarmBlocked({ ...ok, notifications: 'denied' })).toBe(true);
});
