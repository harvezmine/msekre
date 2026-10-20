import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Inti } from '@/ui/inti/Inti';
import { intiSize } from '@/ui/inti/size';

test('ukuran mengikuti rasio pita logo 282×310', () => {
  const s = intiSize(140);
  expect(s.w).toBe(127);
  expect(s.h).toBe(140);
  expect(s.dot).toBeCloseTo(9.52);
  expect(intiSize(36).dot).toBe(3);
});

test('tiga titik gelembung chat selalu ada', async () => {
  await render(<Inti size={140} state="think" />);
  expect(screen.getAllByTestId(/^inti-titik-/)).toHaveLength(3);
});

test('tanpa sinyal, Inti memudar', async () => {
  await render(<Inti size={140} state="off" />);
  expect(StyleSheet.flatten(screen.getByTestId('inti-inti').props.style).opacity).toBe(0.35);
});

test('mendengar menambah dua cincin, berbicara tiga gelombang', async () => {
  await render(<Inti size={140} state="listen" />);
  expect(screen.getAllByTestId(/^inti-cincin-/)).toHaveLength(2);
  await screen.unmount();
  await render(<Inti size={140} state="speak" />);
  expect(screen.getAllByTestId(/^inti-gelombang-/)).toHaveLength(3);
});
