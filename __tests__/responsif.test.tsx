import { act, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import type { ComponentType } from 'react';
import { StyleSheet } from 'react-native';
import NotFound from '../app/+not-found';
import { LAYAR } from './daftar-layar';
import { ROUTES } from './harness';
import { renderWithProviders } from './helpers';
import { layoutClassFor } from '@/ui/kit/layout';
import type { SampleAction } from '@/sample/store';

// Ukuran jendela per kasus. Kode aplikasi hanya membaca ukuran lewat useWindowDimensions (tanpa Dimensions.get).
let mockWindow = { width: 360, height: 640, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

afterEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({}));

/** HP terpendek dan HP terpanjang yang diuji (§9 spesifikasi: 360×640 compact, 412×915 tall). */
const UKURAN = [
  { w: 360, h: 640 },
  { w: 412, h: 915 },
] as const;

interface Node {
  type: string;
  props: Record<string, unknown>;
  children: (Node | string)[] | null;
}

/** Semua lebar tetap (width, minWidth) di layar yang lebih besar dari jendela: tanda sesuatu terpotong di HP sempit. */
function terlaluLebar(window: number): string[] {
  const out: string[] = [];
  const walk = (n: Node | string | null) => {
    if (!n || typeof n === 'string') return;
    const style = StyleSheet.flatten(n.props?.style as never) as Record<string, unknown> | undefined;
    for (const key of ['width', 'minWidth'] as const) {
      const v = style?.[key];
      if (typeof v === 'number' && v > window)
        out.push(`${n.type}${n.props.testID ? `#${n.props.testID}` : ''} ${key}=${v}`);
    }
    n.children?.forEach(walk);
  };
  [screen.toJSON()].flat().forEach((r) => walk(r as unknown as Node));
  return out;
}

/** Wadah aksi utama: bagian bawah layar (zona jempol), panel lembar bawah, atau kontrol Mode Suara. */
const ZONA = new Set(['zona-jempol', 'lembar-panel', 'suara-kontrol']);

function diZonaJempol(el: ReturnType<typeof screen.getByRole>): boolean {
  for (let p = el.parent; p; p = p.parent) {
    if (typeof p.props.testID === 'string' && ZONA.has(p.props.testID)) return true;
  }
  return false;
}

async function tampil(
  Layar: ComponentType,
  { params, actions }: { params?: Record<string, string>; actions?: SampleAction[] } = {},
) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params ?? {});
  await renderWithProviders(<Layar />, { actions });
  // Data dimuat lewat server tiruan; beri waktu sampai isinya tampil.
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
  }
}

describe.each(UKURAN)('$w×$h', ({ w, h }) => {
  beforeEach(() => {
    mockWindow = { width: w, height: h, scale: 3, fontScale: 1 };
  });

  test('kelas tata letak sesuai ukurannya', () => {
    expect(layoutClassFor(w, h)).toBe(h < 700 ? 'compact' : 'tall');
  });

  test.each(LAYAR.map((l) => [l.nama, l] as const))('%s: tidak ada yang lebih lebar dari layar', async (_n, l) => {
    await tampil(l.Layar, { params: l.params, actions: l.actions });
    expect(terlaluLebar(w)).toEqual([]);
  });

  /** Aksi utama tiap layar (yang paling sering dipakai) harus berada di wadah zona jempol, bukan di atas. */
  const UTAMA: {
    nama: string;
    Layar: ComponentType;
    role: 'button' | 'switch';
    name: string | RegExp;
    params?: Record<string, string>;
    actions?: SampleAction[];
  }[] = [
    { nama: 'Agenda: Tambah', Layar: ROUTES['/agenda']!, role: 'button', name: 'Tambah' },
    { nama: 'Usaha: Pesan', Layar: ROUTES['/usaha']!, role: 'button', name: 'Pesan lagi Susu UHT' },
    { nama: 'Chat: mic/kirim', Layar: ROUTES['/chat']!, role: 'button', name: 'Bicara' },
    { nama: 'Chat kosong: mic', Layar: ROUTES['/chat']!, role: 'button', name: 'Bicara', params: { kosong: '1' } },
    { nama: 'Alarm: Tunda', Layar: ROUTES['/alarm']!, role: 'button', name: 'Tunda 10 menit' },
    { nama: 'Mode Suara: Selesai', Layar: ROUTES['/suara']!, role: 'button', name: 'Selesai' },
    {
      nama: 'Remote AC: daya',
      Layar: ROUTES['/perangkat/[id]']!,
      role: 'switch',
      name: 'Daya',
      params: { id: 'ac-kamar' },
    },
    {
      nama: 'Remote lampu: daya',
      Layar: ROUTES['/perangkat/[id]']!,
      role: 'switch',
      name: 'Daya',
      params: { id: 'lampu-utama' },
    },
    { nama: 'Mulai', Layar: ROUTES['/mulai']!, role: 'button', name: 'Mulai' },
    { nama: 'Masuk', Layar: ROUTES['/mulai/masuk']!, role: 'button', name: 'Masuk' },
    { nama: 'Pilih', Layar: ROUTES['/mulai/pilih']!, role: 'button', name: /^Sambungkan|^Pasang|^Lanjut/ },
    {
      nama: 'Tersambung: Selesai',
      Layar: ROUTES['/terhubung/tersambung']!,
      role: 'button',
      name: 'Selesai',
      params: { id: 'tiktok' },
      actions: [{ type: 'connect', id: 'tiktok' }],
    },
    { nama: 'Tambah agenda: Simpan', Layar: ROUTES['/agenda/tambah']!, role: 'button', name: 'Simpan' },
    { nama: 'Keluar', Layar: ROUTES['/keluar']!, role: 'button', name: 'Keluar' },
    { nama: 'Halaman tidak ada', Layar: NotFound, role: 'button', name: 'Ke Beranda' },
  ];

  test.each(UTAMA.map((u) => [u.nama, u] as const))('%s ada di zona jempol', async (_n, u) => {
    await tampil(u.Layar, { params: u.params, actions: u.actions });
    const el = screen.getAllByRole(u.role, { name: u.name })[0]!;
    expect(diZonaJempol(el)).toBe(true);
  });

  test('pemeriksa sungguh membedakan: kontrol kepala tidak di zona jempol', async () => {
    await tampil(ROUTES['/agenda']!);
    expect(diZonaJempol(screen.getByRole('button', { name: 'Kalender, Oktober' }))).toBe(false);
    await tampil(ROUTES['/usaha']!);
    expect(diZonaJempol(screen.getByRole('button', { name: 'Lainnya' }))).toBe(false);
  });
});

test('pemeriksa lebar sungguh menemukan lebar tetap (dial AC 320 di 360 melebihi batas uji 300)', async () => {
  mockWindow = { width: 360, height: 740, scale: 3, fontScale: 1 };
  await tampil(ROUTES['/perangkat/[id]']!, { params: { id: 'ac-kamar' } });
  expect(terlaluLebar(360)).toEqual([]);
  expect(terlaluLebar(300).length).toBeGreaterThan(0);
});

describe('skala huruf 1,3 di 360×640', () => {
  beforeEach(() => {
    mockWindow = { width: 360, height: 640, scale: 3, fontScale: 1.3 };
  });

  const KUNCI = ['Agenda', 'Usaha', 'Chat (percakapan)', 'Riwayat', 'Terhubung (daftar)', 'Alarm', 'Mulai (masuk)'];

  test.each(KUNCI)('%s: angka raksasa dibatasi, baris memakai tinggi minimum', async (nama) => {
    const l = LAYAR.find((x) => x.nama === nama)!;
    await tampil(l.Layar, { params: l.params, actions: l.actions });
    const besar: string[] = [];
    const tetap: string[] = [];
    let dilihat = 0;
    const walk = (n: Node | string | null, parentFixed: number | null) => {
      if (!n || typeof n === 'string') return;
      const style = (StyleSheet.flatten(n.props?.style as never) ?? {}) as Record<string, unknown>;
      // Teks besar (≥ 40) harus dibatasi pembesarannya, supaya angka tidak menabrak tepi layar.
      if (n.type === 'Text' && typeof style.fontSize === 'number' && style.fontSize >= 40) {
        dilihat += 1;
        const cap = n.props.maxFontSizeMultiplier;
        if (typeof cap !== 'number' || cap > 1.2) besar.push(`${style.fontSize}`);
      }
      // Teks baca (≥ 15) langsung di dalam kotak bertinggi tetap yang sempit terpotong saat huruf membesar.
      if (n.type === 'Text' && parentFixed !== null && parentFixed < 40 && typeof style.fontSize === 'number') {
        if (style.fontSize >= 15 && n.props.maxFontSizeMultiplier === undefined) {
          tetap.push(`${String((n.children ?? []).join(''))} di tinggi ${parentFixed}`);
        }
      }
      const fixed = typeof style.height === 'number' ? style.height : null;
      n.children?.forEach((ch) => walk(ch, n.type === 'Text' ? parentFixed : fixed));
    };
    [screen.toJSON()].flat().forEach((r) => walk(r as unknown as Node, null));
    expect(besar).toEqual([]);
    expect(tetap).toEqual([]);
    if (nama === 'Usaha' || nama === 'Alarm') expect(dilihat).toBeGreaterThan(0);
  });
});
