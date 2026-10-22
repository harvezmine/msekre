/**
 * Inti besar Beranda dan jaring layanan di sekelilingnya: simpul dari `home.ring.nodes` (dibatasi per ukuran layar),
 * simpul tidak terjangkau diredupkan, "kurangi gerakan" diam, gerak berhenti saat layar tidak terlihat, ketuk/tahan Inti,
 * pengguna baru, dan petunjuk pertama.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router, useIsFocused } from 'expo-router';
import { StyleSheet } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import Beranda from '../app/(tabs)/index';
import { createTestApi, renderWithProviders } from './helpers';
import { newUserSampleState } from '@/sample/fresh';
import { heroMetrics, webLayout } from '@/ui/beranda/heroLayout';
import { TIP_TEXT } from '@/ui/tips';
import { holdBridge } from '@/voice/holdBridge';

let mockDims = { width: 393, height: 873, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims,
}));

/** Jam frame jaring: nilai `autostart` dan setiap `setActive`, supaya tes tahu kapan gerak jalan atau berhenti. */
const mockFrame = { active: [] as boolean[] };
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  const useReducedMotion = jest.fn(() => false);
  const useFrameCallback = (cb: unknown, autostart?: boolean) => {
    mockFrame.active.push(!!autostart);
    const real = actual.useFrameCallback(cb, autostart);
    return {
      ...real,
      setActive: (on: boolean) => {
        mockFrame.active.push(on);
        real.setActive(on);
      },
    };
  };
  return new Proxy(actual, {
    get: (target, key) =>
      key === 'useReducedMotion' ? useReducedMotion : key === 'useFrameCallback' ? useFrameCallback : target[key],
  });
});

const HIDDEN = { includeHiddenElements: true };
const style = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

const settle = () =>
  act(async () => {
    for (let i = 0; i < 3; i++) await Promise.resolve();
  });

async function show(width = 393, height = 873, options: Parameters<typeof renderWithProviders>[1] = {}) {
  mockDims = { width, height, scale: 3, fontScale: 1 };
  await renderWithProviders(<Beranda />, options);
  await settle();
}

/** Kunci simpul yang tergambar, urut seperti di layar. */
const nodeKeys = () =>
  screen.queryAllByTestId(/^simpul-/, HIDDEN).map((n) => String(n.props.testID).replace(/^simpul-(offline-)?/, ''));

beforeEach(() => {
  jest.clearAllMocks();
  mockFrame.active = [];
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
});

describe('jaring dari simpul cincin Beranda', () => {
  test('HP panjang: tujuh simpul berurutan dari server, logo asli atau ikon perangkat, Inti di tengah', async () => {
    await show();
    expect(nodeKeys()).toEqual(['gcal', 'gmail', 'wa', 'ac', 'cctv', 'kasir', 'bank']);
    const hero = screen.getByTestId('inti-besar', HIDDEN);
    // Layanan dengan logo memakai ubin logonya; perangkat dan layanan tanpa logo memakai ikonnya.
    expect(within(screen.getByTestId('simpul-gcal', HIDDEN)).getByTestId('logo-gcal', HIDDEN)).toBeTruthy();
    expect(within(screen.getByTestId('simpul-wa', HIDDEN)).getByTestId('logo-wa', HIDDEN)).toBeTruthy();
    expect(within(screen.getByTestId('simpul-ac', HIDDEN)).getByTestId('ikon-snow', HIDDEN)).toBeTruthy();
    expect(within(screen.getByTestId('simpul-bank', HIDDEN)).getByTestId('ikon-bank', HIDDEN)).toBeTruthy();
    // Ubin 32 dp; garis jari-jari per simpul dan dua garis antar-tetangga.
    expect(style(screen.getByTestId('simpul-gcal', HIDDEN)).width).toBe(32);
    expect(within(hero).getAllByTestId(/^jari-/, HIDDEN)).toHaveLength(7);
    expect(within(hero).getAllByTestId('jaring-tetangga', HIDDEN)).toHaveLength(2);
    // Pembaca layar: satu kalimat untuk jaringnya, bukan tujuh ubin.
    expect(
      screen.getByLabelText(
        'Tersambung: Google Kalender, Gmail, WhatsApp, AC kamar, Kasir Kopi Rindang, Bank, CCTV tidak terjangkau',
      ),
    ).toBeOnTheScreen();
  });

  test('jumlah simpul dibatasi per ukuran layar: 5 di HP pendek, 7 di HP panjang', async () => {
    await show(360, 640);
    expect(nodeKeys()).toEqual(['gcal', 'gmail', 'wa', 'ac', 'cctv']);
    await screen.unmount();
    await show(412, 915);
    expect(nodeKeys()).toHaveLength(7);
    expect(heroMetrics(412, 780).maxNodes).toBe(6);
  });

  test('tidak terjangkau: ubin redup dan kelabu, diam, garis putus-putus, tanpa titik cahaya', async () => {
    await show();
    const cctv = screen.getByTestId('simpul-offline-cctv', HIDDEN);
    const tile = within(cctv).getByTestId(/^logo-/, HIDDEN);
    expect(style(tile).opacity).toBe(0.45);
    expect(screen.getByTestId('jari-redup-cctv', HIDDEN).props.strokeDasharray).toBeTruthy();
    expect(screen.queryByTestId('jari-cctv', HIDDEN)).toBeNull();
    // Titik cahaya hanya ke simpul terjangkau.
    const m = heroMetrics(393, 873);
    const nodes = ['gcal', 'gmail', 'wa', 'ac', 'cctv', 'kasir', 'bank'].map((key) => ({
      key,
      icon: 'link' as const,
      label: key,
      ...(key === 'cctv' ? { offline: true } : {}),
    }));
    const order = webLayout(m, nodes).pulseOrder;
    expect(order).not.toContain(4);
    expect([...order].sort()).toEqual([0, 1, 2, 3, 5, 6]);
  });

  test('gerak jalan: jam frame menyala, dua jalur titik cahaya dan denyut simpul tergambar', async () => {
    await show();
    expect(mockFrame.active.at(-1)).toBe(true);
    expect(screen.getByTestId('jaring-cahaya-0', HIDDEN)).toBeTruthy();
    expect(screen.getByTestId('jaring-cahaya-1', HIDDEN)).toBeTruthy();
    expect(screen.getByTestId('jaring-denyut-0', HIDDEN)).toBeTruthy();
  });

  test('"kurangi gerakan": jaring diam, tanpa titik cahaya, jam frame mati', async () => {
    jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
    await show();
    expect(nodeKeys()).toHaveLength(7);
    expect(screen.queryByTestId(/^jaring-cahaya-/, HIDDEN)).toBeNull();
    expect(screen.queryByTestId(/^jaring-denyut-/, HIDDEN)).toBeNull();
    expect(mockFrame.active.length).toBeGreaterThan(0);
    expect(mockFrame.active.every((on) => !on)).toBe(true);
  });

  test('layar tidak terlihat: jam frame berhenti', async () => {
    jest.mocked(useIsFocused).mockReturnValue(false);
    try {
      await show();
      expect(mockFrame.active.at(-1)).toBe(false);
    } finally {
      jest.mocked(useIsFocused).mockReturnValue(true);
    }
  });

  test('saat memuat: Inti saja, tanpa jaring', async () => {
    const api = createTestApi();
    jest.spyOn(api.transport, 'home').mockReturnValue(new Promise(() => {}));
    await show(393, 873, { api });
    expect(screen.getByTestId('inti-besar', HIDDEN)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nadia' })).toBeOnTheScreen();
    expect(screen.queryByTestId('jaring', HIDDEN)).toBeNull();
    expect(nodeKeys()).toEqual([]);
  });
});

describe('Inti besar: ketuk = chat, tahan = bicara', () => {
  test('label nama asisten dengan dua aksi; ketuk membuka chat', async () => {
    await show();
    const inti = screen.getByRole('button', { name: 'Nadia' });
    expect(inti.props.testID).toBe('inti-besar-tombol');
    expect(inti.props.accessibilityHint).toBe('Ketuk untuk chat, tahan untuk bicara');
    expect(inti.props.accessibilityActions.map((a: { label: string }) => a.label)).toEqual(['Chat', 'Bicara']);
    await fireEvent.press(inti);
    expect(router.navigate).toHaveBeenCalledWith('/chat');
  });

  test('tahan: getar, Mode Suara langsung mendengar; jari diangkat melepas tahanan', async () => {
    await show();
    const inti = screen.getByRole('button', { name: 'Nadia' });
    await fireEvent(inti, 'pressIn');
    await fireEvent(inti, 'longPress');
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/suara', params: { hold: '1' } });
    expect(holdBridge.isHeld()).toBe(true);
    await fireEvent(inti, 'pressOut');
    expect(holdBridge.isHeld()).toBe(false);
  });
});

describe('pengguna baru', () => {
  test('sapaan, Inti besar dengan tiga simpul contoh yang redup, dan kartu Coba bilang', async () => {
    await show(393, 873, { state: newUserSampleState });
    expect(screen.getByText('Halo, Rina')).toBeOnTheScreen();
    expect(nodeKeys()).toEqual(['wa', 'gcal', 'gmail']);
    expect(style(screen.getByTestId('simpul-wa', HIDDEN)).opacity).toBe(0.6);
    expect(screen.getByTestId('jari-contoh-wa', HIDDEN).props.strokeDasharray).toBeTruthy();
    expect(screen.getByLabelText('Belum ada layanan tersambung')).toBeOnTheScreen();
    expect(screen.getByText('Coba bilang')).toBeOnTheScreen();
  });

  test('petunjuk pertama: gelembung di bawah Inti besar dengan panah ke atas, halo di Inti besar', async () => {
    await show(393, 873, { state: newUserSampleState, tips: 'fresh' });
    expect(screen.getByText(TIP_TEXT.inti)).toBeOnTheScreen();
    expect(within(screen.getByTestId('inti-besar', HIDDEN)).getByTestId('inti-halo', HIDDEN)).toBeTruthy();
    const bubble = screen.getByTestId('petunjuk').children[0] as { props: { style?: unknown } };
    const m = heroMetrics(393, 873);
    // Di bawah pusat Inti (tidak di atasnya), di dalam layar.
    const top = style(bubble).top as number;
    expect(top).toBeGreaterThan(20 + 48 + m.height / 2);
    expect(top).toBeLessThan(873 / 2 + m.height / 2);
  });
});
