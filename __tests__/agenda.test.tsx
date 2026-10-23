import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Agenda from '../app/(tabs)/agenda';
import Tambah, { PREVIEW_DEBOUNCE_MS, VIA_CHAT_TEXT } from '../app/agenda/tambah';
import { ERROR_TEXT } from '@/api/errors';
import { createTestApi, renderWithProviders, toastNow, useSample } from './helpers';
import { detailWords, snoozedText } from '@/ui/agenda/AgendaItem';
import { light } from '@/theme/tokens';
import { type SampleState } from '@/sample/store';

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
const day = (label: RegExp) => screen.getByRole('button', { name: label });
const color = (n: ReturnType<typeof screen.getByText>) => StyleSheet.flatten(n.props.style).color;

test('Hari ini: rel waktu urut dengan garis sekarang, satu ikon per jenis, rincian hanya dibacakan', async () => {
  await renderWithProviders(<Agenda />);
  expect(day(/^Senin, 20 Okt, hari ini/)).toBeSelected();
  expect(screen.getAllByText(/^\d\d\.\d\d$/).map((t) => t.props.children)).toEqual([
    '09.00',
    '09.41',
    '13.00',
    '15.00',
    '16.00',
    '19.00',
  ]);
  expect(screen.getByTestId('garis-sekarang')).toBeOnTheScreen();
  expect(within(row('09.00')).getByRole('link', { name: 'Notulen siap' })).toBeOnTheScreen();
  expect(within(row('13.00')).getByTestId('ikon-call')).toBeOnTheScreen();
  expect(row('13.00')).toHaveAccessibleName(/Telepon saya/);
  expect(row('15.00')).not.toBeChecked();
  expect(within(row('16.00')).getByTestId('ikon-bell')).toBeOnTheScreen();
  expect(row('16.00')).toHaveAccessibleName(/Bunyi sebagai alarm\. Tiap Senin/);
  expect(within(row('19.00')).getByTestId('ikon-camera')).toBeOnTheScreen();
  expect(row('19.00')).toHaveAccessibleName(/Google Meet/);
  // Sedikit tulisan: tanpa keterangan di bawah judul, tanpa hitungan, tanpa tanggal panjang.
  for (const t of ['Telepon saya', 'Bunyi sebagai alarm', 'Tiap Senin', 'Google Meet', 'Senin, 20 Okt']) {
    expect(screen.queryByText(t)).toBeNull();
  }
  // Sisa tugas kemarin ditanyakan asisten di chat, tidak di layar ini.
  expect(screen.queryByText('Kirim penawaran katering ke Bu Sari')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Kerjakan hari ini' })).toBeNull();
});

test('yang sudah lewat redup; yang berikutnya di kartu putih', async () => {
  await renderWithProviders(<Agenda />);
  expect(color(screen.getByText('Rapat dengan supplier susu'))).toBe(light.muted);
  expect(color(screen.getByText('Bayar listrik Kedai Dago'))).toBe(light.text);
  expect(StyleSheet.flatten(row('13.00').props.style).backgroundColor).toBe(light.surface);
  expect(StyleSheet.flatten(row('15.00').props.style).backgroundColor).toBe('transparent');
});

test('ketuk butir membuka satu baris rinciannya, ketuk lagi menutup', async () => {
  await renderWithProviders(<Agenda />);
  await fireEvent.press(row('16.00'));
  expect(screen.getByText('Bunyi sebagai alarm · Tiap Senin')).toBeOnTheScreen();
  await fireEvent.press(row('13.00'));
  expect(screen.queryByText('Bunyi sebagai alarm · Tiap Senin')).toBeNull();
  expect(screen.getByText('Telepon saya')).toBeOnTheScreen();
  await fireEvent.press(row('13.00'));
  expect(screen.queryByText('Telepon saya')).toBeNull();
});

test('mengetuk tugas mencentangnya (kotak besar) dan mengetuk lagi melepasnya', async () => {
  await renderWithProviders(<Agenda />);
  await fireEvent.press(row('15.00'));
  expect(row('15.00')).toBeChecked();
  expect(within(row('15.00')).getByTestId('centang-selesai')).toBeOnTheScreen();
  await fireEvent.press(row('15.00'));
  expect(row('15.00')).not.toBeChecked();
});

test('Notulen siap membuka chat; Tambah membuka lembar; mic membuka Mode Suara; tahan pengingat membuka alarm', async () => {
  await renderWithProviders(<Agenda />);
  await fireEvent.press(screen.getByRole('link', { name: 'Notulen siap' }));
  expect(router.navigate).toHaveBeenCalledWith('/chat');
  await fireEvent.press(screen.getByRole('button', { name: 'Tambah' }));
  expect(router.push).toHaveBeenCalledWith('/agenda/tambah');
  await fireEvent.press(within(screen.getByTestId('zona-jempol')).getByRole('button', { name: 'Bicara' }));
  expect(router.push).toHaveBeenCalledWith('/suara');
  await fireEvent(row('16.00'), 'longPress');
  expect(router.push).toHaveBeenCalledWith({ pathname: '/alarm', params: { id: 'jemput:2025-10-20', preview: '1' } });
});

test('item yang ditunda menulis jam barunya (keadaan penting, tetap tertulis)', async () => {
  await renderWithProviders(<Agenda />, { actions: [{ type: 'snooze', id: 'jemput:2025-10-20', until: '16.10' }] });
  expect(screen.getByText('Ditunda sampai 16.10')).toBeOnTheScreen();
});

test('pekan: tujuh hari Sen–Min, titik di hari beragenda, ketuk hari menampilkan harinya', async () => {
  await renderWithProviders(<Agenda />);
  for (const d of ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']) expect(screen.getByText(d)).toBeOnTheScreen();
  for (const d of [21, 22, 23, 24, 26]) expect(screen.getByTestId(`titik-hari-${d}`)).toBeOnTheScreen();
  expect(screen.queryByTestId('titik-hari-25')).toBeNull();
  await fireEvent.press(day(/^Selasa, 21 Okt/));
  expect(day(/^Selasa, 21 Okt/)).toBeSelected();
  expect(screen.getByText('Telepon Pak Budi soal harga sewa')).toBeOnTheScreen();
  expect(screen.getByText('Berangkat ke bandara')).toBeOnTheScreen();
  // Bukan hari ini: tanpa garis sekarang dan tanpa yang redup.
  expect(screen.queryByTestId('garis-sekarang')).toBeNull();
  await fireEvent.press(day(/^Sabtu, 25 Okt/));
  expect(screen.getByText('Hari itu longgar.')).toBeOnTheScreen();
});

test('Kalender: lembar sebulan, titik di hari beragenda, memilih tanggal menampilkan harinya', async () => {
  await renderWithProviders(<Agenda />);
  await fireEvent.press(screen.getByRole('button', { name: 'Kalender, Oktober' }));
  expect(screen.getByText('Oktober 2025')).toBeOnTheScreen();
  for (const d of ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg']) expect(screen.getByText(d)).toBeOnTheScreen();
  expect(screen.getByTestId('titik-22')).toBeOnTheScreen();
  expect(screen.queryByTestId('titik-25')).toBeNull();
  expect(screen.getByRole('button', { name: /^20 Oktober, hari ini/ })).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: /^22 Oktober/ }));
  await advance(250);
  expect(screen.queryByText('Oktober 2025')).toBeNull();
  expect(day(/^Rabu, 22 Okt/)).toBeSelected();
  expect(screen.getByText('Belanja bahan kedai')).toBeOnTheScreen();
  expect(screen.queryByText('Rapat manajer kedai')).toBeNull();
});

test('Tambah: Simpan nonaktif sampai ada teks, pratinjau dari teks, Simpan menambah item dan toast', async () => {
  await renderWithProviders(
    <>
      <Tambah />
      <Probe />
    </>,
  );
  expect(screen.getByText('Tambah ke agenda')).toBeOnTheScreen();
  expect(screen.queryByText('Tulis seperti biasa, nanti saya rapikan.')).toBeNull();
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
  expect(toastNow()?.text).toBe('Tersimpan di agenda.');
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
      screen.getByTestId(`aksen-${{ reminder: 'bell', task: 'task', meeting: 'camera', recurring: 'bell' }[kind]}`, {
        includeHiddenElements: true,
      }),
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

test('Tambah: server belum bisa membaca kalimat (501): "Saya catat lewat chat ya", Simpan mengirimnya ke chat', async () => {
  const api = createTestApi();
  const send = jest.spyOn(api.transport, 'send');
  await renderWithProviders(<Tambah />, { api });
  api.transport.failNext('unavailable');
  await fireEvent.changeText(
    screen.getByPlaceholderText('Ingatkan saya bayar pajak motor tanggal 25'),
    'Ingatkan saya bayar pajak motor tanggal 25',
  );
  await advance(PREVIEW_DEBOUNCE_MS);
  expect(screen.getByText(VIA_CHAT_TEXT)).toBeOnTheScreen();
  expect(screen.queryByText('Akan saya simpan sebagai')).toBeNull();
  expect(screen.queryByText('Menyiapkan pratinjau…')).toBeNull();
  expect(screen.getByRole('button', { name: 'Simpan' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
  await advance(0);
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'text', text: 'Ingatkan saya bayar pajak motor tanggal 25' }),
  );
  expect(toastNow()?.text).toBe(VIA_CHAT_TEXT);
  await advance(300);
  expect(router.back).toHaveBeenCalled();
});

test('Tambah: pratinjau ada tapi menyimpan belum tersedia (501): kalimatnya dikirim ke chat', async () => {
  const api = createTestApi();
  const send = jest.spyOn(api.transport, 'send');
  await renderWithProviders(<Tambah />, { api });
  await fireEvent.changeText(
    screen.getByPlaceholderText('Ingatkan saya bayar pajak motor tanggal 25'),
    'Cek stok gudang',
  );
  await advance(PREVIEW_DEBOUNCE_MS);
  api.transport.failNext('unavailable');
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
  await advance(0);
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ text: 'Cek stok gudang' }));
  expect(toastNow()?.text).toBe(VIA_CHAT_TEXT);
});

test('Agenda di mode server tanpa jawaban: pesan ramah dan Coba lagi memuat ulang', async () => {
  const api = createTestApi();
  api.transport.failNext('network');
  await renderWithProviders(<Agenda />, { api });
  expect(screen.getByText(ERROR_TEXT)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
  expect(day(/^Senin, 20 Okt, hari ini/)).toBeOnTheScreen();
});

test('agenda berubah dari luar (stream) langsung tampil: tugas dicentang di perangkat lain', async () => {
  const api = createTestApi();
  await renderWithProviders(<Agenda />, { api });
  expect(row('15.00')).not.toBeChecked();
  await act(async () => {
    api.transport.sample.dispatch({ type: 'setDone', id: 'a3', done: true });
  });
  expect(row('15.00')).toBeChecked();
});

describe('rincian butir agenda', () => {
  const base = {
    id: 'x',
    date: '2025-10-20',
    time: '09.00',
    at: '2025-10-20T02:00:00.000Z',
    title: 'Bayar pajak',
    kind: 'reminder' as const,
  };

  test('pengingat tanpa cara dibaca notifikasi biasa; hanya cara alarm yang "Bunyi sebagai alarm"', () => {
    expect(detailWords(base)).toEqual(['Lewat notifikasi']);
    expect(detailWords({ ...base, way: 'notif' })).toEqual(['Lewat notifikasi']);
    expect(detailWords({ ...base, way: 'alarm', repeat: 'Tiap Senin' })).toEqual(['Bunyi sebagai alarm', 'Tiap Senin']);
    expect(detailWords({ ...base, way: 'call' })).toEqual(['Telepon saya']);
  });

  test('"Ditunda sampai" memakai zona waktu pengguna dari server, bukan zona HP', () => {
    const snoozed = { ...base, snoozedUntil: '2025-10-20T17:10:00.000Z' };
    expect(snoozedText(snoozed, 420)).toBe('Ditunda sampai 00.10');
    expect(snoozedText(snoozed, 480)).toBe('Ditunda sampai 01.10');
  });
});

test('Agenda tanpa avatar Akun (Akun hanya dari Beranda)', async () => {
  await renderWithProviders(<Agenda />);
  expect(screen.queryByRole('button', { name: 'Akun' })).toBeNull();
});
