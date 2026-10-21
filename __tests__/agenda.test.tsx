import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import Agenda from '../app/(tabs)/agenda';
import Tambah, { PREVIEW_DEBOUNCE_MS } from '../app/agenda/tambah';
import { ERROR_TEXT } from '@/api/errors';
import { createTestApi, renderWithProviders } from './helpers';
import { AgendaItem } from '@/ui/agenda/AgendaItem';
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
  expect(router.push).toHaveBeenCalledWith({ pathname: '/alarm', params: { id: 'jemput:2025-10-20', preview: '1' } });
});

test('item yang ditunda menulis jam barunya', async () => {
  await renderWithProviders(<Agenda />, { actions: [{ type: 'snooze', id: 'jemput:2025-10-20', until: '16.10' }] });
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
  expect(screen.getByText('Oktober 2025')).toBeOnTheScreen();
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
  // Server belum ditanya selama masih diketik; pratinjau datang sesudah jeda.
  expect(screen.getByText('Menyiapkan pratinjau…')).toBeOnTheScreen();
  expect(screen.queryByText('Akan saya simpan sebagai')).toBeNull();
  await advance(PREVIEW_DEBOUNCE_MS);
  expect(screen.queryByText('Menyiapkan pratinjau…')).toBeNull();
  expect(screen.getByText('Akan saya simpan sebagai')).toBeOnTheScreen();
  expect(screen.getByText('Bayar pajak motor')).toBeOnTheScreen();
  expect(screen.getByText('Pengingat')).toBeOnTheScreen();
  expect(screen.getByText('Sabtu, 25 Okt')).toBeOnTheScreen();
  expect(screen.getByText('09.00')).toBeOnTheScreen();
  expect(screen.getByText('Bunyi sebagai alarm')).toBeOnTheScreen();
  expect(screen.getByText('Jamnya saya tebak.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
  await advance(0);
  expect(latest.agenda.find((a) => a.title === 'Bayar pajak motor')).toMatchObject({
    date: '2025-10-25',
    time: '09.00',
    kind: 'reminder',
    way: 'alarm',
  });
  expect(latest.toast?.text).toBe('Tersimpan di agenda.');
  expect(router.back).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  expect(router.back).toHaveBeenCalled();
});

test('Tambah: jam disebut berarti catatan tebakan hilang; mic membuka Mode Suara', async () => {
  await renderWithProviders(<Tambah />);
  await fireEvent.changeText(
    screen.getByPlaceholderText('Ingatkan saya bayar pajak motor tanggal 25'),
    'Cek stok besok jam 14.00',
  );
  await advance(PREVIEW_DEBOUNCE_MS);
  expect(screen.getByText('Tugas')).toBeOnTheScreen();
  expect(screen.getByText('14.00')).toBeOnTheScreen();
  expect(screen.queryByText('Jamnya saya tebak.')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Bicara' }));
  expect(router.push).toHaveBeenCalledWith('/suara');
});

test('Tambah: kalimat yang tidak terbaca memberi petunjuk ramah, bukan teks kendala umum', async () => {
  await renderWithProviders(<Tambah />);
  await fireEvent.changeText(screen.getByPlaceholderText('Ingatkan saya bayar pajak motor tanggal 25'), '???');
  await advance(PREVIEW_DEBOUNCE_MS);
  expect(screen.getByText('Saya belum paham waktunya. Coba tulis misalnya: besok jam 9 rapat.')).toBeOnTheScreen();
  expect(screen.queryByText('Akan saya simpan sebagai')).toBeNull();
  expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
});

test('Tambah: pratinjau menyebut jenisnya (Pengingat, Tugas, Rapat, Rutin) dengan ikon yang sesuai', async () => {
  const api = createTestApi();
  const kinds = ['reminder', 'task', 'meeting', 'recurring'] as const;
  const labels = ['Pengingat', 'Tugas', 'Rapat', 'Rutin'];
  for (const [i, kind] of kinds.entries()) {
    const base = await api.transport.agendaParse('Ingatkan saya cek stok besok jam 9');
    jest.spyOn(api.transport, 'agendaParse').mockResolvedValueOnce({
      preview: { item: { ...base.preview.item, kind }, guessedTime: false },
    });
    const view = await renderWithProviders(<Tambah />, { api });
    await fireEvent.changeText(
      screen.getByPlaceholderText('Ingatkan saya bayar pajak motor tanggal 25'),
      `kalimat ${i}`,
    );
    await advance(PREVIEW_DEBOUNCE_MS);
    expect(screen.getByText(labels[i]!)).toBeOnTheScreen();
    expect(
      screen.getByTestId(`ikon-${{ reminder: 'bell', task: 'task', meeting: 'camera', recurring: 'bell' }[kind]}`),
    ).toBeOnTheScreen();
    await view.unmount();
  }
});

test('Tambah: mengetik terus hanya bertanya ke server sekali, setelah berhenti', async () => {
  const api = createTestApi();
  const parse = jest.spyOn(api.transport, 'agendaParse');
  await renderWithProviders(<Tambah />, { api });
  const input = screen.getByPlaceholderText('Ingatkan saya bayar pajak motor tanggal 25');
  await fireEvent.changeText(input, 'Ingatkan');
  await advance(200);
  await fireEvent.changeText(input, 'Ingatkan saya telepon Pak Budi');
  await advance(200);
  expect(parse).not.toHaveBeenCalled();
  await fireEvent.changeText(input, 'Ingatkan saya telepon Pak Budi besok jam 3 sore');
  await advance(PREVIEW_DEBOUNCE_MS);
  expect(parse).toHaveBeenCalledTimes(1);
  expect(parse).toHaveBeenCalledWith('Ingatkan saya telepon Pak Budi besok jam 3 sore');
  expect(screen.getByText('Telepon Pak Budi')).toBeOnTheScreen();
  expect(screen.getByText('15.00')).toBeOnTheScreen();
  // Teks dikosongkan: pratinjau hilang dan Simpan mati lagi.
  await fireEvent.changeText(input, '');
  expect(screen.queryByText('Akan saya simpan sebagai')).toBeNull();
  expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
});

test('Tambah: pratinjau lama tidak dipakai selama teks sudah berubah', async () => {
  await renderWithProviders(<Tambah />);
  const input = screen.getByPlaceholderText('Ingatkan saya bayar pajak motor tanggal 25');
  await fireEvent.changeText(input, 'Cek stok gudang');
  await advance(PREVIEW_DEBOUNCE_MS);
  expect(screen.getByRole('button', { name: 'Simpan' })).toBeEnabled();
  await fireEvent.changeText(input, 'Cek stok gudang kopi');
  expect(screen.getByText('Menyiapkan pratinjau…')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
});

test('Tambah: server gagal menjawab, pesan ramah muncul tanpa kode; mengetik lagi mencoba lagi', async () => {
  const api = createTestApi();
  await renderWithProviders(<Tambah />, { api });
  api.transport.failNext('server');
  const input = screen.getByPlaceholderText('Ingatkan saya bayar pajak motor tanggal 25');
  await fireEvent.changeText(input, 'Cek stok gudang');
  await advance(PREVIEW_DEBOUNCE_MS);
  expect(screen.getByText(ERROR_TEXT)).toBeOnTheScreen();
  expect(screen.queryByText('Menyiapkan pratinjau…')).toBeNull();
  await fireEvent.changeText(input, 'Cek stok gudang kopi');
  await advance(PREVIEW_DEBOUNCE_MS);
  expect(screen.queryByText(ERROR_TEXT)).toBeNull();
  expect(screen.getByText('Akan saya simpan sebagai')).toBeOnTheScreen();
});

test('Tambah: simpan yang gagal tidak menutup lembar dan menampilkan pesan ramah', async () => {
  const api = createTestApi();
  await renderWithProviders(<Tambah />, { api });
  await fireEvent.changeText(
    screen.getByPlaceholderText('Ingatkan saya bayar pajak motor tanggal 25'),
    'Cek stok gudang',
  );
  await advance(PREVIEW_DEBOUNCE_MS);
  api.transport.failNext('network');
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
  await advance(0);
  expect(screen.getByText(ERROR_TEXT)).toBeOnTheScreen();
  await advance(300);
  expect(router.back).not.toHaveBeenCalled();
});

test('Agenda di mode server tanpa jawaban: pesan ramah dan Coba lagi memuat ulang', async () => {
  const api = createTestApi();
  api.transport.failNext('network');
  await renderWithProviders(<Agenda />, { api });
  expect(screen.getByText(ERROR_TEXT)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
  expect(screen.getByText('Senin, 20 Okt')).toBeOnTheScreen();
});

test('agenda berubah dari luar (stream) langsung tampil: tugas dicentang di perangkat lain', async () => {
  const api = createTestApi();
  await renderWithProviders(<Agenda />, { api });
  expect(within(row('15.00')).getByTestId('ikon-task')).toBeOnTheScreen();
  await act(async () => {
    api.transport.sample.dispatch({ type: 'setDone', id: 'a3', done: true });
  });
  expect(within(row('15.00')).getByTestId('ikon-taskDone')).toBeOnTheScreen();
});

describe('baris agenda', () => {
  const base = {
    id: 'x',
    date: '2025-10-20',
    time: '09.00',
    at: '2025-10-20T02:00:00.000Z',
    title: 'Bayar pajak',
    kind: 'reminder' as const,
  };

  test('pengingat tanpa cara dibaca notifikasi biasa; hanya cara alarm yang ditulis "Bunyi sebagai alarm"', async () => {
    await renderWithProviders(
      <>
        <AgendaItem item={{ ...base, id: 'a' }} />
        <AgendaItem item={{ ...base, id: 'b', title: 'Alarm', way: 'alarm' }} />
        <AgendaItem item={{ ...base, id: 'c', title: 'Notif', way: 'notif' }} />
      </>,
    );
    expect(screen.getAllByText('Lewat notifikasi')).toHaveLength(2);
    expect(screen.getAllByText('Bunyi sebagai alarm')).toHaveLength(1);
  });

  test('"Ditunda sampai" memakai zona waktu pengguna dari server, bukan zona HP', async () => {
    const snoozed = { ...base, snoozedUntil: '2025-10-20T17:10:00.000Z' };
    const view = await renderWithProviders(<AgendaItem item={snoozed} tzOffsetMinutes={420} />);
    expect(screen.getByText('Ditunda sampai 00.10')).toBeOnTheScreen();
    await view.unmount();
    await renderWithProviders(<AgendaItem item={snoozed} tzOffsetMinutes={480} />);
    expect(screen.getByText('Ditunda sampai 01.10')).toBeOnTheScreen();
  });
});

test('tombol Akun di Agenda membuka Akun', async () => {
  await renderWithProviders(<Agenda />);
  await fireEvent.press(screen.getByRole('button', { name: 'Akun' }));
  expect(router.push).toHaveBeenCalledWith('/akun');
});
