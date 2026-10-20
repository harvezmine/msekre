import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Txt } from '@/ui/Txt';

test('varian display memakai 32/40 semibold dan warna ink', async () => {
  await render(<Txt v="display">Selamat pagi</Txt>);
  const s = StyleSheet.flatten(screen.getByText('Selamat pagi').props.style);
  expect(s).toMatchObject({
    fontSize: 32,
    lineHeight: 40,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0D2B22',
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
