import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { LAYAR } from './daftar-layar';
import { renderWithProviders } from './helpers';
import { useLocalSearchParams } from 'expo-router';
import { dark, light, onVoice } from '@/theme/tokens';

// Latar yang hanya cocok di mode terang. Di mode gelap tidak boleh muncul di layar mana pun. Putih (#FFFFFF) tidak
// termasuk: dipakai juga untuk jempol sakelar dan kotak QRIS di dua mode.
const HANYA_TERANG = new Set(
  [light.bg, light.sunken, light.sunken2, light.brandSoft, light.line].map((h) => h.toLowerCase()),
);
// Ciri palet gelap: salah satunya harus ada di tiap layar berlatar biasa.
const CIRI_GELAP = [dark.bg, dark.text, dark.surface, dark.sunken].map((h) => h.toLowerCase());

/**
 * Pengecualian yang disengaja (dicari lewat nama layar dan warna):
 * - Tampilan: petak pratinjau "Terang" memakai warna terang di dua mode.
 * Mode Suara dan Alarm memakai kanvas suara (#07090B) dengan tombol terang `onVoice.strong` di dua mode.
 */
const IZIN: Record<string, string[]> = {
  // Petak pratinjau pilihan Terang memang berwarna terang.
  Tampilan: [light.bg.toLowerCase(), light.line.toLowerCase()],
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

describe.each(LAYAR)('mode gelap: $nama', ({ nama, Layar, params, actions, state, selaluForest }) => {
  test('memakai palet gelap dan tanpa latar khusus terang', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue(params ?? {});
    await renderWithProviders(<Layar />, { scheme: 'dark', actions, state });
    const { bg, semua } = warna();
    const izin = new Set(IZIN[nama] ?? []);
    const terang = [...bg].filter((h) => HANYA_TERANG.has(h) && !izin.has(h));
    expect(terang).toEqual([]);
    if (selaluForest) {
      // Kanvas suara tetap, dengan teks terang di atasnya.
      expect([...semua].some((h) => h === onVoice.text.toLowerCase() || h === light.voiceCanvas.toLowerCase())).toBe(
        true,
      );
    } else {
      expect([...semua].some((h) => CIRI_GELAP.includes(h))).toBe(true);
    }
  });
});

test('penelusur warna sungguh menemukan latar terang di mode terang (bukan lolos karena kosong)', async () => {
  const { Layar } = LAYAR[0]!;
  await renderWithProviders(<Layar />, { scheme: 'light' });
  expect(warna().bg.has(light.bg.toLowerCase())).toBe(true);
});
