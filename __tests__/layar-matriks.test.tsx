import { act, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LAYAR } from './daftar-layar';
import { ROUTES } from './harness';
import { renderWithProviders } from './helpers';
import type { Scheme } from '@/theme/ThemeProvider';

// Ponsel sempit: 360 x 740 dp.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 3, fontScale: 1 }),
}));

afterEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({}));

/** Layar yang tidak ada di `daftar-layar` (lembar kecil dan izin), supaya semua rute app/ ikut diperiksa. */
const TAMBAHAN = [
  { nama: 'Keluar', Layar: ROUTES['/keluar']! },
  { nama: 'Mode data', Layar: ROUTES['/mode']! },
  { nama: 'Izin notifikasi', Layar: ROUTES['/izin-notifikasi']! },
  // Katalog komponen (build pengembangan saja); memasang tema sendiri, jadi tidak ikut tes mode gelap.
  { nama: 'Katalog komponen', Layar: ROUTES['/dev/kit']! },
];
const SEMUA = [...LAYAR, ...TAMBAHAN] as {
  nama: string;
  Layar: (typeof LAYAR)[number]['Layar'];
  params?: Record<string, string>;
  actions?: (typeof LAYAR)[number]['actions'];
  state?: (typeof LAYAR)[number]['state'];
}[];

const TERLARANG = [/\bFase\b/, /\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /\bnull\b/, /\bMilo\b/, /dibangun/i];

/** Semua teks yang terlihat atau terbaca: isi Text, label aksesibilitas, dan petunjuk kolom. */
function semuaTeks(): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n) return;
    if (typeof n === 'string') {
      out.push(n);
      return;
    }
    const node = n as { props?: Record<string, unknown>; children?: unknown[] };
    for (const key of ['accessibilityLabel', 'placeholder', 'accessibilityHint']) {
      const v = node.props?.[key];
      if (typeof v === 'string') out.push(v);
    }
    node.children?.forEach(walk);
  };
  [screen.toJSON()].flat().forEach(walk);
  return out;
}

const skema: Scheme[] = ['light', 'dark'];

describe.each(skema)('matriks layar, mode %s, 360 dp', (scheme) => {
  test.each(SEMUA.map((l) => [l.nama, l] as const))('%s: tampil, tanpa teks rusak', async (_nama, layar) => {
    jest.mocked(useLocalSearchParams).mockReturnValue(layar.params ?? {});
    await renderWithProviders(<layar.Layar />, { actions: layar.actions, state: layar.state, scheme });
    // Data dimuat lewat server tiruan; beri waktu sampai isinya tampil.
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
    }
    expect(screen.toJSON()).not.toBeNull();
    const teks = semuaTeks();
    expect(teks.length).toBeGreaterThan(0);
    const salah = teks.flatMap((t) => TERLARANG.filter((p) => p.test(t)).map((p) => `${t} ~ ${p}`));
    expect(salah).toEqual([]);
  });
});

test('setiap berkas rute di app/ punya layar di daftar uji', () => {
  const rute: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const e of readdirSync(join(__dirname, '..', 'app', dir), { withFileTypes: true })) {
      if (e.isDirectory()) {
        walk(join(dir, e.name), prefix + e.name + '/');
        continue;
      }
      if (!e.name.endsWith('.tsx') || e.name.startsWith('_') || e.name.startsWith('+')) continue;
      let name = prefix + e.name.replace(/\.tsx$/, '');
      name = name.replace(/^\(tabs\)\//, '').replace(/(^|\/)index$/, '');
      rute.push('/' + name);
    }
  };
  walk('', '');
  expect(rute.length).toBeGreaterThan(30);
  for (const r of rute) expect(Object.keys(ROUTES)).toContain(r);
  // Dan tiap rute dipakai oleh setidaknya satu kasus matriks (dibandingkan lewat komponennya).
  const dipakai = new Set(SEMUA.map((l) => l.Layar));
  for (const r of rute) expect({ r, dipakai: dipakai.has(ROUTES[r]!) }).toEqual({ r, dipakai: true });
});
