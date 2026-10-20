import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { dark, light, typeScale } from '@/theme/tokens';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

test('terang dan gelap punya token yang sama', () => {
  expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
});

test('warna utama sama dengan logo dan situs', () => {
  expect(light.green).toBe('#1D7550');
  expect(light.paper).toBe('#F6F6F0');
  expect(dark.paper).toBe('#0A1F18');
});

test('skala huruf sesuai brief', () => {
  expect(typeScale.display).toMatchObject({ fontSize: 32, lineHeight: 40 });
  expect(typeScale.caption).toMatchObject({ fontSize: 13, lineHeight: 18 });
});

function Probe() {
  const { scheme, c } = useTheme();
  return <Text>{`${scheme} ${c.paper}`}</Text>;
}

test('tanpa provider memakai mode terang', async () => {
  await render(<Probe />);
  expect(screen.getByText('light #F6F6F0')).toBeTruthy();
});

test('provider gelap memberi palet gelap', async () => {
  await render(
    <ThemeProvider scheme="dark">
      <Probe />
    </ThemeProvider>,
  );
  expect(screen.getByText('dark #0A1F18')).toBeTruthy();
});
