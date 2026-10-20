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
  expect(router.push).toHaveBeenCalledWith('/chat');
});

test('mode gelap tetap menampilkan isi yang sama', async () => {
  await render(
    <ThemeProvider scheme="dark">
      <Beranda />
    </ThemeProvider>,
  );
  expect(screen.getByText('Selamat pagi, Rina')).toBeTruthy();
});
