import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import RemotePerangkat from '../app/perangkat/[id]';
import { createTestApi, renderWithProviders, toastNow, useSample } from './helpers';
import { DEBOUNCE_MS } from '@/api/devicesController';
import { ERROR_TEXT } from '@/api/errors';
import type { FakeTransport } from '@/api/fake/FakeTransport';
import { deviceById, initialSampleState, MAIN_AC_ID, type SampleState } from '@/sample/store';
import {
  ARC_START,
  ARC_SWEEP,
  angleForValue,
  arcD,
  arcForValue,
  arcPosition,
  nudgeArc,
  onBand,
  pointOn,
  touchAngle,
  valueForArc,
} from '@/ui/kit/dialGeometry';
import { ASSUMED_TEXT } from '@/ui/remote';
import { timerValue } from '@/ui/remote/caps';

// Remote AC (papan 09–11): dial suhu, mode, − / daya / +; kipas, ayun, dan timer di Lainnya.

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: MAIN_AC_ID });
});
afterAll(() => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

let latest: SampleState;
function Probe() {
  const { state } = useSample();
  useEffect(() => {
    latest = state;
  });
  return null;
}
const ac = () => deviceById(latest, MAIN_AC_ID)!;
const action = (name: 'increment' | 'decrement') => ({ nativeEvent: { actionName: name } });
const dial = () => screen.getByRole('adjustable', { name: 'Suhu AC kamar' });
/** Lewati jeda sebelum suhu dikirim ke server. */
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(DEBOUNCE_MS);
  });

async function show(options: Parameters<typeof renderWithProviders>[1] = {}) {
  return renderWithProviders(
    <>
      <RemotePerangkat />
      <Probe />
    </>,
    options,
  );
}

describe('geometri dial 270°', () => {
  const R = 134;
  const C = 160;
  const at = (v: number) => pointOn(C, C, R, angleForValue(v, 16, 30));
  /** Simulasi sentuhan seperti Dial: lompat bila di busur, lanjut dari posisi sekarang bila di celah bawah. */
  const start = (v: number, x: number, y: number) => arcPosition(touchAngle(C, C, x, y)) ?? arcForValue(v, 16, 30);

  test('sudut dan nilai: 16 di 135, 30 di 405, 23 di tengah, di luar batas ditahan', () => {
    expect(angleForValue(16, 16, 30)).toBe(ARC_START);
    expect(angleForValue(30, 16, 30)).toBe(ARC_START + ARC_SWEEP);
    expect(angleForValue(23, 16, 30)).toBe(270);
    expect(angleForValue(5, 16, 30)).toBe(135);
    expect(angleForValue(99, 16, 30)).toBe(405);
  });

  test('titik pada busur memberi nilai yang sama dengan sudutnya', () => {
    for (let t = 16; t <= 30; t++) {
      const p = at(t);
      expect(valueForArc(arcPosition(touchAngle(C, C, p.x, p.y))!, 16, 30, 1)).toBe(t);
      expect(valueForArc(arcForValue(t, 16, 30), 16, 30, 1)).toBe(t);
    }
  });

  test('dari 24 mengetuk titik 16 memberi 16 (bukan 30); dari 22 mengetuk 30 memberi 30', () => {
    const p16 = at(16);
    expect(valueForArc(start(24, p16.x, p16.y), 16, 30, 1)).toBe(16);
    const p30 = at(30);
    expect(valueForArc(start(22, p30.x, p30.y), 16, 30, 1)).toBe(30);
  });

  test('menggeser melewati 30 tertahan di 30, lalu balik tidak macet', () => {
    let pos = arcForValue(29, 16, 30);
    let prev = angleForValue(29, 16, 30);
    for (const a of [405, 430, 470, 500]) {
      pos = nudgeArc(pos, prev, a);
      prev = a;
      expect(valueForArc(pos, 16, 30, 1)).toBe(30);
    }
    pos = nudgeArc(pos, prev, 400);
    expect(valueForArc(pos, 16, 30, 1)).toBeLessThan(30);
    // melewati 360 -> 0 tetap selisih terpendek
    expect(nudgeArc(100, 350, 10) - 100).toBeCloseTo(20);
  });

  test('sentuhan di tengah atau sudut kotak bukan cincin; celah bawah tidak meloncat', () => {
    expect(onBand(C, C, R, 28, C, C)).toBe(false);
    expect(onBand(C, C, R, 28, 8, 8)).toBe(false);
    expect(onBand(C, C, R, 28, C, C - R)).toBe(true);
    expect(arcPosition(touchAngle(C, C, C, C + R))).toBeNull();
    expect(valueForArc(start(24, C, C + R), 16, 30, 1)).toBe(24);
  });

  test('busur memakai bendera sudut besar di atas 180 derajat', () => {
    expect(arcD(C, C, R, 135, 405)).toMatch(/ 0 1 1 /);
    expect(arcD(C, C, R, 135, 200)).toMatch(/ 0 0 1 /);
  });
});

test('layar utama: dial suhu, suhu ruangan, empat mode, − / daya / +; sisanya tidak tampil', async () => {
  await show();
  expect(screen.getByRole('header', { name: 'AC kamar' })).toBeOnTheScreen();
  expect(dial().props.accessibilityValue).toEqual({ min: 16, max: 30, now: 24, text: '24 derajat' });
  expect(screen.getByText('Ruangan 27°')).toBeOnTheScreen();
  for (const m of ['Dingin', 'Kering', 'Kipas', 'Otomatis']) {
    expect(screen.getByRole('button', { name: m })).toBeOnTheScreen();
  }
  expect(screen.getByRole('button', { name: 'Dingin' })).toBeSelected();
  expect(screen.getByRole('button', { name: 'Turunkan suhu' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Naikkan suhu' })).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: 'Daya' })).toBeChecked();
  // Kontrol kedua hanya di Lainnya.
  expect(screen.queryByRole('switch', { name: 'Ayun' })).toBeNull();
  expect(screen.queryByText('Timer')).toBeNull();
  expect(screen.queryByTestId('kecepatan-kipas')).toBeNull();
  // Tanpa kalimat keterangan merek/inframerah di layar utama; hanya tanda kecil "Perkiraan".
  expect(screen.getByLabelText('Keadaan perkiraan')).toBeOnTheScreen();
  expect(screen.queryByText(/inframerah|lewat Kotak|LG/)).toBeNull();
});

test('Lainnya: kecepatan kipas bergambar batang, Ayun, Timer, Favorit, dan satu kalimat perkiraan', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Lainnya' }));
  const sheet = screen.getByTestId('lembar-lainnya');
  expect(within(sheet).getByTestId('kecepatan-kipas')).toBeOnTheScreen();
  expect(within(sheet).getByRole('tab', { name: 'Otomatis' })).toBeSelected();
  expect(
    within(sheet)
      .getAllByRole('tab')
      .map((t) => t.props.accessibilityLabel),
  ).toEqual(['Otomatis', 'Pelan', 'Sedang', 'Kencang']);
  expect(within(sheet).getByRole('switch', { name: 'Ayun' })).not.toBeChecked();
  expect(within(sheet).getByRole('button', { name: 'Timer, Mati' })).toBeOnTheScreen();
  expect(within(sheet).getByRole('switch', { name: 'Favorit' })).toBeChecked();
  expect(within(sheet).getByText(ASSUMED_TEXT)).toBeOnTheScreen();

  await fireEvent.press(within(sheet).getByRole('tab', { name: 'Kencang' }));
  expect(ac().ac!.fan).toBe('Kencang');
  await fireEvent.press(within(sheet).getByRole('switch', { name: 'Ayun' }));
  expect(ac().extra?.swing).toBe(true);
});

test('Timer dari Lainnya: memilih 1 jam mengirim timerMinutes 60, chip menunjukkan jam mati', async () => {
  const api = createTestApi();
  const spy = jest.spyOn(api.transport, 'controlDevice');
  await show({ api });
  await fireEvent.press(screen.getByRole('button', { name: 'Lainnya' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Timer, Mati' }));
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  await fireEvent.press(await screen.findByRole('radio', { name: '1 jam' }));
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(spy).toHaveBeenCalledWith(MAIN_AC_ID, { timerMinutes: 60 });
  expect(timerValue(60, new Date(2026, 9, 22, 21, 0))).toBe('22.00');
  expect(timerValue(0)).toBe('Mati');
});

test('aksi naik/turun pada dial: angka langsung berubah, server menerima nilai akhir setelah jeda', async () => {
  await show();
  await fireEvent(dial(), 'accessibilityAction', action('increment'));
  expect(dial().props.accessibilityValue.text).toBe('25 derajat');
  expect(ac().ac!.temp).toBe(24);
  await settle();
  expect(ac().ac!.temp).toBe(25);
  await fireEvent(dial(), 'accessibilityAction', action('decrement'));
  await settle();
  expect(ac().ac!.temp).toBe(24);
});

test('suhu tertahan di 30 dan 16, tombolnya mati di batas', async () => {
  await show();
  for (let i = 0; i < 20; i++) await fireEvent(dial(), 'accessibilityAction', action('increment'));
  await settle();
  expect(ac().ac!.temp).toBe(30);
  expect(screen.getByRole('button', { name: 'Naikkan suhu' })).toBeDisabled();
  for (let i = 0; i < 20; i++) await fireEvent(dial(), 'accessibilityAction', action('decrement'));
  await settle();
  expect(ac().ac!.temp).toBe(16);
  expect(screen.getByRole('button', { name: 'Turunkan suhu' })).toBeDisabled();
});

test('empat ketukan + dikirim sekali, nilai akhirnya (adjust), setelah jeda', async () => {
  const api = createTestApi();
  const control = jest.spyOn(api.transport, 'controlDevice');
  await show({ api });
  for (let i = 0; i < 4; i++) await fireEvent.press(screen.getByRole('button', { name: 'Naikkan suhu' }));
  await act(async () => {
    jest.advanceTimersByTime(DEBOUNCE_MS - 1);
  });
  expect(control).not.toHaveBeenCalled();
  expect(dial().props.accessibilityValue.text).toBe('28 derajat');
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(control).toHaveBeenCalledTimes(1);
  expect(control).toHaveBeenCalledWith(MAIN_AC_ID, { temp: 28 });
});

test('meninggalkan layar sebelum jedanya habis tetap mengirim suhu terakhir', async () => {
  const api = createTestApi();
  const control = jest.spyOn(api.transport, 'controlDevice');
  const { unmount } = await show({ api });
  await fireEvent.press(screen.getByRole('button', { name: 'Turunkan suhu' }));
  expect(control).not.toHaveBeenCalled();
  await unmount();
  expect(control).toHaveBeenCalledWith(MAIN_AC_ID, { temp: 23 });
});

test('mode: ketuk Kering memilihnya; daya mematikan lalu menyalakan', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Kering' }));
  expect(ac().ac!.mode).toBe('Kering');
  expect(screen.getByRole('button', { name: 'Kering' })).toBeSelected();
  expect(screen.getByRole('button', { name: 'Dingin' })).not.toBeSelected();
  await fireEvent.press(screen.getByRole('switch', { name: 'Daya' }));
  expect(ac().on).toBe(false);
  expect(screen.getByRole('switch', { name: 'Daya' })).not.toBeChecked();
  await fireEvent.press(screen.getByRole('switch', { name: 'Daya' }));
  expect(ac().on).toBe(true);
});

test('Favorit di Lainnya melepas AC dari Beranda lewat setFavorite', async () => {
  const api = createTestApi();
  const spy = jest.spyOn(api.transport, 'setDeviceFavorite');
  await show({ api });
  await fireEvent.press(screen.getByRole('button', { name: 'Lainnya' }));
  await fireEvent.press(screen.getByRole('switch', { name: 'Favorit' }));
  await act(async () => {});
  expect(spy).toHaveBeenCalledWith(MAIN_AC_ID, false);
  expect(screen.getByRole('switch', { name: 'Favorit' })).not.toBeChecked();
});

test('AC lewat aplikasi merek: tanpa tanda perkiraan', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'cloud-ac' });
  const base = initialSampleState.devices.find((d) => d.id === MAIN_AC_ID)!;
  const state = {
    ...initialSampleState,
    devices: [
      ...initialSampleState.devices,
      { ...base, id: 'cloud-ac', name: 'AC ruang kerja', via: 'cloud' as const },
    ],
  };
  await show({ state });
  expect(screen.getByRole('header', { name: 'AC ruang kerja' })).toBeOnTheScreen();
  expect(screen.queryByLabelText('Keadaan perkiraan')).toBeNull();
});

test('id tidak dikenal: pesan ramah dan tombol kembali', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'tidak-ada' });
  await show();
  expect(screen.getByText(/tidak ditemukan/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Kembali ke Perangkat' }));
  expect(router.back).toHaveBeenCalled();
});

test('suhu terkirim lalu gagal: angka kembali ke suhu AC yang sebenarnya, dengan toast', async () => {
  const api = createTestApi({ sample: initialSampleState });
  await show({ api });
  await fireEvent(dial(), 'accessibilityAction', action('increment'));
  await fireEvent(dial(), 'accessibilityAction', action('increment'));
  expect(dial().props.accessibilityValue.text).toBe('26 derajat');
  (api.transport as FakeTransport).failNext('network');
  await settle();
  await act(async () => {});
  expect(ac().ac!.temp).toBe(24);
  expect(dial().props.accessibilityValue.text).toBe('24 derajat');
  expect(toastNow()?.text).toBe(ERROR_TEXT);
});
