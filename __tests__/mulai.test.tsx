import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Keyboard } from 'react-native';
import { useEffect } from 'react';
import Mulai from '../app/mulai/index';
import Masuk from '../app/mulai/masuk';
import Pilih from '../app/mulai/pilih';
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
const withProbe = (ui: React.ReactElement) =>
  renderWithProviders(
    <>
      {ui}
      <Probe />
    </>,
  );

test('layar 1: sapaan, titik pertama aktif, Mulai ke masuk', async () => {
  await renderWithProviders(<Mulai />);
  expect(screen.getByText('Halo, saya Nadia, sekretaris AI Anda.')).toBeTruthy();
  expect(screen.getAllByTestId('titik-aktif')).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Mulai' }));
  expect(router.push).toHaveBeenCalledWith('/mulai/masuk');
});

test('layar 2: Masuk menunggu nomor dan 6 angka kode', async () => {
  await renderWithProviders(<Masuk />);
  const masuk = () => screen.getByRole('button', { name: 'Masuk' });
  const phone = screen.getByLabelText('Nomor WhatsApp');
  const code = screen.getByLabelText('Kode dari WhatsApp');
  expect(screen.getAllByTestId('titik-aktif')).toHaveLength(2);
  expect(phone.props.value).toBe('812-2045-7781');
  expect(masuk()).toBeDisabled();

  await fireEvent.changeText(code, '12345');
  expect(masuk()).toBeDisabled();
  await fireEvent.changeText(code, '12a3456x9');
  expect(code.props.value).toBe('123456');
  expect(masuk()).toBeEnabled();

  await fireEvent.changeText(phone, '0812 2045 7781');
  expect(phone.props.value).toBe('812-2045-7781');
  await fireEvent.changeText(phone, '08122');
  expect(masuk()).toBeDisabled();
  await fireEvent.changeText(phone, '08122045');
  expect(masuk()).toBeDisabled();
  await fireEvent.changeText(phone, '0812204578');
  expect(masuk()).toBeEnabled();

  // Seperti server: kode hanya sah untuk nomor yang sudah meminta kode.
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
  await fireEvent.press(masuk());
  expect(router.push).toHaveBeenCalledWith('/mulai/pilih');
});

test('keyboard kode tertutup otomatis pada angka keenam, tidak sebelumnya', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  try {
    await renderWithProviders(<Masuk />);
    const code = screen.getByLabelText('Kode dari WhatsApp');
    await fireEvent.changeText(code, '12345');
    expect(dismiss).not.toHaveBeenCalled();
    await fireEvent.changeText(code, '123456');
    expect(dismiss).toHaveBeenCalledTimes(1);
  } finally {
    dismiss.mockRestore();
  }
});

test('Ubah mengosongkan nomor', async () => {
  await renderWithProviders(<Masuk />);
  await fireEvent.press(screen.getByRole('button', { name: 'Ubah' }));
  expect(screen.getByLabelText('Nomor WhatsApp').props.value).toBe('');
});

test('Kirim kode memulai hitung mundur dari jawaban server; Kirim ulang kode setelah habis', async () => {
  await withProbe(<Masuk />);
  expect(screen.queryByText(/Kirim ulang kode dalam/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
  expect(latest.toast?.text).toBe('Kode dikirim lewat WhatsApp.');
  expect(screen.getByText('Kirim ulang kode dalam 01.00')).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(screen.getByText('Kirim ulang kode dalam 00.58')).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(58000);
  });
  expect(screen.queryByText(/Kirim ulang kode dalam/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim ulang kode' }));
  expect(latest.toast?.text).toBe('Kode baru dikirim lewat WhatsApp.');
  expect(screen.getByText('Kirim ulang kode dalam 01.00')).toBeTruthy();
});

test('layar 3: Jadwal dipilih lebih dulu, tombol mengikuti pilihan pertama', async () => {
  await withProbe(<Pilih />);
  expect(screen.getAllByTestId('titik-aktif')).toHaveLength(3);
  const box = (n: string) => screen.getByRole('checkbox', { name: n });
  expect(box('Jadwal & pesan')).toBeChecked();
  expect(screen.getByRole('button', { name: 'Sambungkan Google Kalender' })).toBeTruthy();
  expect(screen.getByText('Kita mulai dari Google Kalender. Yang lain bisa menyusul.')).toBeTruthy();

  await fireEvent.press(box('Usaha'));
  expect(box('Usaha')).toBeChecked();
  expect(box('Jadwal & pesan')).toBeChecked();
  await fireEvent.press(box('Jadwal & pesan'));
  expect(screen.getByRole('button', { name: 'Sambungkan Moka' })).toBeTruthy();
  await fireEvent.press(box('Rumah'));
  expect(screen.getByRole('button', { name: 'Pasang Kotak Sekretaris AI' })).toBeTruthy();

  await fireEvent.press(box('Rumah'));
  await fireEvent.press(box('Usaha'));
  expect(screen.getByRole('button', { name: 'Lanjut ke Beranda' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Lanjut ke Beranda' }));
  expect(latest.onboarded).toBe(true);
  expect(router.dismissTo).toHaveBeenCalledWith('/');
});

test('tombol utama selesai dengan toast dan membuka Beranda', async () => {
  await withProbe(<Pilih />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sambungkan Google Kalender' }));
  expect(latest.onboarded).toBe(true);
  expect(latest.toast?.text).toBe('Google Kalender bisa disambungkan dari Terhubung.');
  expect(router.dismissTo).toHaveBeenCalledWith('/');
});

test('Lewati dulu langsung ke Beranda', async () => {
  await withProbe(<Pilih />);
  await fireEvent.press(screen.getByRole('button', { name: 'Lewati dulu' }));
  expect(latest.onboarded).toBe(true);
  expect(router.dismissTo).toHaveBeenCalledWith('/');
});
