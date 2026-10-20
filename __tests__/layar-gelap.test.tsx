import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { LAYAR } from './daftar-layar';
import { renderWithProviders } from './helpers';
import { useLocalSearchParams } from 'expo-router';
import { dark, light } from '@/theme/tokens';

// Latar yang hanya cocok di mode terang. Di mode gelap tidak boleh muncul di layar mana pun.
const HANYA_TERANG = new Set(
  [light.paper, light.card, light.mint, light.quiet, light.quietTile].map((h) => h.toLowerCase()),
);
// Ciri palet gelap: salah satunya harus ada di tiap layar berlatar kertas.
const CIRI_GELAP = [dark.paper, dark.ink, dark.card, dark.mint].map((h) => h.toLowerCase());

/**
 * Pengecualian yang disengaja (dicari lewat nama layar dan warna):
 * - Mode Suara: tombol "Selesai" memang terang (onForest.strong, #F6F6F0) di atas latar forest, di dua mode.
 * - Alarm: tombol geser "Matikan" juga terang (onForest.strong) di atas forest, di dua mode.
 * - QRIS di chat memakai kotak putih (#FFFFFF) supaya bisa dipindai; putih tidak termasuk daftar terang di atas.
 */
const IZIN: Record<string, string[]> = {
  Suara: [light.paper.toLowerCase()],
  Alarm: [light.paper.toLowerCase()],
};

interface Node {
  type: string;
  props: Record<string, unknown>;
  children: unknown[];
}

function warna(): { bg: Set<string>; semua: Set<string> } {
  const bg = new Set<string>();
  const semua = new Set<string>();
  const walk = (n: Node | string) => {
    if (typeof n === 'string' || !n) return;
    const style = StyleSheet.flatten(n.props?.style as never) as Record<string, unknown> | undefined;
    if (style) {
      for (const [k, v] of Object.entries(style)) {
        if (typeof v !== 'string' || !/color/i.test(k)) continue;
        const h = v.toLowerCase();
        semua.add(h);
        if (k === 'backgroundColor') bg.add(h);
      }
    }
    (n.children ?? []).forEach((ch) => walk(ch as Node));
  };
  const root = screen.toJSON();
  [root].flat().forEach((r) => walk(r as unknown as Node));
  return { bg, semua };
}

afterEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({}));

describe.each(LAYAR)('mode gelap: $nama', ({ nama, Layar, params, actions, selaluForest }) => {
  test('memakai palet gelap dan tanpa latar khusus terang', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue(params ?? {});
    await renderWithProviders(<Layar />, { scheme: 'dark', actions });
    const { bg, semua } = warna();
    const izin = new Set(IZIN[nama] ?? []);
    const terang = [...bg].filter((h) => HANYA_TERANG.has(h) && !izin.has(h));
    expect(terang).toEqual([]);
    if (selaluForest) {
      // Latar forest tetap, dengan teks terang di atasnya.
      expect([...semua].some((h) => h === '#ecf2ea' || h === '#f6f6f0' || h === light.voice.toLowerCase())).toBe(true);
    } else {
      expect([...semua].some((h) => CIRI_GELAP.includes(h))).toBe(true);
    }
  });
});

test('penelusur warna sungguh menemukan latar terang di mode terang (bukan lolos karena kosong)', async () => {
  const { Layar } = LAYAR[0]!;
  await renderWithProviders(<Layar />, { scheme: 'light' });
  expect(warna().bg.has(light.paper.toLowerCase())).toBe(true);
});
