import { StyleSheet } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle as animatedStyle } from 'react-native-reanimated';
import { Inti } from '@/ui/inti/Inti';
import { intiSize } from '@/ui/inti/size';

type AnimatedStyle = { opacity?: number; transform?: Record<string, number>[] };
// Tipe resmi yang terpilih adalah stub web (tanpa argumen); di Jest yang berjalan versi native.
const getAnimatedStyle = animatedStyle as unknown as (el: unknown) => AnimatedStyle;

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
    jest.advanceTimersByTime(300);
  });
  const mid = getAnimatedStyle(screen.getByTestId('inti-titik-0'));
  expect(mid.opacity).toBeGreaterThan(0.5);
  expect(mid.transform?.[0]?.translateY).toBeLessThan(0);
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

test('dijeda: napas tetap skala 1, sedangkan tanpa jeda ia membesar', async () => {
  const scale = () => getAnimatedStyle(screen.getByTestId('inti-napas')).transform?.[0]?.scale ?? 1;
  await render(<Inti size={140} state="idle" />);
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(scale()).toBeGreaterThan(1.005);
  await screen.rerender(<Inti size={140} state="idle" paused />);
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(scale()).toBe(1);
});

test('dijeda saat berpikir: titik tetap terang di tempat, saat berbicara: gelombang tersembunyi', async () => {
  await render(<Inti size={140} state="think" paused />);
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  const dot = getAnimatedStyle(screen.getByTestId('inti-titik-0'));
  expect(dot.opacity).toBe(1);
  expect(dot.transform).toEqual([{ translateY: 0 }]);
  await screen.rerender(<Inti size={140} state="speak" paused />);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  for (let i = 0; i < 3; i++) expect(getAnimatedStyle(screen.getByTestId(`inti-gelombang-${i}`)).opacity).toBe(0);
});
