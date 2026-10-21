import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Chat from '../app/chat';
import Suara from '../app/suara';
import { renderWithProviders } from './helpers';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({ kosong: '1' });
});

afterEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({}));

test('chat kosong menawarkan empat saran dan bisa pindah ke Mode Suara', async () => {
  await renderWithProviders(<Chat />);
  expect(screen.getByText('Mau saya bantu urus apa?')).toBeTruthy();
  for (const s of ['Ringkas email hari ini', 'Matikan semua lampu', 'Cek stok kedai', 'Beli token listrik']) {
    expect(screen.getByRole('button', { name: s })).toBeTruthy();
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Mode Suara' }));
  expect(router.replace).toHaveBeenCalledWith('/suara');
});

test('Mode Suara: Selesai menutup, Ketik membuka kolom ketik di tempat', async () => {
  await renderWithProviders(<Suara />);
  await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
  expect(router.back).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Ketik' }));
  expect(screen.getByLabelText('Ketik pesan')).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalledWith('/chat');
});
