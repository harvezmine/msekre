import { act, fireEvent, screen } from '@testing-library/react-native';
import { AppState, BackHandler } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import Agenda from '../app/(tabs)/agenda';
import Alarm from '../app/alarm';
import { ALARM_WINDOW_MS, ringWindowEnd } from '@/alarm/ringWindow';
import { createTestApi, renderWithProviders } from './helpers';
import { Redraw, redraw } from './redraw';
import { MemoryAlarmScheduler, setAlarmScheduler } from '@/alarm';
import { getPendingSnoozes, PendingSnoozes, setPendingSnoozes } from '@/alarm/pendingSnooze';
import { useSample, type SampleState } from '@/sample/store';

beforeEach(() => {
  jest.clearAllMocks();
  setPendingSnoozes(new PendingSnoozes(false));
});
afterEach(() => {
  setAlarmScheduler(null);
  setPendingSnoozes(null);
});

function install(options: ConstructorParameters<typeof MemoryAlarmScheduler>[0] = { native: true }) {
  const scheduler = new MemoryAlarmScheduler(options);
  setAlarmScheduler(scheduler);
  return scheduler;
}

/** Jam sekarang di jam contoh 0b (10.42 WIB, 20 Okt 2025): sebelum alarm contoh besok pagi. */
const SAMPLE_NOW_ISO = '2025-10-20T03:42:00.000Z';

/** Jalankan `body` dengan jam sistem di `iso`, lalu kembalikan jam semula. */
async function atTime(iso: string, body: () => Promise<void>) {
  const real = Date.now();
  jest.setSystemTime(new Date(iso));
  try {
    await body();
  } finally {
    jest.setSystemTime(real);
  }
}

let latest: SampleState;
function Probe() {
  const { state } = useSample();
  useEffect(() => {
    latest = state;
  });
  return null;
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

test('alarm contoh: pengingat, jam besar, judul, dan catatan penerbangan', async () => {
  await renderWithProviders(<Alarm />);
  expect(screen.getByText('Pengingat · Selasa, 21 Okt')).toBeOnTheScreen();
  expect(screen.getByText('07.00')).toBeOnTheScreen();
  expect(screen.getByText('Berangkat ke bandara')).toBeOnTheScreen();
  expect(screen.getByText('Penerbangan GA 408 jam 09.15, Terminal 3')).toBeOnTheScreen();
  expect(screen.getByText('Geser untuk mematikan')).toBeOnTheScreen();
});

test('alarm dari item lain memakai jam dan judulnya, tanpa catatan penerbangan', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'jemput:2025-10-20' });
  try {
    await renderWithProviders(<Alarm />);
    expect(screen.getByText('16.00')).toBeOnTheScreen();
    expect(screen.getByText('Jemput Kayla les')).toBeOnTheScreen();
    expect(screen.queryByTestId('ikon-plane')).toBeNull();
  } finally {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
  }
});

test('Tunda 10 menit kembali ke Agenda, yang menulis "Ditunda sampai 07.10"', async () => {
  await atTime(SAMPLE_NOW_ISO, async () => {
    await renderWithProviders(
      <>
        <Alarm />
        <Probe />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Tunda 10 menit' }));
    await advance(0);
    expect(router.back).toHaveBeenCalled();
    // Tersimpan sebagai waktu lengkap (ISO), 10 menit setelah waktu alarm yang belum jatuh tempo.
    expect(latest.agenda.find((a) => a.id === 'a10')!.snoozedUntil).toBe('2025-10-21T00:10:00.000Z');

    await renderWithProviders(<Agenda />, { state: latest });
    await fireEvent.press(screen.getByRole('tab', { name: 'Minggu ini' }));
    expect(screen.getByText('Ditunda sampai 07.10')).toBeOnTheScreen();
  });
});

test('Tanya Nadia menggantikan alarm dengan chat setelah HP dibuka', async () => {
  const scheduler = install();
  await renderWithProviders(<Alarm />);
  await fireEvent.press(screen.getByRole('button', { name: 'Tanya Nadia' }));
  await advance(0);
  expect(scheduler.unlockAsked).toBe(1);
  expect(router.replace).toHaveBeenCalledWith('/chat');
});

test('Tanya Nadia: HP terkunci dan tidak jadi dibuka, tetap di layar alarm dan memberi tahu', async () => {
  const scheduler = install();
  scheduler.unlockResult = false;
  await renderWithProviders(
    <>
      <Alarm />
      <Probe />
    </>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Tanya Nadia' }));
  await advance(0);
  expect(router.replace).not.toHaveBeenCalled();
  expect(latest.toast?.text).toBe('Buka kunci HP dulu untuk bertanya ke Nadia.');
  // Dibuka kemudian: bisa lagi.
  scheduler.unlockResult = true;
  await fireEvent.press(screen.getByRole('button', { name: 'Tanya Nadia' }));
  await advance(0);
  expect(router.replace).toHaveBeenCalledWith('/chat');
});

test('getar berhenti saat layar alarm tidak lagi terlihat (tertutup layar lain)', async () => {
  await renderWithProviders(<Redraw>{() => <Alarm />}</Redraw>);
  await advance(2000);
  jest.mocked(useIsFocused).mockReturnValue(false);
  try {
    await redraw();
    jest.mocked(Haptics.notificationAsync).mockClear();
    await advance(10000);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  } finally {
    jest.mocked(useIsFocused).mockReturnValue(true);
  }
});

test('aksi pembaca layar "Matikan" mematikan alarm dan kembali', async () => {
  await renderWithProviders(<Alarm />);
  const slider = screen.getByTestId('swipe-to-confirm');
  expect(slider.props.accessibilityActions).toEqual([{ name: 'activate', label: 'Matikan' }]);
  await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
  expect(router.back).toHaveBeenCalledTimes(1);
  // dua kali tidak menutup dua layar
  await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('getar berpola tiap 2 detik dan berhenti saat layar ditutup', async () => {
  const clear = jest.spyOn(globalThis, 'clearInterval');
  const { unmount } = await renderWithProviders(<Alarm />);
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  await advance(6000);
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(4);
  await unmount();
  expect(clear).toHaveBeenCalled();
  jest.mocked(Haptics.notificationAsync).mockClear();
  await advance(10000);
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  clear.mockRestore();
});

test('tautan /alarm?id= memuat item dari server walau di luar rentang agenda', async () => {
  const api = createTestApi();
  api.transport.sample.dispatch({
    type: 'addAgenda',
    item: { date: '2026-03-01', time: '05.45', title: 'Subuh di bandara', kind: 'reminder', way: 'alarm' },
  });
  const id = api.transport.sample.getState().agenda.at(-1)!.id;
  jest.mocked(useLocalSearchParams).mockReturnValue({ id });
  try {
    await renderWithProviders(<Alarm />, { api });
    await advance(0);
    expect(screen.getByText('05.45')).toBeOnTheScreen();
    expect(screen.getByText('Subuh di bandara')).toBeOnTheScreen();
    expect(screen.getByText('Pengingat · Minggu, 1 Mar')).toBeOnTheScreen();
  } finally {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
  }
});

test('id yang tidak ada dan tanpa catatan di HP atau judul: layar kosong; mode server tanpa id juga tidak membunyikan apa-apa', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'tidak-ada' });
  try {
    await renderWithProviders(<Alarm />);
    await advance(0);
    expect(screen.queryByText('Geser untuk mematikan')).toBeNull();
  } finally {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
  }
  await renderWithProviders(<Alarm />, { api: createTestApi({ mode: 'server' }) });
  await advance(0);
  expect(screen.queryByText('Geser untuk mematikan')).toBeNull();
});

test('Tunda tanpa internet: alarm tundaan tetap dipasang di HP, layar menutup, kabarnya diulang nanti', async () => {
  const scheduler = install();
  const api = createTestApi();
  await atTime(SAMPLE_NOW_ISO, async () => {
    await renderWithProviders(<Alarm />, { api });
    api.transport.failNext('network');
    await fireEvent.press(screen.getByRole('button', { name: 'Tunda 10 menit' }));
    await advance(0);
    await advance(0);
    expect(router.back).toHaveBeenCalled();
    // Terpasang di HP walau server tidak terjangkau; server belum tahu, tanpa tanda terima.
    expect(await scheduler.list()).toEqual([
      expect.objectContaining({ id: 'a10', at: Date.parse('2025-10-21T00:10:00.000Z') }),
    ]);
    expect(api.transport.alarmAcks).toEqual([]);
    expect((await getPendingSnoozes().list()).map((p) => p.id)).toEqual(['a10']);
  });
});

test('Tunda terlambat: 10 menit dari saat ditekan, bukan dari waktu alarm yang sudah lewat', async () => {
  const scheduler = install();
  const api = createTestApi();
  // Alarm a10 jatuh tempo 07.00 WIB (00:00Z) dan baru ditekan 07.25.
  await atTime('2025-10-21T00:25:00.000Z', async () => {
    await renderWithProviders(<Alarm />, { api });
    await fireEvent.press(screen.getByRole('button', { name: 'Tunda 10 menit' }));
    await advance(0);
    await advance(0);
    expect((await scheduler.list())[0]!.at).toBe(Date.parse('2025-10-21T00:35:00.000Z'));
    expect(api.transport.sample.getState().agenda.find((a) => a.id === 'a10')!.snoozedUntil).toBe(
      '2025-10-21T00:35:00.000Z',
    );
    // Sudah sampai ke server: tidak ada tunda yang menunggu.
    expect(await getPendingSnoozes().list()).toEqual([]);
  });
});

describe('layar alarm tanpa data dari server', () => {
  afterEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({}));

  test('item tidak bisa dimuat (tanpa internet): tampil dari catatan alarm di HP, dengan Tunda dan Matikan, tanpa Tanya', async () => {
    const scheduler = install();
    await atTime(SAMPLE_NOW_ISO, async () => {
      scheduler.ringing.set('x9', { id: 'x9', at: Date.now(), title: 'Minum obat', note: 'Setelah makan' });
      jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'x9' });
      const api = createTestApi({ mode: 'server', token: 'tok' });
      api.transport.failNext('network');
      await renderWithProviders(<Alarm />, { api });
      await advance(0);
      expect(screen.getByText('Minum obat')).toBeOnTheScreen();
      expect(screen.getByText('Setelah makan')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Tunda 10 menit' })).toBeOnTheScreen();
      expect(screen.getByTestId('swipe-to-confirm')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Tanya Nadia' })).toBeNull();
      // Matikan tetap bekerja.
      await fireEvent(screen.getByTestId('swipe-to-confirm'), 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      });
      await advance(0);
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(scheduler.ringing.has('x9')).toBe(false);
    });
  });

  test('tautan tanpa judul: catatan alarm di HP (tanpa sesi) tetap memberi judul dan Matikan', async () => {
    const scheduler = install();
    scheduler.ringing.set('x1', { id: 'x1', at: Date.now(), title: 'Rapat pagi' });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'x1' });
    await renderWithProviders(<Alarm />, { api: createTestApi({ mode: 'server' }) });
    await advance(0);
    expect(screen.getByText('Rapat pagi')).toBeOnTheScreen();
    expect(screen.getByText('Geser untuk mematikan')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Tanya Nadia' })).toBeNull();
  });

  test('mode server belum masuk: Tunda hanya dipasang di HP, tanpa menghubungi server dan tanpa catatan tunda', async () => {
    const scheduler = install();
    const api = createTestApi({ mode: 'server' });
    const patch = jest.spyOn(api.transport, 'agendaPatch');
    scheduler.ringing.set('x1', { id: 'x1', at: Date.now(), title: 'Rapat pagi' });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'x1' });
    await atTime(SAMPLE_NOW_ISO, async () => {
      await renderWithProviders(<Alarm />, { api });
      await advance(0);
      await fireEvent.press(screen.getByRole('button', { name: 'Tunda 10 menit' }));
      await advance(0);
      await advance(0);
      expect(await scheduler.list()).toEqual([expect.objectContaining({ id: 'x1', title: 'Rapat pagi' })]);
      expect(patch).not.toHaveBeenCalled();
      expect(await getPendingSnoozes().list()).toEqual([]);
      expect(router.back).toHaveBeenCalled();
    });
  });

  test('tidak bisa kembali (satu-satunya layar): ke awal aplikasi, bukan kembali ke ketiadaan', async () => {
    const scheduler = install();
    scheduler.ringing.set('x1', { id: 'x1', at: Date.now(), title: 'Rapat pagi' });
    jest.mocked(router.canGoBack).mockReturnValueOnce(false);
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'x1' });
    await renderWithProviders(<Alarm />, { api: createTestApi({ mode: 'server' }) });
    await advance(0);
    await fireEvent(screen.getByTestId('swipe-to-confirm'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});

describe('layar alarm melepas izin di atas layar kunci', () => {
  test('ditutup tanpa Matikan atau Tunda (Kembali, atau layar lain menggantikan): izin dilepas', async () => {
    const scheduler = install();
    const { unmount } = await renderWithProviders(<Alarm />);
    await advance(0);
    expect(scheduler.released).toBe(0);
    await unmount();
    expect(scheduler.released).toBe(1);
  });

  test('aplikasi ke latar (Android menjeda sebentar di atas layar kunci): izin TIDAK dilepas oleh JS', async () => {
    const scheduler = install();
    const listeners: ((s: string) => void)[] = [];
    jest.mocked(AppState.addEventListener).mockImplementation(((_: string, cb: (s: string) => void) => {
      listeners.push(cb);
      return { remove: jest.fn() };
    }) as never);
    try {
      await renderWithProviders(<Alarm />);
      await advance(0);
      await act(async () => listeners.forEach((l) => l('inactive')));
      await act(async () => listeners.forEach((l) => l('background')));
      await act(async () => listeners.forEach((l) => l('active')));
      expect(scheduler.released).toBe(0);
    } finally {
      jest.mocked(AppState.addEventListener).mockImplementation((() => ({ remove: jest.fn() })) as never);
    }
  });

  test('tombol Kembali Android: izin dilepas dan Kembali berjalan seperti biasa', async () => {
    const scheduler = install();
    let handler: (() => boolean | null | undefined) | undefined;
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_: string, cb: () => boolean) => {
      handler = cb;
      return { remove: jest.fn() };
    }) as never);
    try {
      await renderWithProviders(<Alarm />);
      await advance(0);
      expect(handler?.()).toBe(false);
      expect(scheduler.released).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  test('pratinjau dari Agenda: Matikan dan Tunda hanya menutup layar, alarm yang sebenarnya tidak disentuh', async () => {
    const scheduler = install();
    const api = createTestApi();
    await scheduler.schedule({ id: 'a10', at: Date.parse('2025-10-21T00:00:00.000Z'), title: 'Berangkat ke bandara' });
    const patch = jest.spyOn(api.transport, 'agendaPatch');
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'a10', preview: '1' });
    try {
      await renderWithProviders(<Alarm />, { api });
      await advance(0);
      expect(screen.getByText('Ini hanya pratinjau. Alarm yang sebenarnya tidak berubah.')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Tunda 10 menit' }));
      await advance(0);
      expect(router.back).toHaveBeenCalledTimes(1);
      await fireEvent(screen.getByTestId('swipe-to-confirm'), 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      });
      await advance(0);
      expect(router.back).toHaveBeenCalledTimes(2);
      expect(patch).not.toHaveBeenCalled();
      expect(await scheduler.list()).toEqual([
        expect.objectContaining({ id: 'a10', at: Date.parse('2025-10-21T00:00:00.000Z') }),
      ]);
    } finally {
      jest.mocked(useLocalSearchParams).mockReturnValue({});
    }
  });
});

describe('jendela bunyi alarm habis', () => {
  afterEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({}));

  /** Alarm yang berbunyi menurut catatan di HP, dengan jendela bunyi `until`. */
  async function ringingFor(extra: { until?: number; at?: number }, scheduler = install()) {
    scheduler.ringing.set('x7', { id: 'x7', at: extra.at ?? Date.now(), title: 'Rapat pagi', until: extra.until });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'x7' });
    await renderWithProviders(<Alarm />, { api: createTestApi({ mode: 'server' }) });
    await advance(0);
    return scheduler;
  }

  test('sampai `until`: getar berhenti, izin dilepas, layar menutup, dan aplikasi pindah ke latar', async () => {
    const scheduler = await ringingFor({ until: Date.now() + 60_000 });
    jest.mocked(Haptics.notificationAsync).mockClear();
    await advance(60_000 - 1000);
    expect(router.back).not.toHaveBeenCalled();
    expect(scheduler.released).toBe(0);
    expect(Haptics.notificationAsync).toHaveBeenCalled();
    await advance(1000);
    await advance(0);
    expect(scheduler.released).toBe(1);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(scheduler.moved).toBe(1);
    jest.mocked(Haptics.notificationAsync).mockClear();
    await advance(20_000);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  test('izin dilepas lebih dulu dan ditunggu: layar baru menutup sesudahnya', async () => {
    const scheduler = install();
    let finish!: () => void;
    scheduler.releaseLockScreen = () =>
      new Promise<void>((resolve) => {
        finish = () => {
          scheduler.released += 1;
          resolve();
        };
      });
    await ringingFor({ until: Date.now() + 1000 }, scheduler);
    await advance(1000);
    expect(router.back).not.toHaveBeenCalled();
    finish();
    await advance(0);
    await advance(0);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  test('batas jendela: `until`, kalau tidak ada waktu alarm + 10 menit, kalau tidak ada 10 menit sejak dibuka', () => {
    expect(ringWindowEnd({ at: 1000, until: 5000 }, 99)).toBe(5000);
    expect(ringWindowEnd({ at: 1000 }, 99)).toBe(1000 + ALARM_WINDOW_MS);
    expect(ringWindowEnd(null, 99)).toBe(99 + ALARM_WINDOW_MS);
    expect(ALARM_WINDOW_MS).toBe(10 * 60_000);
  });

  test('tanpa catatan alarm di HP: penutup dipasang 10 menit sejak layar dibuka', async () => {
    install();
    const spy = jest.spyOn(globalThis, 'setTimeout');
    await renderWithProviders(<Alarm />);
    const delays = spy.mock.calls.map((c) => c[1]).filter((d) => typeof d === 'number' && d >= 300_000);
    spy.mockRestore();
    expect(delays).toEqual([ALARM_WINDOW_MS]);
  });

  test('Matikan sebelum habis: tidak ada penutupan kedua', async () => {
    await ringingFor({ until: Date.now() + 60_000 });
    await fireEvent(screen.getByTestId('swipe-to-confirm'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    await advance(0);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  test('pratinjau dari Agenda tidak pernah menutup sendiri', async () => {
    const scheduler = install();
    jest.mocked(useLocalSearchParams).mockReturnValue({ preview: '1' });
    await renderWithProviders(<Alarm />);
    await advance(60_000);
    expect(router.back).not.toHaveBeenCalled();
    expect(scheduler.moved).toBe(0);
    expect(scheduler.released).toBe(0);
  });
});

test('Matikan menunggu izin layar kunci lepas sebelum pindah layar', async () => {
  const scheduler = install();
  let finish!: () => void;
  scheduler.releaseLockScreen = () => new Promise<void>((resolve) => (finish = resolve));
  await renderWithProviders(<Alarm />);
  await fireEvent(screen.getByTestId('swipe-to-confirm'), 'accessibilityAction', {
    nativeEvent: { actionName: 'activate' },
  });
  await advance(0);
  expect(router.back).not.toHaveBeenCalled();
  finish();
  await advance(0);
  await advance(0);
  expect(router.back).toHaveBeenCalledTimes(1);
});
