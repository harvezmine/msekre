import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle as animatedStyle } from 'react-native-reanimated';
import { Toggle } from '@/ui/Toggle';

type AnimatedStyle = { opacity?: number; transform?: Record<string, number>[] };
// Tipe resmi yang terpilih adalah stub web (tanpa argumen); di Jest yang berjalan versi native.
const getAnimatedStyle = animatedStyle as unknown as (el: unknown) => AnimatedStyle;

test('sakelar memberi tahu nilai barunya dan terbaca oleh pembaca layar', async () => {
  const onChange = jest.fn();
  await render(<Toggle value label="AC kamar" onChange={onChange} />);
  const sw = screen.getByRole('switch', { name: 'AC kamar' });
  expect(sw).toBeChecked();
  await fireEvent.press(sw);
  expect(onChange).toHaveBeenCalledWith(false);
});

test('jempol sakelar bergeser ke kiri setelah nilai berubah ke mati', async () => {
  await render(<Toggle value label="AC kamar" onChange={() => {}} />);
  expect(getAnimatedStyle(screen.getByTestId('sakelar-jempol')).transform).toEqual([{ translateX: 20 }]);
  await screen.rerender(<Toggle value={false} label="AC kamar" onChange={() => {}} />);
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  expect(getAnimatedStyle(screen.getByTestId('sakelar-jempol')).transform).toEqual([{ translateX: 0 }]);
});
