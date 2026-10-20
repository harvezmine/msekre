import { fireEvent, render, screen } from '@testing-library/react-native';
import { Toggle } from '@/ui/Toggle';

test('sakelar memberi tahu nilai barunya dan terbaca oleh pembaca layar', async () => {
  const onChange = jest.fn();
  await render(<Toggle value label="AC kamar" onChange={onChange} />);
  const sw = screen.getByRole('switch', { name: 'AC kamar' });
  expect(sw).toBeChecked();
  await fireEvent.press(sw);
  expect(onChange).toHaveBeenCalledWith(false);
});
