/**
 * Tahan Inti -> Mode Suara tidak pernah menutup paksa aplikasi: izin mikrofon yang belum ada, modul native yang menolak,
 * gelombang yang gagal digambar, layar yang gagal digambar, dan kesalahan JavaScript yang tidak tertangkap.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getRecordingPermissionsAsync } from 'expo-audio';
import { router } from 'expo-router';
import * as Reanimated from 'react-native-reanimated';
import { makeMutable, type SharedValue } from 'react-native-reanimated';
import Suara, { VOICE_TROUBLE_TEXT } from '../app/suara';
import { audio, stream } from './audioMock';
import { advance, currentRoute, mockParams, restoreParams, showRoute } from './harness';
import { renderWithProviders } from './helpers';
import { installCrashGuard, recentErrors, resetCrashGuard } from '@/crash';
import { MIC_FAILED_TEXT } from '@/voice/controller';
import { holdBridge } from '@/voice/holdBridge';
import * as voiceHook from '@/voice/useVoice';
import { loadSkiaWaves, SKIA_WAVES_READY, Waves } from '@/voice/Waves';

// "Kurangi gerakan" dari HP: bawaannya mati; satu tes membuatnya melempar untuk meniru kanvas yang gagal digambar.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  const useReducedMotion = jest.fn(() => false);
  return new Proxy(actual, { get: (target, key) => (key === 'useReducedMotion' ? useReducedMotion : target[key]) });
});

jest.mock('@/voice/useVoice', () => {
  const actual = jest.requireActual('@/voice/useVoice');
  return { ...actual, useVoice: jest.fn(actual.useVoice) };
});

const HIDDEN = { includeHiddenElements: true };
async function settle() {
  for (let i = 0; i < 3; i++) await advance(0);
}
/**
 * Tahan Inti bilah tab (di Agenda) sampai Mode Suara layar penuh terbuka. Inti besar Beranda bicara di tempat, tanpa
 * pindah layar (lihat suara-ditempat.test.tsx).
 */
async function holdFromTabBar() {
  await showRoute('/agenda');
  await settle();
  await fireEvent(screen.getByRole('button', { name: 'Nadia' }), 'longPress');
  expect(currentRoute()).toBe('/suara');
  await settle();
}

let consoleError: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  audio.reset();
  mockParams();
  holdBridge.reset();
  resetCrashGuard();
  // Kendala yang sengaja dibuat di tes ini dicatat lewat console.error; diperiksa lewat `recentErrors` dan mata-mata ini.
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
const realUseVoice = (jest.requireActual('@/voice/useVoice') as typeof voiceHook).useVoice;
afterEach(() => {
  consoleError.mockRestore();
  jest.mocked(voiceHook.useVoice).mockImplementation(realUseVoice);
  jest.mocked(Reanimated.useReducedMotion).mockImplementation(() => false);
  jest.mocked(getRecordingPermissionsAsync).mockImplementation(() => Promise.resolve(audio.permission) as never);
});
afterAll(restoreParams);

describe('tahan Inti tanpa izin mikrofon: tidak merekam, lembar izin tampil', () => {
  test('pemasangan baru (izin belum ditanya): lembar penjelasan, jari diangkat aman, mikrofon tidak menyala', async () => {
    audio.permission = { status: 'undetermined', granted: false, canAskAgain: true };
    audio.requestResult = { status: 'granted', granted: true, canAskAgain: true };
    await holdFromTabBar();
    expect(screen.getByText('Izinkan mikrofon ya')).toBeOnTheScreen();
    expect(stream.start).not.toHaveBeenCalled();
    // Jari masih menempel lalu diangkat dari Inti di bawah Mode Suara.
    await act(async () => holdBridge.release());
    await settle();
    expect(stream.start).not.toHaveBeenCalled();
    expect(screen.getByText('Izinkan mikrofon ya')).toBeOnTheScreen();
    // Izinkan: jendela sistem; tetap tidak merekam sampai Inti ditahan lagi.
    await fireEvent.press(screen.getByRole('button', { name: 'Izinkan' }));
    await settle();
    expect(screen.queryByText('Izinkan mikrofon ya')).toBeNull();
    expect(stream.start).not.toHaveBeenCalled();
    await fireEvent(screen.getByRole('button', { name: 'Tahan untuk bicara' }), 'pressIn');
    await settle();
    expect(stream.start).toHaveBeenCalledTimes(1);
  });

  test('izin ditolak permanen: lembar ke pengaturan, mikrofon tidak menyala', async () => {
    audio.permission = { status: 'denied', granted: false, canAskAgain: false };
    await holdFromTabBar();
    expect(screen.getByText('Mikrofon sedang dimatikan')).toBeOnTheScreen();
    await act(async () => holdBridge.release());
    expect(stream.start).not.toHaveBeenCalled();
  });

  test('pemeriksaan izin gagal di modul native: dianggap ditolak, tidak merekam, tidak melempar', async () => {
    jest.mocked(getRecordingPermissionsAsync).mockImplementation(() => Promise.reject(new Error('modul native')));
    await holdFromTabBar();
    expect(screen.getByText('Mikrofon sedang dimatikan')).toBeOnTheScreen();
    expect(stream.start).not.toHaveBeenCalled();
  });
});

describe('modul native menolak di tengah tahanan', () => {
  test('mikrofon melempar langsung saat dinyalakan: kabar ramah, Inti bisa ditahan lagi', async () => {
    stream.start.mockImplementationOnce(() => {
      throw new Error('AudioRecord belum siap');
    });
    await holdFromTabBar();
    expect(screen.getByText(MIC_FAILED_TEXT)).toBeOnTheScreen();
    expect(recentErrors().some((e) => e.where.includes('mikrofon gagal menyala'))).toBe(true);
    await act(async () => holdBridge.release());
    // Coba lagi lewat Inti di Mode Suara: sekarang menyala.
    const inti = screen.getByRole('button', { name: 'Tahan untuk bicara' });
    await fireEvent(inti, 'pressIn');
    await settle();
    expect(stream.start).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Mendengar')).toBeOnTheScreen();
  });

  test('pendengar lepas yang melempar tidak keluar dari sentuhan (onPressOut)', () => {
    holdBridge.begin();
    holdBridge.onRelease(() => {
      throw new Error('pendengar rusak');
    });
    const after = jest.fn();
    holdBridge.onRelease(after);
    expect(() => holdBridge.release()).not.toThrow();
    expect(after).toHaveBeenCalled();
    expect(holdBridge.isHeld()).toBe(false);
  });

  test('Mode Suara ditutup selagi jari masih menempel: tahanan dilupakan', async () => {
    await holdFromTabBar();
    expect(holdBridge.isHeld()).toBe(true);
    expect(stream.start).toHaveBeenCalledTimes(1);
    await act(async () => router.back());
    await settle();
    expect(currentRoute()).toBe('/agenda');
    expect(holdBridge.isHeld()).toBe(false);
    expect(stream.stop).toHaveBeenCalled();
  });

  test('membuka Mode Suara gagal: sentuhan tidak melempar, tahanan dilupakan', async () => {
    await showRoute('/agenda');
    await settle();
    jest.mocked(router.navigate).mockImplementationOnce(() => {
      throw new Error('navigasi');
    });
    await fireEvent(screen.getByRole('button', { name: 'Nadia' }), 'longPress');
    expect(holdBridge.isHeld()).toBe(false);
    expect(recentErrors().at(-1)?.where).toBe('Inti: buka Mode Suara');
  });
});

describe('pintu masuk lain memakai Mode Suara yang sama', () => {
  test('ketuk Inti membuka chat; ikon Mode Suara di chat membuka Mode Suara yang sama (dengan pengaman)', async () => {
    await showRoute('/');
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Nadia' }));
    expect(currentRoute()).toBe('/chat');
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Mode Suara' }));
    expect(currentRoute()).toBe('/suara');
    await settle();
    expect(screen.getByTestId('suara')).toBeOnTheScreen();
    expect(screen.getByTestId('gelombang-mengalir', HIDDEN)).toBeOnTheScreen();
    // Tanpa tahanan: tidak langsung mendengar.
    expect(stream.start).not.toHaveBeenCalled();
  });
});

describe('gelombang berkendala: pita cahaya diam, kontrol tetap jalan', () => {
  const props = (level: SharedValue<number>) => ({ state: 'listening' as const, level, width: 393, height: 541 });

  test('kesalahan di jam frame utas UI: dilaporkan sekali, gelombang diganti pita diam', async () => {
    const broken = {
      value: 0,
      get: () => {
        throw new Error('level rusak');
      },
      set: () => {},
    } as unknown as SharedValue<number>;
    await render(<Waves {...props(broken)} />);
    expect(screen.queryByTestId('gelombang-cadangan', HIDDEN)).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('gelombang-cadangan', HIDDEN)).toBeOnTheScreen();
    expect(recentErrors().filter((e) => e.where === 'gelombang (utas UI)')).toHaveLength(1);
  });

  test('kanvas Skia gagal digambar: batas kesalahan memasang pita diam', async () => {
    jest.mocked(Reanimated.useReducedMotion).mockImplementation(() => {
      throw new Error('Skia rusak saat menggambar');
    });
    await render(<Waves {...props(makeMutable(0))} />);
    expect(screen.getByTestId('gelombang-cadangan', HIDDEN)).toBeOnTheScreen();
    expect(recentErrors().some((e) => e.where === 'gelombang' && e.message.includes('Skia rusak'))).toBe(true);
  });

  test('Skia native belum siap: tanpa gelombang Skia (pita diam) dan kendalanya dicatat', () => {
    const notInstalled = () =>
      ({
        Skia: {
          PathBuilder: {
            Make: () => {
              throw new Error('SkiaApi tidak terpasang');
            },
          },
        },
      }) as never;
    expect(loadSkiaWaves(notInstalled)).toBeNull();
    expect(recentErrors().at(-1)).toMatchObject({ where: 'gelombang: Skia belum siap' });
    // Skia (tiruan) terpasang: gelombang Skia dipakai.
    expect(SKIA_WAVES_READY).toBe(true);
    expect(loadSkiaWaves()).not.toBeNull();
  });
});

describe('Mode Suara gagal digambar: layar tetap terbuka', () => {
  test('kendala saat menggambar: kalimat ramah, Coba lagi, dan Selesai', async () => {
    jest.mocked(voiceHook.useVoice).mockImplementation(() => {
      throw new Error('modul audio');
    });
    await renderWithProviders(<Suara />);
    expect(screen.getByTestId('suara-kendala')).toBeOnTheScreen();
    expect(screen.getByText(VOICE_TROUBLE_TEXT)).toBeOnTheScreen();
    expect(screen.getByTestId('gelombang-cadangan', HIDDEN)).toBeOnTheScreen();
    expect(recentErrors().some((e) => e.where === 'Mode Suara')).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
    expect(router.back).toHaveBeenCalled();
    // Kendalanya hilang: Coba lagi memasang Mode Suara lagi.
    jest.mocked(voiceHook.useVoice).mockImplementation(realUseVoice);
    await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(screen.getByTestId('suara')).toBeOnTheScreen();
    expect(screen.queryByTestId('suara-kendala')).toBeNull();
  });
});

describe('penangan global kesalahan JavaScript', () => {
  type Handler = (error: unknown, isFatal?: boolean) => void;
  function fakeErrorUtils() {
    const g = globalThis as { ErrorUtils?: unknown };
    const saved = g.ErrorUtils;
    const previous = jest.fn();
    let current: Handler = previous;
    g.ErrorUtils = {
      getGlobalHandler: () => current,
      setGlobalHandler: (h: Handler) => {
        current = h;
      },
    };
    return {
      previous,
      fire: (e: unknown, fatal: boolean) => current(e, fatal),
      restore: () => {
        resetCrashGuard();
        g.ErrorUtils = saved;
      },
    };
  }

  test('build rilis: kesalahan fatal dicatat dan diteruskan sebagai bukan fatal (aplikasi tidak ditutup paksa)', () => {
    const eu = fakeErrorUtils();
    try {
      installCrashGuard(false);
      eu.fire(new Error('tidak tertangkap'), true);
      expect(eu.previous).toHaveBeenCalledWith(expect.any(Error), false);
      expect(recentErrors().at(-1)).toMatchObject({ fatal: true, message: 'Error: tidak tertangkap' });
      // Penangan bawaan yang ikut gagal tidak memulai putaran kesalahan baru.
      eu.previous.mockImplementationOnce(() => {
        throw new Error('pencatat rusak');
      });
      expect(() => eu.fire(new Error('lagi'), true)).not.toThrow();
    } finally {
      eu.restore();
    }
  });

  test('pengembangan: tetap fatal (layar merah), tidak ditelan diam-diam', () => {
    const eu = fakeErrorUtils();
    try {
      installCrashGuard(true);
      eu.fire(new Error('saat pengembangan'), true);
      expect(eu.previous).toHaveBeenCalledWith(expect.any(Error), true);
    } finally {
      eu.restore();
    }
  });
});
