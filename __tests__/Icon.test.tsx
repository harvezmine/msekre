import { fireEvent, render, screen } from '@testing-library/react-native';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { ICON_PATHS, type IconName } from '@/ui/icons';

test('setiap ikon dari desain bisa digambar', async () => {
  for (const name of Object.keys(ICON_PATHS) as IconName[]) {
    await render(<Icon name={name} />);
    expect(screen.getByTestId(`ikon-${name}`)).toBeTruthy();
    await screen.unmount();
  }
});

test('tombol ikon punya label dan bisa ditekan', async () => {
  const onPress = jest.fn();
  await render(<IconButton icon="back" label="Kembali" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
