import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Orbit } from '@/ui/orbit/Orbit';
import type { OrbitNode } from '@/ui/orbit/types';

const nodes: OrbitNode[] = [
  { key: 'gcal', icon: 'calendar', label: 'Google Kalender' },
  { key: 'cctv', icon: 'camera', label: 'CCTV', offline: true },
  { key: 'bank', icon: 'bank', label: 'Bank' },
];

test('setiap simpul terbaca oleh pembaca layar, yang tidak terjangkau disebut', async () => {
  await render(<Orbit nodes={nodes} flowEveryMs={0} />);
  expect(screen.getByLabelText('Google Kalender')).toBeTruthy();
  expect(screen.getByLabelText('CCTV, tidak terjangkau')).toBeTruthy();
  expect(screen.getByTestId('simpul-offline-cctv')).toBeTruthy();
});

test('ketuk Inti, tahan Inti, dan ketuk cincin memanggil aksinya masing-masing', async () => {
  const onPressInti = jest.fn();
  const onLongPressInti = jest.fn();
  const onPressRing = jest.fn();
  await render(
    <Orbit nodes={nodes} flowEveryMs={0} onPressInti={onPressInti} onLongPressInti={onLongPressInti} onPressRing={onPressRing} />,
  );
  const inti = screen.getByRole('button', { name: 'Bicara dengan Nadia' });
  await fireEvent.press(inti);
  await fireEvent(inti, 'longPress');
  await fireEvent.press(screen.getByTestId('cincin'));
  expect(onPressInti).toHaveBeenCalledTimes(1);
  expect(onLongPressInti).toHaveBeenCalledTimes(1);
  expect(onPressRing).toHaveBeenCalledTimes(1);
});

test('aliran titik muncul setelah jedanya lewat', async () => {
  await render(<Orbit nodes={nodes} flowEveryMs={3000} />);
  expect(screen.queryByTestId('aliran-titik')).toBeNull();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(3000);
  });
  expect(screen.getByTestId('aliran-titik')).toBeTruthy();
});

test('cincin tidak dibaca sebagai tombol oleh pembaca layar', async () => {
  await render(<Orbit nodes={nodes} flowEveryMs={0} onPressRing={jest.fn()} />);
  expect(screen.queryByRole('button', { name: 'Buka Terhubung' })).toBeNull();
  expect(screen.getAllByRole('button')).toHaveLength(1);
});
