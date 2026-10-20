import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import IntiPreview from '../app/inti';

beforeEach(() => jest.clearAllMocks());

test('menampilkan kelima keadaan Inti', async () => {
  await render(<IntiPreview />);
  for (const n of ['Diam', 'Mendengar', 'Berpikir', 'Berbicara', 'Tanpa sinyal']) {
    expect(screen.getByText(n)).toBeTruthy();
  }
});

test('Kembali memanggil router.back', async () => {
  await render(<IntiPreview />);
  await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));
  expect(router.back).toHaveBeenCalled();
});
