import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Chat from '../app/chat';
import Suara from '../app/suara';

beforeEach(() => jest.clearAllMocks());

test('chat kosong menawarkan empat saran dan bisa pindah ke Mode Suara', async () => {
  await render(<Chat />);
  expect(screen.getByText('Mau saya bantu urus apa?')).toBeTruthy();
  for (const s of ['Ringkas email hari ini', 'Matikan semua lampu', 'Cek stok kedai', 'Beli token listrik']) {
    expect(screen.getByRole('button', { name: s })).toBeTruthy();
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Mode Suara' }));
  expect(router.replace).toHaveBeenCalledWith('/suara');
});

test('Mode Suara: Selesai menutup, Pindah ke ketik membuka chat', async () => {
  await render(<Suara />);
  await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
  expect(router.back).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Pindah ke ketik' }));
  expect(router.replace).toHaveBeenCalledWith('/chat');
});
