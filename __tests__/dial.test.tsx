import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import DetailAc from '../app/perangkat/[id]';
import { renderWithProviders } from './helpers';
import { deviceById, initialSampleState, MAIN_AC_ID, useSample, type SampleState } from '@/sample/store';
import { arcPath, DIAL, pointAt, pointToTemp, tempToAngle } from '@/ui/device/dialMath';

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

  test('titik pada busur memberi suhu yang sama dengan sudutnya', () => {
    for (let t = 16; t <= 30; t++) {
      const p = pointAt(tempToAngle(t));
      expect(pointToTemp(p.x, p.y, t)).toBe(t);
    }
  });

  test('sentuhan di atas pusat = 23, kiri bawah = 16, kanan bawah = 30', () => {
    const c = DIAL.size / 2;
    expect(pointToTemp(c, 0, 23)).toBe(23);
    expect(pointToTemp(40, 240, 16)).toBe(16);
    expect(pointToTemp(240, 240, 30)).toBe(30);
  });

  test('melewati celah di bawah tidak meloncat dari 30 ke 16', () => {
    const c = DIAL.size / 2;
    expect(pointToTemp(c - 5, 270, 30)).toBe(30);
    expect(pointToTemp(c + 5, 270, 16)).toBe(16);
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
  expect(ac().ac!.temp).toBe(25);
  expect(dial().props.accessibilityValue).toEqual({ text: '25 derajat' });
  await fireEvent(dial(), 'accessibilityAction', action('decrement'));
  expect(ac().ac!.temp).toBe(24);
});

test('suhu tertahan di 30 dan 16, tombolnya mati di batas', async () => {
  await show();
  for (let i = 0; i < 20; i++) await fireEvent(dial(), 'accessibilityAction', action('increment'));
  expect(ac().ac!.temp).toBe(30);
  expect(screen.getByRole('button', { name: 'Naikkan suhu' })).toBeDisabled();
  for (let i = 0; i < 20; i++) await fireEvent(dial(), 'accessibilityAction', action('decrement'));
  expect(ac().ac!.temp).toBe(16);
  expect(screen.getByRole('button', { name: 'Turunkan suhu' })).toBeDisabled();
});

test('tombol plus dan minus mengubah suhu AC yang sama dengan Beranda', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Naikkan suhu' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Naikkan suhu' }));
  expect(ac().ac!.temp).toBe(26);
  await fireEvent.press(screen.getByRole('button', { name: 'Turunkan suhu' }));
  expect(ac().ac!.temp).toBe(25);
  expect(screen.getByText('25°')).toBeOnTheScreen();
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
