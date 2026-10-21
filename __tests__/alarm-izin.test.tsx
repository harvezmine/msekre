import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppState } from 'react-native';
import Agenda from '../app/(tabs)/agenda';
import Akun from '../app/akun';
import Notifikasi from '../app/akun/notifikasi';
import Alarm from '../app/alarm';
import IzinAlarm, { brandTips } from '../app/izin-alarm';
import { createTestApi, renderWithProviders, toastNow } from './helpers';
import { MemoryAlarmScheduler, setAlarmScheduler } from '@/alarm';
import { TEST_ALARM_DELAY_MS, TEST_ALARM_ID } from '@/alarm/testAlarm';
import { AlarmSyncHost } from '@/alarm/useAlarmSync';

let mockManufacturer: string | null = 'Google';
jest.mock('expo-device', () => ({
  __esModule: true,
  get manufacturer() {
    return mockManufacturer;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockManufacturer = 'Google';
});
afterEach(() => {
  setAlarmScheduler(null);
  // AppState dari jest-expo adalah jest.fn: kembalikan ke isian bawaan setelah tes yang menangkap pendengarnya.
  jest.mocked(AppState.addEventListener).mockImplementation((() => ({ remove: jest.fn() })) as never);
});

/** Tangkap pendengar AppState; `fire('active')` memanggil semuanya. */
function captureAppState() {
  const listeners: ((s: string) => void)[] = [];
  jest.mocked(AppState.addEventListener).mockImplementation(((_: string, cb: (s: string) => void) => {
    listeners.push(cb);
    return { remove: () => void listeners.splice(listeners.indexOf(cb), 1) };
  }) as never);
  return { fire: (s: string) => act(async () => listeners.forEach((l) => l(s))) };
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

const GOOD = { exact: 'granted', fullScreen: 'granted', notifications: 'granted', batteryOptimized: false } as const;

function install(status: Partial<MemoryAlarmScheduler['statusValue']> = GOOD, native = true) {
  const scheduler = new MemoryAlarmScheduler({ native, status: { ...GOOD, ...status } });
  setAlarmScheduler(scheduler);
  return scheduler;
}

describe('panduan izin alarm', () => {
  test('menjelaskan alasannya dan menampilkan status tiap izin dengan Buka pengaturan di yang belum aktif', async () => {
    const scheduler = install({ exact: 'denied', batteryOptimized: true });
    await renderWithProviders(<IzinAlarm />);
    await advance(0);
    expect(screen.getByText('Biar pengingat tetap bunyi')).toBeOnTheScreen();
    expect(screen.getByText(/walau HP terkunci atau internet mati/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Alarm tepat waktu\. Belum aktif/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Penghemat baterai\. Masih membatasi/ })).toBeOnTheScreen();
    // Yang sudah aktif tidak menawarkan pengaturan.
    expect(screen.getByText(/^Sudah aktif\. Supaya pengingat muncul saat HP terkunci/)).toBeOnTheScreen();
    expect(screen.getAllByText('Buka pengaturan')).toHaveLength(2);

    await fireEvent.press(screen.getByRole('button', { name: /^Alarm tepat waktu/ }));
    await fireEvent.press(screen.getByRole('button', { name: /^Penghemat baterai/ }));
    expect(scheduler.opened).toEqual(['exact', 'battery']);
  });

  test('layar kunci dan notifikasi yang ditolak membuka pengaturannya masing-masing', async () => {
    const scheduler = install({ fullScreen: 'denied', notifications: 'denied' });
    await renderWithProviders(<IzinAlarm />);
    await advance(0);
    await fireEvent.press(screen.getByRole('button', { name: /^Tampil di layar kunci/ }));
    await fireEvent.press(screen.getByRole('button', { name: /^Notifikasi/ }));
    expect(scheduler.opened).toEqual(['fullScreen', 'notifications']);
  });

  test('semua beres: tidak ada Buka pengaturan; kembali dari pengaturan memperbarui status', async () => {
    const scheduler = install({ exact: 'denied' });
    const app = captureAppState();
    await renderWithProviders(<IzinAlarm />);
    await advance(0);
    expect(screen.getAllByText('Buka pengaturan')).toHaveLength(1);
    scheduler.statusValue = { ...scheduler.statusValue, exact: 'granted' };
    await app.fire('active');
    await advance(0);
    expect(screen.queryByText('Buka pengaturan')).toBeNull();
    expect(screen.getByText(/^Sudah aktif\. Supaya pengingat bunyi pas waktunya/)).toBeOnTheScreen();
  });

  test('tanpa alarm native (Expo Go, iOS): penjelasan singkat, tanpa pemeriksaan', async () => {
    install(GOOD, false);
    await renderWithProviders(<IzinAlarm />);
    await advance(0);
    expect(screen.getByText('Alarm di HP ini')).toBeOnTheScreen();
    expect(screen.queryByText('Alarm tepat waktu')).toBeNull();
    expect(screen.queryByRole('button', { name: /Coba alarm/ })).toBeNull();
  });

  test('catatan untuk Xiaomi, Oppo, dan Vivo; merek lain tidak', async () => {
    for (const [manufacturer, brand] of [
      ['Xiaomi', 'Xiaomi'],
      ['OPPO', 'Oppo'],
      ['vivo', 'Vivo'],
    ] as const) {
      expect(brandTips(manufacturer)?.brand).toBe(brand);
    }
    expect(brandTips('Samsung')).toBeNull();
    expect(brandTips(null)).toBeNull();

    install();
    mockManufacturer = 'Xiaomi';
    const view = await renderWithProviders(<IzinAlarm />);
    await advance(0);
    expect(screen.getByText('Khusus HP Xiaomi')).toBeOnTheScreen();
    expect(screen.getByText('Izinkan "Mulai otomatis" untuk aplikasi ini.')).toBeOnTheScreen();
    expect(screen.getByText('Matikan penghemat baterai untuk aplikasi ini.')).toBeOnTheScreen();
    await view.unmount();
    mockManufacturer = 'Google';
    await renderWithProviders(<IzinAlarm />);
    await advance(0);
    expect(screen.queryByText(/Khusus HP/)).toBeNull();
  });

  test('Coba alarm 1 menit lagi menjadwalkan alarm percobaan; tanpa izin memberi tahu dengan ramah', async () => {
    const scheduler = install();
    await renderWithProviders(<IzinAlarm />);
    await advance(0);
    const before = Date.now();
    await fireEvent.press(screen.getByRole('button', { name: 'Coba alarm 1 menit lagi' }));
    await advance(0);
    const [test] = await scheduler.list();
    expect(test).toMatchObject({ id: TEST_ALARM_ID, title: 'Alarm percobaan' });
    expect(test!.at - before).toBeGreaterThanOrEqual(TEST_ALARM_DELAY_MS - 50);
    expect(test!.at - before).toBeLessThanOrEqual(TEST_ALARM_DELAY_MS + 50);
    expect(screen.getByText(/Alarm akan berbunyi 1 menit lagi/)).toBeOnTheScreen();
    // Nama tombol untuk pembaca layar ikut berubah, sama dengan tulisannya.
    expect(
      screen.getByRole('button', { name: 'Alarm akan berbunyi 1 menit lagi. Kunci HP untuk mencoba' }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Coba alarm 1 menit lagi' })).toBeNull();
  });

  test('alarm percobaan dengan notifikasi mati: tidak dianggap berhasil, dan pesannya menyebut notifikasi', async () => {
    install({ notifications: 'denied' });
    const view = await renderWithProviders(
      <>
        <IzinAlarm />
      </>,
    );
    await advance(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Coba alarm 1 menit lagi' }));
    await advance(0);
    expect(screen.queryByText(/Alarm akan berbunyi/)).toBeNull();
    expect(toastNow()?.text).toBe(
      'Notifikasi masih mati, jadi alarm tidak akan terdengar. Nyalakan notifikasinya dulu ya.',
    );
    await view.unmount();
  });

  test('alarm percobaan ditolak izin: tidak terjadwal', async () => {
    const scheduler = install({ exact: 'denied' });
    await renderWithProviders(<IzinAlarm />);
    await advance(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Coba alarm 1 menit lagi' }));
    await advance(0);
    expect(await scheduler.list()).toEqual([]);
    expect(screen.queryByText(/Alarm akan berbunyi/)).toBeNull();
  });
});

describe('pintu masuk ke panduan', () => {
  test('Agenda: spanduk muncul kalau izin menghalangi dan ada pengingat berbunyi; ketuk membuka panduan', async () => {
    install({ exact: 'denied' });
    await renderWithProviders(<Agenda />);
    await advance(0);
    const banner = await screen.findByRole('button', { name: /Alarm belum bisa bunyi tepat waktu/ });
    await fireEvent.press(banner);
    expect(router.push).toHaveBeenCalledWith('/izin-alarm');
  });

  test('Agenda: tanpa spanduk saat izin beres, atau alarm native tidak ada', async () => {
    install();
    const first = await renderWithProviders(<Agenda />);
    await advance(0);
    expect(screen.queryByText('Alarm belum bisa bunyi tepat waktu')).toBeNull();
    await first.unmount();
    install({ exact: 'denied' }, false);
    await renderWithProviders(<Agenda />);
    await advance(0);
    expect(screen.queryByText('Alarm belum bisa bunyi tepat waktu')).toBeNull();
  });

  test('Pemberitahuan: baris Alarm hanya di HP dengan alarm native, nilainya mengikuti izin; Akun ikut menyebutnya', async () => {
    install({ notifications: 'denied' });
    const first = await renderWithProviders(<Notifikasi />);
    await advance(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Alarm. Perlu izin' }));
    expect(router.push).toHaveBeenCalledWith('/izin-alarm');
    await first.unmount();
    const akun = await renderWithProviders(<Akun />);
    await advance(0);
    expect(screen.getByRole('button', { name: 'Pemberitahuan. Perlu izin' })).toBeOnTheScreen();
    await akun.unmount();
    install();
    const second = await renderWithProviders(<Notifikasi />);
    await advance(0);
    expect(screen.getByRole('button', { name: 'Alarm. Siap' })).toBeOnTheScreen();
    await second.unmount();
    install(GOOD, false);
    await renderWithProviders(<Notifikasi />);
    await advance(0);
    expect(screen.queryByRole('button', { name: /^Alarm/ })).toBeNull();
  });
});

describe('layar alarm dan alarm di HP', () => {
  beforeEach(() => jest.setSystemTime(new Date('2025-10-20T02:41:00.000Z')));
  afterEach(() => jest.useFakeTimers({ now: Date.now() }));

  test('Matikan membatalkan alarm di HP dan melepas layar kunci', async () => {
    const scheduler = install();
    await scheduler.schedule({ id: 'a10', at: Date.now() + 60_000, title: 'Berangkat ke bandara' });
    await renderWithProviders(<Alarm />);
    await advance(0);
    const slider = screen.getByTestId('swipe-to-confirm');
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    await advance(0);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(await scheduler.list()).toEqual([]);
    expect(scheduler.released).toBe(1);
  });

  test('Tunda mematikan yang berbunyi dan jadwal tundaan dipasang penyamaan alarm', async () => {
    const scheduler = install();
    const api = createTestApi();
    await renderWithProviders(
      <>
        <AlarmSyncHost />
        <Alarm />
      </>,
      { api },
    );
    await advance(0);
    await advance(0);
    const original = Date.parse('2025-10-21T00:00:00.000Z');
    expect((await scheduler.list()).find((a) => a.id === 'a10')?.at).toBe(original);
    await fireEvent.press(screen.getByRole('button', { name: 'Tunda 10 menit' }));
    await advance(0);
    await advance(0);
    expect(router.back).toHaveBeenCalled();
    expect((await scheduler.list()).find((a) => a.id === 'a10')?.at).toBe(original + 10 * 60_000);
    expect(api.transport.alarmAcks.map((a) => a.scheduledFor)).toContain('2025-10-21T00:10:00.000Z');
  });

  test('alarm percobaan: layar dari jadwal lokal; Matikan membatalkannya', async () => {
    const scheduler = install();
    await scheduler.schedule({ id: TEST_ALARM_ID, at: Date.now() + 60_000, title: 'Alarm percobaan' });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: TEST_ALARM_ID });
    try {
      await renderWithProviders(<Alarm />);
      await advance(0);
      expect(screen.getByText('Alarm percobaan')).toBeOnTheScreen();
      expect(screen.getByText('Kalau Anda melihat ini, alarm di HP ini sudah bekerja.')).toBeOnTheScreen();
      await fireEvent(screen.getByTestId('swipe-to-confirm'), 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      });
      await advance(0);
      expect(await scheduler.list()).toEqual([]);
    } finally {
      jest.mocked(useLocalSearchParams).mockReturnValue({});
    }
  });
});

describe('sinkron alarm dengan agenda (pasang di akar)', () => {
  beforeEach(() => jest.setSystemTime(new Date('2025-10-20T02:41:00.000Z')));
  afterEach(() => jest.useFakeTimers({ now: Date.now() }));

  const idsOf = async (s: MemoryAlarmScheduler) => (await s.list()).map((a) => a.id);

  test('pengingat berbunyi dalam 7 hari dijadwalkan di HP dan dikabarkan ke server satu kali', async () => {
    const scheduler = install();
    const api = createTestApi();
    await renderWithProviders(<AlarmSyncHost />, { api });
    await advance(0);
    await advance(0);
    // Jemput hari ini 16.00, a10 (besok 07.00), a9 (24 Okt), Jemput berulang 26 Okt (id kejadiannya sendiri); a2 (telepon) tidak.
    expect(await idsOf(scheduler)).toEqual(['jemput:2025-10-20', 'a10', 'a9', 'jemput:2025-10-26']);
    expect(api.transport.alarmAcks.map((a) => a.id)).toEqual(['jemput:2025-10-20', 'a10', 'a9', 'jemput:2025-10-26']);
    expect(api.transport.alarmAcks[0]).toEqual({ id: 'jemput:2025-10-20', scheduledFor: '2025-10-20T09:00:00.000Z' });
  });

  test('agenda berubah: tunda menjadwalkan ulang, selesai membatalkan, item baru ditambahkan', async () => {
    const scheduler = install();
    const api = createTestApi();
    await renderWithProviders(<AlarmSyncHost />, { api });
    await advance(0);
    await advance(0);
    await act(async () => {
      await api.transport.agendaPatch('a10', { snoozeUntil: '2025-10-21T00:30:00.000Z' });
      await api.transport.agendaPatch('jemput:2025-10-20', { done: true });
      const { preview } = await api.transport.agendaParse('Ingatkan saya minum obat besok jam 9 malam');
      await api.transport.agendaAdd(preview.item);
    });
    await advance(0);
    await advance(0);
    const list = await scheduler.list();
    expect(list.map((a) => a.id)).toEqual(['a10', 'a-1', 'a9', 'jemput:2025-10-26']);
    expect(list.find((a) => a.id === 'a10')?.at).toBe(Date.parse('2025-10-21T00:30:00.000Z'));
    expect(list.find((a) => a.id === 'a-1')).toMatchObject({ title: 'Minum obat' });
    expect(api.transport.alarmAcks.filter((a) => a.id === 'a10').map((a) => a.scheduledFor)).toEqual([
      '2025-10-21T00:00:00.000Z',
      '2025-10-21T00:30:00.000Z',
    ]);
    expect(api.transport.alarmAcks.filter((a) => a.id === 'jemput:2025-10-20')).toHaveLength(1);
  });

  test('aplikasi kembali ke depan: jadwal yang hilang dipasang lagi', async () => {
    const scheduler = install();
    const app = captureAppState();
    await renderWithProviders(<AlarmSyncHost />, { api: createTestApi() });
    await advance(0);
    await advance(0);
    await scheduler.cancelAll();
    await app.fire('active');
    await advance(0);
    await advance(0);
    expect(await idsOf(scheduler)).toEqual(['jemput:2025-10-20', 'a10', 'a9', 'jemput:2025-10-26']);
  });

  test('7 hari ke depan dipastikan sudah dimuat sebelum disamakan: pergantian pekan memuat rentang baru', async () => {
    const scheduler = install();
    const api = createTestApi();
    const real = api.transport.agenda.bind(api.transport);
    // Server menjawab bahwa hari ini sudah 30 Okt, di luar rentang yang dijawab (sampai 2 Nov) untuk 7 hari ke depan.
    const spy = jest
      .spyOn(api.transport, 'agenda')
      .mockImplementation(async (range) => ({ ...(await real(range)), ...(range ? {} : { today: '2025-10-30' }) }));
    await renderWithProviders(<AlarmSyncHost />, { api });
    for (let i = 0; i < 4; i++) await advance(0);
    expect(spy).toHaveBeenCalledWith({ from: '2025-10-30', to: '2025-11-06' });
    // Penyamaan tetap jalan dengan agenda yang sudah lengkap.
    expect((await scheduler.list()).length).toBeGreaterThan(0);
  });

  test('mode server yang belum masuk (sudah keluar): semua alarm di HP dibatalkan', async () => {
    const scheduler = install();
    await scheduler.schedule({ id: 'sisa', at: Date.now() + 60_000, title: 'Sisa' });
    await scheduler.schedule({ id: TEST_ALARM_ID, at: Date.now() + 60_000, title: 'Percobaan' });
    await renderWithProviders(<AlarmSyncHost />, { api: createTestApi({ mode: 'server' }) });
    await advance(0);
    await advance(0);
    expect(await idsOf(scheduler)).toEqual([TEST_ALARM_ID]);
  });
});
