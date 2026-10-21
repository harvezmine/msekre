import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Txt } from '@/ui/Txt';

test('varian display memakai 32/38 semibold dan warna teks', async () => {
  await render(<Txt v="display">Selamat pagi</Txt>);
  const s = StyleSheet.flatten(screen.getByText('Selamat pagi').props.style);
  expect(s).toMatchObject({
    fontSize: 32,
    lineHeight: 38,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#15181B',
  });
});

test('angka tabular dan ketebalan bisa diatur', async () => {
  await render(
    <Txt tabular weight={600}>
      09.00
    </Txt>,
  );
  const s = StyleSheet.flatten(screen.getByText('09.00').props.style);
  expect(s.fontVariant).toEqual(['tabular-nums']);
  expect(s.fontFamily).toBe('PlusJakartaSans_600SemiBold');
});
