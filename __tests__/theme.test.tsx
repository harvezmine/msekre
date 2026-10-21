import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { dark, light, typeScale } from '@/theme/tokens';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

test('terang dan gelap punya token yang sama', () => {
  expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
});

test('warna utama sama dengan logo dan situs; kertas netral Fase R', () => {
  expect(light.brand).toBe('#1D7550');
  expect(light.bg).toBe('#F7F6F2');
  expect(dark.bg).toBe('#0E1012');
});

test('skala huruf sesuai spesifikasi Fase R v2', () => {
  expect(typeScale.display).toMatchObject({ fontSize: 32, lineHeight: 38 });
  expect(typeScale.caption).toMatchObject({ fontSize: 14, lineHeight: 18 });
});

function Probe() {
  const { scheme, c } = useTheme();
  return <Text>{`${scheme} ${c.bg}`}</Text>;
}

test('tanpa provider memakai mode terang', async () => {
  await render(<Probe />);
  expect(screen.getByText('light #F7F6F2')).toBeTruthy();
});

test('provider gelap memberi palet gelap', async () => {
  await render(
    <ThemeProvider scheme="dark">
      <Probe />
    </ThemeProvider>,
  );
  expect(screen.getByText('dark #0E1012')).toBeTruthy();
});
