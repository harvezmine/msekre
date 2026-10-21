import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import {
  CATEGORIES,
  dark,
  darkTheme,
  light,
  lightTheme,
  markerDark,
  markerLight,
  motion,
  onVoice,
  space,
  typeScale,
  type Markers,
  type Palette,
} from '@/theme/tokens';

type Rgb = [number, number, number];
/** "#RRGGBB" atau "rgba(r,g,b,a)"; warna transparan dicampur di atas `under` (latar sesungguhnya). */
function rgb(color: string, under?: Rgb): Rgb {
  const m = color.match(/^rgba\(([^)]+)\)$/);
  if (m) {
    const [r, g, b, a] = m[1]!.split(',').map(Number) as [number, number, number, number];
    const u = under ?? [255, 255, 255];
    return [r * a + u[0] * (1 - a), g * a + u[1] * (1 - a), b * a + u[2] * (1 - a)];
  }
  const n = color.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)) as Rgb;
}

/** Kontras WCAG 2.x; `b` boleh transparan (dicampur di atas `under`). */
function contrast(a: string, b: string, under?: string): number {
  const lum = ([r, g, bl]: Rgb) => {
    const ch = [r, g, bl].map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
  };
  const bg = rgb(b, under ? rgb(under) : undefined);
  const [hi, lo] = [lum(rgb(a, bg)), lum(bg)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const keysDeep = (o: object, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? keysDeep(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const MODES: [string, Palette, Markers][] = [
  ['terang', light, markerLight],
  ['gelap', dark, markerDark],
];

test('setiap token terang punya pasangan gelap (warna, penanda, bayangan, gradasi)', () => {
  expect(keysDeep(dark).sort()).toEqual(keysDeep(light).sort());
  expect(keysDeep(markerDark).sort()).toEqual(keysDeep(markerLight).sort());
  expect(keysDeep(darkTheme.shadow).sort()).toEqual(keysDeep(lightTheme.shadow).sort());
  expect(Object.keys(darkTheme.field).sort()).toEqual(Object.keys(lightTheme.field).sort());
  for (const recipe of [...Object.values(lightTheme.field), ...Object.values(darkTheme.field)]) {
    expect(recipe.length).toBeGreaterThan(0);
  }
  expect(CATEGORIES).toEqual(Object.keys(markerLight));
});

test('palet v2: kertas netral, hijau brand, penanda kategori tanpa latar lembut', () => {
  expect(light.bg).toBe('#F7F6F2');
  expect(dark.bg).toBe('#0E1012');
  expect(light.brand).toBe('#1D7550');
  expect(dark.brand).toBe('#5BBF86');
  expect(light.brandSoft).toBe('#E3F1E8');
  // Penanda kategori sengaja hanya punya `base` dan `ink`: tidak ada bahan untuk permukaan berwarna kategori.
  for (const m of [...Object.values(markerLight), ...Object.values(markerDark)]) {
    expect(Object.keys(m).sort()).toEqual(['base', 'ink']);
  }
  // Tidak ada sisa palet hijau lama di latar.
  for (const p of [light, dark]) {
    expect(Object.values(p)).not.toContain('#F6F6F0');
    expect(Object.values(p)).not.toContain('#0A1F18');
  }
});

describe.each(MODES)('kontras WCAG AA, mode %s', (_nama, p, m) => {
  test.each(['bg', 'surface', 'sunken'] as const)('teks dan teks redup di atas %s ≥ 4,5', (bg) => {
    expect(contrast(p.text, p[bg])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.muted, p[bg])).toBeGreaterThanOrEqual(4.5);
  });

  test.each(CATEGORIES)('tinta penanda %s di atas latar, permukaan, dan lingkaran netral ≥ 4,5', (cat) => {
    expect(contrast(m[cat].ink, p.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(m[cat].ink, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(m[cat].ink, p.sunken)).toBeGreaterThanOrEqual(4.5);
  });

  test('hijau brand: tombol, tinta di atas latar lembut, keadaan menyala', () => {
    expect(contrast(p.onBrand, p.brand)).toBeGreaterThanOrEqual(4.5);
    // `brandSoft` gelap transparan: dihitung di atas permukaan, seperti di layar.
    expect(contrast(p.brandInk, p.brandSoft, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.muted, p.brandSoft, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.text, p.brandSoft, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.brandInk, p.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.brandInk, p.surface)).toBeGreaterThanOrEqual(4.5);
    // Tombol hapus: isian tinta koral dengan teks `onBrand`.
    expect(contrast(p.onBrand, m.warn.ink)).toBeGreaterThanOrEqual(4.5);
  });
});

test('teks di kanvas suara terbaca di dua mode', () => {
  expect(contrast(onVoice.text, light.voiceCanvas)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(onVoice.soft, light.voiceCanvas)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(onVoice.hint, light.voiceCanvas)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(onVoice.onStrong, onVoice.strong)).toBeGreaterThanOrEqual(4.5);
});

test('kenyamanan dulu: sentuhan utama ≥ 56, tombol remote ≥ 60, teks isi ≥ 16, gerak pelan', () => {
  expect(space.hit).toBeGreaterThanOrEqual(56);
  expect(space.key).toBeGreaterThanOrEqual(60);
  expect(space.rowMin).toBeGreaterThanOrEqual(64);
  expect(typeScale.body.fontSize).toBeGreaterThanOrEqual(16);
  expect(typeScale.row.fontSize).toBeGreaterThanOrEqual(17);
  expect(typeScale.caption.fontSize).toBeGreaterThanOrEqual(13);
  expect(typeScale.readout).toMatchObject({ fontSize: 100, fontFamily: 'PlusJakartaSans_300Light' });
  expect(motion.block).toMatchObject({ duration: 320, stagger: 80 });
});

function Probe() {
  const t = useTheme();
  return <Text>{`${t.scheme} ${t.c.bg} ${t.marker.agenda.base} ${t.radius.card} ${t.motion.press.scale}`}</Text>;
}

test('useTheme membuka warna, aksen, radius, dan gerak; gelap lewat provider', async () => {
  await render(<Probe />);
  expect(screen.getByText('light #F7F6F2 #3B6FE0 28 0.97')).toBeOnTheScreen();
  await render(
    <ThemeProvider scheme="dark">
      <Probe />
    </ThemeProvider>,
  );
  expect(screen.getByText('dark #0E1012 #6E96F5 28 0.97')).toBeOnTheScreen();
});
