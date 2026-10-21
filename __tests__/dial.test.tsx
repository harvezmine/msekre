import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import DetailAc, { TEMP_DEBOUNCE_MS } from '../app/perangkat/[id]';
import { createTestApi, renderWithProviders, useSample } from './helpers';
import { ERROR_TEXT } from '@/api/errors';
import type { FakeTransport } from '@/api/fake/FakeTransport';
import { ToastHost } from '@/ui/Toast';
import { deviceById, initialSampleState, MAIN_AC_ID, type SampleState } from '@/sample/store';
import {
  angleOf,
  arcFromTemp,
  arcPath,
  arcPosFromAngle,
  DIAL,
  onRing,
  pointAt,
  stepArc,
  tempFromArc,
  tempToAngle,
} from '@/ui/device/dialMath';

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
    jest.advanceTimersByTime(TEMP_DEBOUNCE_MS);
  });

async function show() {
  await renderWithProviders(
    <>
      <DetailAc />
      <Probe />
    </>,
  );
}

describe('dialMath', () => {
  test('sudut dan suhu: 16 di 135, 30 di 405, 23 di tengah, di luar batas ditahan', () => {
    expect(tempToAngle(16)).toBe(135);
    expect(tempToAngle(30)).toBe(405);
    expect(tempToAngle(23)).toBe(270);
    expect(tempToAngle(5)).toBe(135);
    expect(tempToAngle(99)).toBe(405);
  });

  // Simulasi sentuhan seperti Dial: awal sentuh (lompat bila di pita, bukan di celah), lalu geser relatif.
  const start = (temp: number, x: number, y: number) => {
    const angle = angleOf(x, y);
    const jump = arcPosFromAngle(angle);
    return { pos: jump ?? arcFromTemp(temp), angle, ok: onRing(x, y) };
  };
  const at = (temp: number) => pointAt(tempToAngle(temp));

  test('titik pada busur memberi suhu yang sama dengan sudutnya', () => {
    for (let t = 16; t <= 30; t++) {
      const p = at(t);
      expect(tempFromArc(arcPosFromAngle(angleOf(p.x, p.y))!)).toBe(t);
      expect(tempFromArc(arcFromTemp(t))).toBe(t);
    }
  });

  test('dari 24 mengetuk titik 16 memberi 16, bukan 30', () => {
    const p = at(16);
    const s = start(24, p.x, p.y);
    expect(s.ok).toBe(true);
    expect(tempFromArc(s.pos)).toBe(16);
  });

  test('dari 22 mengetuk titik 30 memberi 30', () => {
    const p = at(30);
    expect(tempFromArc(start(22, p.x, p.y).pos)).toBe(30);
  });

  test('menggeser dari 29 searah jarum jam melewati 30 tertahan di 30, lalu balik tidak macet', () => {
    let pos = arcFromTemp(29);
    let prev = tempToAngle(29);
    for (const a of [tempToAngle(30), 430, 470, 500]) {
      pos = stepArc(pos, prev, a);
      prev = a;
      expect(tempFromArc(pos)).toBe(30);
    }
    pos = stepArc(pos, prev, 400);
    prev = 400;
    expect(tempFromArc(pos)).toBeLessThan(30);
    pos = stepArc(pos, prev, 330);
    expect(tempFromArc(pos)).toBeLessThan(29);
  });

  test('satu geseran cepat 60 derajat memindah sekitar 3 derajat Celsius ke arah yang benar', () => {
    const up = stepArc(arcFromTemp(22), 250, 310);
    expect(tempFromArc(up)).toBe(25);
    const down = stepArc(arcFromTemp(22), 310, 250);
    expect(tempFromArc(down)).toBe(19);
    // melewati sudut 360 -> 0 tetap selisih terpendek
    expect(stepArc(100, 350, 10) - 100).toBeCloseTo(20);
  });

  test('sentuhan di angka tengah atau sudut kotak bukan cincin', () => {
    const c = DIAL.size / 2;
    expect(onRing(c, c)).toBe(false);
    expect(onRing(8, 8)).toBe(false);
    expect(onRing(c, c - DIAL.radius)).toBe(true);
  });

  test('sentuhan di celah bawah tidak meloncat: lanjut dari posisi sekarang', () => {
    const c = DIAL.size / 2;
    const x = c;
    const y = c + DIAL.radius; // tepat di bawah = tengah celah
    expect(arcPosFromAngle(angleOf(x, y))).toBeNull();
    const s = start(24, x, y);
    expect(s.ok).toBe(true);
    expect(tempFromArc(s.pos)).toBe(24);
  });

  test('busur memakai bendera sudut besar di atas 180 derajat', () => {
    expect(arcPath(135, 405)).toMatch(/ 0 1 1 /);
    expect(arcPath(135, 200)).toMatch(/ 0 0 1 /);
  });
});

test('detail AC kamar: judul, keterangan inframerah, angka besar, mode, kipas, jadwal', async () => {
  await show();
  expect(screen.getByText('AC kamar')).toBeOnTheScreen();
  expect(screen.getByText('LG · lewat Kotak Sekretaris AI')).toBeOnTheScreen();
  expect(screen.getByText('24°')).toBeOnTheScreen();
  expect(screen.getByText('Perintah terakhir: 24° Dingin · suhu ruangan sekarang 27°')).toBeOnTheScreen();
  expect(screen.getByText('Mati sendiri jam 05.00')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Matikan AC' })).toBeOnTheScreen();
});

test('aksi naik dan turun pada putaran mengubah suhu satu derajat', async () => {
  await show();
  expect(dial().props.accessibilityValue).toEqual({ text: '24 derajat' });
  await fireEvent(dial(), 'accessibilityAction', action('increment'));
  // Angka langsung berubah di layar; ke server baru terkirim setelah jeda.
  expect(dial().props.accessibilityValue).toEqual({ text: '25 derajat' });
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

test('tombol plus dan minus mengubah suhu AC yang sama dengan Beranda', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Naikkan suhu' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Naikkan suhu' }));
  await settle();
  expect(ac().ac!.temp).toBe(26);
  await fireEvent.press(screen.getByRole('button', { name: 'Turunkan suhu' }));
  await settle();
  expect(ac().ac!.temp).toBe(25);
  expect(screen.getByText('25°')).toBeOnTheScreen();
});

test('banyak perubahan suhu beruntun hanya dikirim sekali, nilai akhirnya, setelah jeda', async () => {
  const api = createTestApi();
  const control = jest.spyOn(api.transport, 'controlDevice');
  await renderWithProviders(<DetailAc />, { api });
  for (let i = 0; i < 4; i++) await fireEvent.press(screen.getByRole('button', { name: 'Naikkan suhu' }));
  await act(async () => {
    jest.advanceTimersByTime(TEMP_DEBOUNCE_MS - 1);
  });
  expect(control).not.toHaveBeenCalled();
  expect(screen.getByText('28°')).toBeOnTheScreen();
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(control).toHaveBeenCalledTimes(1);
  expect(control).toHaveBeenCalledWith(MAIN_AC_ID, { temp: 28 });
});

test('meninggalkan layar sebelum jedanya habis tetap mengirim suhu terakhir', async () => {
  const api = createTestApi();
  const control = jest.spyOn(api.transport, 'controlDevice');
  const { unmount } = await renderWithProviders(<DetailAc />, { api });
  await fireEvent.press(screen.getByRole('button', { name: 'Naikkan suhu' }));
  expect(control).not.toHaveBeenCalled();
  await unmount();
  expect(control).toHaveBeenCalledWith(MAIN_AC_ID, { temp: 25 });
});

test('mode dan kecepatan kipas memperbarui penyimpanan', async () => {
  await show();
  await fireEvent.press(screen.getByRole('radio', { name: 'Kering' }));
  expect(ac().ac!.mode).toBe('Kering');
  expect(screen.getByRole('radio', { name: 'Kering' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Dingin' })).not.toBeChecked();
  await fireEvent.press(screen.getByRole('tab', { name: 'Kencang' }));
  expect(ac().ac!.fan).toBe('Kencang');
});

test('tombol utama mematikan lalu menyalakan AC', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Matikan AC' }));
  expect(ac().on).toBe(false);
  expect(screen.getByText('Mati')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Nyalakan AC' }));
  expect(ac().on).toBe(true);
  expect(screen.getAllByText('Dingin')).not.toHaveLength(0);
});

test('AC lewat aplikasi merek: tanpa kartu inframerah', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'cloud-ac' });
  const base = initialSampleState.devices.find((d) => d.id === MAIN_AC_ID)!;
  const state = {
    ...initialSampleState,
    devices: [
      ...initialSampleState.devices,
      { ...base, id: 'cloud-ac', name: 'AC ruang kerja', via: 'cloud' as const },
    ],
  };
  await renderWithProviders(<DetailAc />, { state });
  expect(screen.getByText('lewat aplikasi LG')).toBeOnTheScreen();
  expect(screen.queryByText(/inframerah/)).toBeNull();
});

test('id tidak dikenal: pesan ramah dan tombol kembali', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'tidak-ada' });
  await renderWithProviders(<DetailAc />);
  expect(screen.getByText(/tidak ditemukan/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Kembali ke Perangkat' }));
  expect(router.back).toHaveBeenCalled();
});

test('AC mati: kartu inframerah menyebut perintah terakhir', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Matikan AC' }));
  expect(screen.getByText(/^AC mati · perintah terakhir: 24° Dingin/)).toBeOnTheScreen();
  expect(screen.getByText(/lewat inframerah/)).toBeOnTheScreen();
});

test('suhu terkirim lalu gagal: angka kembali ke suhu AC yang sebenarnya, dengan toast', async () => {
  const api = createTestApi({ sample: initialSampleState });
  await renderWithProviders(
    <>
      <DetailAc />
      <Probe />
      <ToastHost />
    </>,
    { api },
  );
  expect(dial().props.accessibilityValue).toEqual({ text: '24 derajat' });
  await fireEvent(dial(), 'accessibilityAction', action('increment'));
  await fireEvent(dial(), 'accessibilityAction', action('increment'));
  expect(dial().props.accessibilityValue).toEqual({ text: '26 derajat' });
  (api.transport as FakeTransport).failNext('network');
  await settle();
  await act(async () => {});
  expect(ac().ac!.temp).toBe(24);
  expect(dial().props.accessibilityValue).toEqual({ text: '24 derajat' });
  expect(await screen.findByText(ERROR_TEXT)).toBeOnTheScreen();
});
