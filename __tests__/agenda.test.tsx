import { fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import Agenda from '../app/(tabs)/agenda';
import Tambah from '../app/agenda/tambah';
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

const row = (time: string) => screen.getByRole(/button|checkbox/, { name: new RegExp(`^${time}`) });

test('Hari ini: judul, sisa, urutan dengan garis sekarang, dan ikon per jenis', async () => {
  await renderWithProviders(<Agenda />);
  expect(screen.getByText('Senin, 20 Okt')).toBeOnTheScreen();
  expect(screen.getByText('4 lagi hari ini')).toBeOnTheScreen();
  expect(screen.getAllByText(/^\d\d\.\d\d$/).map((t) => t.props.children)).toEqual([
    '09.00',
    '09.41',
    '13.00',
    '15.00',
    '16.00',
    '19.00',
  ]);
  expect(screen.getByTestId('garis-sekarang')).toBeOnTheScreen();
  expect(within(row('09.00')).getByTestId('ikon-camera')).toBeOnTheScreen();
  expect(within(row('13.00')).getByTestId('ikon-bell')).toBeOnTheScreen();
  expect(within(row('13.00')).getByTestId('ikon-call')).toBeOnTheScreen();
  expect(within(row('13.00')).getByText('Telepon saya')).toBeOnTheScreen();
  expect(within(row('15.00')).getByTestId('ikon-task')).toBeOnTheScreen();
  expect(within(row('16.00')).getByTestId('ikon-bell')).toBeOnTheScreen();
  expect(within(row('16.00')).getByText('Bunyi sebagai alarm')).toBeOnTheScreen();
  expect(within(row('16.00')).getByTestId('ikon-repeat')).toBeOnTheScreen();
  expect(within(row('16.00')).getByText('Tiap Senin')).toBeOnTheScreen();
  expect(within(row('19.00')).getByTestId('ikon-camera')).toBeOnTheScreen();
  expect(within(row('19.00')).getByText('Google Meet')).toBeOnTheScreen();
});

test('item yang sudah lewat tampil redup', async () => {
  await renderWithProviders(<Agenda />);
  expect(row('09.00').props.style.opacity ?? row('09.00').props.style[0]?.opacity).toBe(0.75);
  expect(row('13.00').props.style.opacity ?? row('13.00').props.style[0]?.opacity).toBe(1);
});

test('mengetuk tugas menandainya selesai dan kembali', async () => {
  await renderWithProviders(<Agenda />);
  await fireEvent.press(row('15.00'));
  expect(within(row('15.00')).getByTestId('ikon-taskDone')).toBeOnTheScreen();
  expect(screen.getByText('3 lagi hari ini')).toBeOnTheScreen();
  await fireEvent.press(row('15.00'));
  expect(within(row('15.00')).getByTestId('ikon-task')).toBeOnTheScreen();
});

test('Kerjakan hari ini memindahkan tugas ke hari ini dan kartu hilang', async () => {
  await renderWithProviders(<Agenda />);
  expect(screen.getByText('Kemarin belum selesai')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Kerjakan hari ini' }));
  expect(screen.queryByText('Kemarin belum selesai')).toBeNull();
  expect(within(row('17.00')).getByText('Kirim penawaran katering ke Bu Sari')).toBeOnTheScreen();
  expect(screen.getByText('5 lagi hari ini')).toBeOnTheScreen();
});

test('Lepaskan menghapus tugas kemarin dan kartu hilang', async () => {
  await renderWithProviders(<Agenda />);
  await fireEvent.press(screen.getByRole('button', { name: 'Lepaskan' }));
  expect(screen.queryByText('Kemarin belum selesai')).toBeNull();
  expect(screen.queryByText('Kirim penawaran katering ke Bu Sari')).toBeNull();
  expect(screen.getByText('4 lagi hari ini')).toBeOnTheScreen();
});

test('Notulen siap membuka chat; Tambah membuka lembar; tahan pengingat membuka alarm', async () => {
  await renderWithProviders(<Agenda />);
  await fireEvent.press(screen.getByRole('link', { name: 'Notulen siap' }));
  expect(router.navigate).toHaveBeenCalledWith('/chat');
  await fireEvent.press(screen.getByRole('button', { name: 'Tambah' }));
  expect(router.push).toHaveBeenCalledWith('/agenda/tambah');
  await fireEvent(row('16.00'), 'longPress');
  expect(router.push).toHaveBeenCalledWith({ pathname: '/alarm', params: { id: 'a4' } });
});

test('item yang ditunda menulis jam barunya', async () => {
  await renderWithProviders(<Agenda />, { actions: [{ type: 'snooze', id: 'a4', until: '16.10' }] });
  expect(screen.getByText('Ditunda sampai 16.10')).toBeOnTheScreen();
});

test('Minggu ini: tujuh hari Senin sampai Minggu, hari longgar punya kalimat ramah', async () => {
  await renderWithProviders(<Agenda />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Minggu ini' }));
  const heads = screen.getAllByRole('header').map((h) => h.props.children);
  expect(heads).toEqual(expect.arrayContaining(['Agenda']));
  for (const d of [
    'Senin, 20 Okt',
    'Selasa, 21 Okt',
    'Rabu, 22 Okt',
    'Kamis, 23 Okt',
    'Jumat, 24 Okt',
    'Sabtu, 25 Okt',
    'Minggu, 26 Okt',
  ]) {
    expect(screen.getByText(d)).toBeOnTheScreen();
  }
  expect(screen.getByText('Telepon Pak Budi soal harga sewa')).toBeOnTheScreen();
  expect(screen.getByText('Makan malam keluarga')).toBeOnTheScreen();
  expect(screen.getAllByText('Longgar, belum ada rencana.')).toHaveLength(1);
});

test('Kalender: kisi Oktober mulai Senin, titik di hari beragenda, ketuk tanggal menampilkan itemnya', async () => {
  await renderWithProviders(<Agenda />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Kalender' }));
  expect(screen.getByText('Oktober 2026')).toBeOnTheScreen();
  for (const d of ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg']) expect(screen.getByText(d)).toBeOnTheScreen();
  expect(screen.getByTestId('titik-22')).toBeOnTheScreen();
  expect(screen.queryByTestId('titik-25')).toBeNull();
  expect(screen.getByRole('button', { name: /^20 Oktober, hari ini/ })).toBeOnTheScreen();
  // pilihan awal = hari ini
  expect(screen.getByText('Rapat manajer kedai')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: /^22 Oktober/ }));
  expect(screen.getByText('Rabu, 22 Okt')).toBeOnTheScreen();
  expect(screen.getByText('Belanja bahan kedai')).toBeOnTheScreen();
  expect(screen.queryByText('Rapat manajer kedai')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /^25 Oktober/ }));
  expect(screen.getByText('Hari itu masih longgar. Mau saya ingatkan sesuatu?')).toBeOnTheScreen();
});

test('Tambah: Simpan nonaktif sampai ada teks, pratinjau dari teks, Simpan menambah item dan toast', async () => {
  await renderWithProviders(
    <>
      <Tambah />
      <Probe />
    </>,
  );
  expect(screen.getByText('Tambah ke agenda')).toBeOnTheScreen();
  expect(screen.getByText('Tulis seperti biasa, nanti saya rapikan.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
  expect(screen.queryByText('Akan saya simpan sebagai')).toBeNull();
  await fireEvent.changeText(
    screen.getByPlaceholderText('Ingatkan saya bayar pajak motor tanggal 25'),
    'Ingatkan saya bayar pajak motor tanggal 25',
  );
  expect(screen.getByText('Akan saya simpan sebagai')).toBeOnTheScreen();
  expect(screen.getByText('Bayar pajak motor')).toBeOnTheScreen();
  expect(screen.getByText('Pengingat')).toBeOnTheScreen();
  expect(screen.getByText('Sabtu, 25 Okt')).toBeOnTheScreen();
  expect(screen.getByText('09.00')).toBeOnTheScreen();
  expect(screen.getByText('Bunyi sebagai alarm')).toBeOnTheScreen();
  expect(screen.getByText('Jamnya saya tebak. Ketuk untuk mengubah.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
  expect(latest.agenda.find((a) => a.title === 'Bayar pajak motor')).toMatchObject({
    date: '2026-10-25',
    time: '09.00',
    kind: 'reminder',
    way: 'alarm',
  });
  expect(latest.toast).toBe('Tersimpan di agenda.');
  expect(router.back).toHaveBeenCalled();
});

test('Tambah: jam disebut berarti catatan tebakan hilang; mic membuka Mode Suara', async () => {
  await renderWithProviders(<Tambah />);
  await fireEvent.changeText(
    screen.getByPlaceholderText('Ingatkan saya bayar pajak motor tanggal 25'),
    'Cek stok besok jam 14.00',
  );
  expect(screen.getByText('Tugas')).toBeOnTheScreen();
  expect(screen.getByText('14.00')).toBeOnTheScreen();
  expect(screen.queryByText('Jamnya saya tebak. Ketuk untuk mengubah.')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Bicara' }));
  expect(router.push).toHaveBeenCalledWith('/suara');
});
