import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AccessibilityInfo, BackHandler, Text } from 'react-native';
import Tempat from '../app/tempat';
import { useSample, type SampleState } from '@/sample/store';
import { FilterChips } from '@/ui/FilterChips';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { Toast, ToastHost } from '@/ui/Toast';
import { renderWithProviders } from './helpers';

beforeEach(() => jest.clearAllMocks());

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

test('Sheet: ketuk latar menutup dan memanggil onClose setelah animasi', async () => {
  const onClose = jest.fn();
  await renderWithProviders(
    <Sheet onClose={onClose}>
      <Text>Isi lembar</Text>
    </Sheet>,
  );
  expect(screen.getByText('Isi lembar')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Tutup' }));
  await advance(250);
  expect(onClose).toHaveBeenCalledTimes(1);
  // ketukan kedua tidak memanggil ulang
  await fireEvent.press(screen.getByRole('button', { name: 'Tutup' }));
  await advance(250);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('Sheet: tombol kembali Android menutup', async () => {
  const handlers: (() => boolean)[] = [];
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, h) => {
    handlers.push(h as () => boolean);
    return { remove: jest.fn() };
  });
  const onClose = jest.fn();
  await renderWithProviders(
    <Sheet onClose={onClose}>
      <Text>Isi</Text>
    </Sheet>,
  );
  await act(async () => {
    expect(handlers[0]!()).toBe(true);
  });
  await advance(250);
  expect(onClose).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});

test('Toast: tampil dengan teks dan sebagai pesan yang dibacakan', async () => {
  await render(<Toast text="Tersimpan." />);
  expect(screen.getByText('Tersimpan.')).toBeOnTheScreen();
  expect(screen.getByTestId('toast')).toHaveProp('accessibilityLiveRegion', 'polite');
});

test('ToastHost: tampil dari penyimpanan dan hilang sendiri setelah 2,6 detik', async () => {
  let dispatch!: ReturnType<typeof useSample>['dispatch'];
  function Probe() {
    dispatch = useSample().dispatch;
    return null;
  }
  await renderWithProviders(
    <>
      <ToastHost />
      <Probe />
    </>,
  );
  expect(screen.queryByText('Kiriman dibatalkan.')).not.toBeOnTheScreen();
  await act(async () => dispatch({ type: 'showToast', text: 'Kiriman dibatalkan.' }));
  expect(screen.getByText('Kiriman dibatalkan.')).toBeOnTheScreen();
  await advance(2500);
  expect(screen.getByText('Kiriman dibatalkan.')).toBeOnTheScreen();
  await advance(150);
  expect(screen.queryByText('Kiriman dibatalkan.')).not.toBeOnTheScreen();
});

test('ToastHost: teks yang sama dua kali memulai ulang 2,6 detik dan dibacakan lagi', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  let dispatch!: ReturnType<typeof useSample>['dispatch'];
  function Probe() {
    dispatch = useSample().dispatch;
    return null;
  }
  await renderWithProviders(
    <>
      <ToastHost />
      <Probe />
    </>,
  );
  await act(async () => dispatch({ type: 'showToast', text: 'Tersimpan di agenda.' }));
  expect(announce).toHaveBeenCalledTimes(1);
  expect(announce).toHaveBeenLastCalledWith('Tersimpan di agenda.');
  await advance(2000);
  await act(async () => dispatch({ type: 'showToast', text: 'Tersimpan di agenda.' }));
  expect(announce).toHaveBeenCalledTimes(2);
  // waktu toast pertama sudah lewat, tapi toast kedua masih tampil
  await advance(2500);
  expect(screen.getByText('Tersimpan di agenda.')).toBeOnTheScreen();
  await advance(150);
  expect(screen.queryByText('Tersimpan di agenda.')).not.toBeOnTheScreen();
  expect(announce).toHaveBeenCalledTimes(2);
  announce.mockRestore();
});

test('Segmented memanggil onChange dan menandai pilihan', async () => {
  const onChange = jest.fn();
  await render(<Segmented options={['Hari ini', 'Minggu ini', 'Kalender']} value="Hari ini" onChange={onChange} />);
  expect(screen.getByRole('tab', { name: 'Hari ini' })).toBeSelected();
  expect(screen.getByRole('tab', { name: 'Kalender' })).not.toBeSelected();
  await fireEvent.press(screen.getByRole('tab', { name: 'Minggu ini' }));
  expect(onChange).toHaveBeenCalledWith('Minggu ini');
});

test('FilterChips memanggil onChange dan menandai pilihan', async () => {
  const onChange = jest.fn();
  await render(<FilterChips options={['Semua', 'Pesan', 'Rumah']} value="Semua" onChange={onChange} />);
  expect(screen.getByRole('button', { name: 'Semua' })).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: 'Rumah' }));
  expect(onChange).toHaveBeenCalledWith('Rumah');
});

test('ListRow menampilkan judul dan keterangan, dan bisa ditekan', async () => {
  const onPress = jest.fn();
  await render(
    <ListGroup>
      <ListRow icon="mail" title="Gmail" subtitle="Aktif · terakhir dibaca 2 menit lalu" onPress={onPress} last />
    </ListGroup>,
  );
  expect(screen.getByText('Gmail')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: /Gmail/ }));
  expect(onPress).toHaveBeenCalled();
});

test('/tempat: daftar tempat dengan centang di tempat sekarang, memilih mengubah tempat dan menutup', async () => {
  let seen: SampleState | undefined;
  function Probe() {
    seen = useSample().state;
    return null;
  }
  await renderWithProviders(
    <>
      <Tempat />
      <Probe />
    </>,
  );
  for (const p of ['Semua', 'Rumah', 'Kedai Dago', 'Kedai Riau']) {
    expect(screen.getByRole('button', { name: p })).toBeOnTheScreen();
  }
  expect(screen.getByRole('button', { name: 'Semua' })).toBeSelected();
  expect(screen.getByRole('button', { name: 'Rumah' })).not.toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: 'Kedai Dago' }));
  expect(seen!.place).toBe('Kedai Dago');
  expect(router.back).toHaveBeenCalled();
});
