import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import Agenda from '../app/(tabs)/agenda';
import Alarm from '../app/alarm';
import { renderWithProviders } from './helpers';
import { useSample, type SampleState } from '@/sample/store';

beforeEach(() => jest.clearAllMocks());

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
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'a4' });
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
  await renderWithProviders(
    <>
      <Alarm />
      <Probe />
    </>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Tunda 10 menit' }));
  expect(router.back).toHaveBeenCalled();
  expect(latest.agenda.find((a) => a.id === 'a10')!.snoozedUntil).toBe('07.10');

  await renderWithProviders(<Agenda />, { state: latest });
  await fireEvent.press(screen.getByRole('tab', { name: 'Minggu ini' }));
  expect(screen.getByText('Ditunda sampai 07.10')).toBeOnTheScreen();
});

test('Tanya Nadia membuka chat', async () => {
  await renderWithProviders(<Alarm />);
  await fireEvent.press(screen.getByRole('button', { name: 'Tanya Nadia' }));
  expect(router.navigate).toHaveBeenCalledWith('/chat');
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
