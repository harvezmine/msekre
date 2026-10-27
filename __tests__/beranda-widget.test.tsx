/**
 * Widget Beranda: cuaca (tempat tersimpan, perkiraan lokasi HP yang diizinkan, izin ditolak, server tanpa cuaca), agenda
 * berikutnya, baris tanggal dan jam, dan kapsul tab aktif yang membulat.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import Beranda from '../app/(tabs)/index';
import { createTestApi, renderWithProviders } from './helpers';
import { showRoute } from './harness';
import { ApiFailure } from '@/api/transport';
import { newUserSampleState } from '@/sample/fresh';
import { todayText } from '@/ui/beranda/Widgets';

const settle = async () => {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
  }
};

const noPlace = () => new ApiFailure('server', { status: 404, error: 'tidak_ada_lokasi' });

beforeEach(() => {
  jest.clearAllMocks();
});

test('tanggal dan jam di bawah sapaan: hari, tanggal, bulan, dan jam HP', () => {
  expect(todayText(new Date(2026, 9, 27, 9, 5))).toBe('Selasa, 27 Oktober · 09.05');
  expect(todayText(new Date(2026, 10, 1, 23, 59))).toBe('Minggu, 1 November · 23.59');
});

test('cuaca dari tempat tersimpan: suhu, keadaan, tempat, tertinggi dan terendah; ketuk membuka chat', async () => {
  await renderWithProviders(<Beranda />, { state: newUserSampleState });
  await settle();
  const widget = within(screen.getByTestId('widget-cuaca'));
  expect(widget.getByText('27°')).toBeOnTheScreen();
  expect(widget.getByText('Berawan')).toBeOnTheScreen();
  expect(widget.getByText('Bandung')).toBeOnTheScreen();
  expect(widget.getByText('30° / 22°')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: /^Cuaca Bandung/ }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/chat', params: { isi: 'Cuaca hari ini bagaimana?' } });
});

test('tanpa tempat tersimpan: tawaran izin lokasi; diizinkan: cuaca di sekitar HP (lokasi dibulatkan)', async () => {
  const api = createTestApi({ sample: newUserSampleState });
  const weather = jest.spyOn(api.transport, 'weather').mockRejectedValueOnce(noPlace());
  await renderWithProviders(<Beranda />, { api });
  await settle();
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Cuaca di sekitar Anda. Izinkan lokasi' }));
  await settle();
  expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(weather).toHaveBeenLastCalledWith({ lat: -6.91, lon: 107.61 });
  expect(within(screen.getByTestId('widget-cuaca')).getByText('Sekitar Anda')).toBeOnTheScreen();
});

test('izin lokasi sudah ada sebelumnya: langsung cuaca di sekitar HP tanpa bertanya lagi', async () => {
  jest
    .mocked(Location.getForegroundPermissionsAsync)
    .mockResolvedValueOnce({ granted: true, status: 'granted', canAskAgain: true } as never);
  const api = createTestApi({ sample: newUserSampleState });
  const weather = jest.spyOn(api.transport, 'weather').mockRejectedValueOnce(noPlace());
  await renderWithProviders(<Beranda />, { api });
  await settle();
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(weather).toHaveBeenLastCalledWith({ lat: -6.91, lon: 107.61 });
  expect(within(screen.getByTestId('widget-cuaca')).getByText('27°')).toBeOnTheScreen();
});

test('izin lokasi ditolak: tawaran membuka pengaturan HP', async () => {
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValueOnce({ granted: false, status: 'denied', canAskAgain: false } as never);
  const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as never);
  const api = createTestApi({ sample: newUserSampleState });
  jest.spyOn(api.transport, 'weather').mockRejectedValueOnce(noPlace());
  await renderWithProviders(<Beranda />, { api });
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: 'Cuaca di sekitar Anda. Izinkan lokasi' }));
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: 'Lokasi belum diizinkan. Buka pengaturan' }));
  expect(open).toHaveBeenCalled();
});

test('server tanpa penyedia cuaca (501): widget cuaca tidak tampil, widget agenda memenuhi barisnya', async () => {
  const api = createTestApi({ sample: newUserSampleState });
  jest
    .spyOn(api.transport, 'weather')
    .mockRejectedValue(new ApiFailure('unavailable', { status: 501, error: 'belum_tersedia' }));
  await renderWithProviders(<Beranda />, { api });
  await settle();
  expect(screen.queryByTestId('widget-cuaca')).toBeNull();
  expect(within(screen.getByTestId('blok-agenda')).getByTestId('widget-agenda')).toBeOnTheScreen();
});

test('tab aktif: kapsul membulat di belakang ikon (bukan kotak), tab lain tanpa kapsul', async () => {
  await showRoute('/');
  await settle();
  const style = (id: string) => {
    const el = screen.getByTestId(id, { includeHiddenElements: true });
    return Object.assign({}, ...[el.props.style].flat(3).filter(Boolean)) as { borderRadius?: number; height?: number };
  };
  expect(style('tab-penanda-index').borderRadius).toBe(18);
  expect(screen.getByRole('tab', { name: 'Beranda' })).toBeSelected();
  expect(screen.getByRole('tab', { name: 'Agenda' })).not.toBeSelected();
});
