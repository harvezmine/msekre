import * as Haptics from 'expo-haptics';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ThemeProvider } from '@/theme/ThemeProvider';
import Beranda from '../app/(tabs)/index';

beforeEach(() => jest.clearAllMocks());

test('Beranda menampilkan isi desain 1a', async () => {
  await render(<Beranda />);
  expect(screen.getByText('Selamat pagi, Rina')).toBeTruthy();
  expect(screen.getByText('7 terhubung · CCTV tidak terjangkau')).toBeTruthy();
  expect(screen.getByText('Butuh persetujuan Anda')).toBeTruthy();
  expect(screen.getByText('Bayar listrik Kedai Dago')).toBeTruthy();
  expect(screen.getByText('Rp4.250.000')).toBeTruthy();
  expect(screen.getByText('Susu UHT tinggal 6 karton')).toBeTruthy();
});

test('sakelar AC mengubah tulisannya', async () => {
  await render(<Beranda />);
  await fireEvent.press(screen.getByRole('switch', { name: 'AC kamar' }));
  expect(screen.getByText('AC kamar mati')).toBeTruthy();
});

test('Lihat di kartu persetujuan membuka chat', async () => {
  await render(<Beranda />);
  await fireEvent.press(screen.getByRole('button', { name: 'Lihat' }));
  expect(router.navigate).toHaveBeenCalledWith('/chat');
});

test('mode gelap tetap menampilkan isi yang sama', async () => {
  await render(
    <ThemeProvider scheme="dark">
      <Beranda />
    </ThemeProvider>,
  );
  expect(screen.getByText('Selamat pagi, Rina')).toBeTruthy();
  expect(StyleSheet.flatten(screen.getByText('Selamat pagi, Rina').props.style).color).toBe('#ECF2EA');
});

test('ketuk Inti membuka chat, tahan Inti membuka Mode Suara dengan getar', async () => {
  await render(<Beranda />);
  const inti = screen.getByRole('button', { name: 'Bicara dengan Nadia' });
  await fireEvent.press(inti);
  expect(router.navigate).toHaveBeenCalledWith('/chat');
  await fireEvent(inti, 'longPress');
  expect(Haptics.impactAsync).toHaveBeenCalled();
  expect(router.navigate).toHaveBeenCalledWith('/suara');
});

test('Lihat semua membuka Agenda', async () => {
  await render(<Beranda />);
  await fireEvent.press(screen.getByRole('link', { name: 'Lihat semua' }));
  expect(router.navigate).toHaveBeenCalledWith('/agenda');
});
