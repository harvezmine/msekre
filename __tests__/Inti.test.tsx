import { StyleSheet } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle as animatedStyle } from 'react-native-reanimated';
import { Inti } from '@/ui/inti/Inti';
import { intiSize } from '@/ui/inti/size';

type Animated = { opacity?: number; transform?: Record<string, number>[] };
// Tipe resmi yang terpilih adalah stub web (tanpa argumen); di Jest yang berjalan versi native.
const getAnimatedStyle = animatedStyle as unknown as (el: unknown) => Animated;

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

test('berbicara: gelombang kedua dan ketiga tak terlihat sebelum gilirannya', async () => {
  await render(<Inti size={140} state="speak" />);
  expect(getAnimatedStyle(screen.getByTestId('inti-gelombang-1')).opacity).toBe(0);
  expect(getAnimatedStyle(screen.getByTestId('inti-gelombang-2')).opacity).toBe(0);
});

test('berpikir lalu diam: ketiga titik kembali ke posisi dan terang semula', async () => {
  await render(<Inti size={140} state="think" />);
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  await screen.rerender(<Inti size={140} state="idle" />);
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  for (let i = 0; i < 3; i++) {
    const style = getAnimatedStyle(screen.getByTestId(`inti-titik-${i}`));
    expect(style.opacity).toBe(1);
    expect(style.transform).toEqual([{ translateY: 0 }]);
  }
});

test('warna titik: hijau muda di latar gelap, hijau tua di latar terang', async () => {
  await render(<Inti size={140} onDark />);
  expect(StyleSheet.flatten(screen.getByTestId('inti-titik-0').props.style).backgroundColor).toBe('#C9E6C7');
  await screen.unmount();
  await render(<Inti size={140} />);
  expect(StyleSheet.flatten(screen.getByTestId('inti-titik-0').props.style).backgroundColor).toBe('#2A8A5C');
});
