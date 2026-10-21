import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { makeMutable, type SharedValue } from 'react-native-reanimated';
import Suara from '../app/suara';
import { audio } from './audioMock';
import { renderWithProviders } from './helpers';
import { dark, gradients } from '@/theme/tokens';
import { level as pcmLevel, levelFromRms } from '@/voice/pcm';
import { useVoice, type Voice } from '@/voice/useVoice';
import {
  approach,
  goalAlpha,
  goalShimmer,
  goalSpeed,
  LISTEN_FLOOR,
  smoothLevel,
  speechEnvelope,
  targetLevel,
  WAVE_HEIGHT_RATIO,
  WAVE_LAYERS,
  waveY,
  type WaveState,
} from '@/voice/waveMath';
import { WavesSkia } from '@/voice/WavesSkia';

// "Kurangi gerakan" dari HP: bawaannya mati, satu tes menyalakannya.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  const useReducedMotion = jest.fn(() => false);
  return new Proxy(actual, { get: (target, key) => (key === 'useReducedMotion' ? useReducedMotion : target[key]) });
});

// Ukuran layar diganti per tes: 393×873 (HP panjang acuan), 360×640 (pendek), 412×915.
let mockDims = { width: 393, height: 873, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims,
}));

const HIDDEN = { includeHiddenElements: true };
const FRAME = 1 / 60;
const style = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

beforeEach(() => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
  mockDims = { width: 393, height: 873, scale: 3, fontScale: 1 };
  audio.reset();
});

/** Jalankan simulasi yang sama dengan jam frame `WavesSkia`, tanpa Skia. */
function simulate(
  steps: { state: WaveState; frames: number; mic?: number }[],
  start = { level: 0.1, speed: 0.35, alpha: 0.75 },
) {
  let t = 0;
  let { level, speed, alpha } = start;
  const trace: { level: number; speed: number; alpha: number }[] = [];
  for (const step of steps) {
    for (let i = 0; i < step.frames; i++) {
      t += FRAME;
      speed = approach(speed, goalSpeed(step.state, false), FRAME);
      alpha = approach(alpha, goalAlpha(step.state, false, false), FRAME);
      level = smoothLevel(level, targetLevel(step.state, t, step.mic ?? 0, false), FRAME);
      trace.push({ level, speed, alpha });
    }
  }
  return trace;
}

describe('hitungan gelombang (§5.1)', () => {
  test('empat lapis dengan warna token gelombang, belakang lebih lebar blurnya', () => {
    expect(WAVE_LAYERS).toHaveLength(4);
    const tokens = new Set(Object.values(gradients.waves));
    for (const layer of WAVE_LAYERS) for (const c of layer.colors) expect(tokens.has(c as never)).toBe(true);
    expect(WAVE_LAYERS.map((l) => l.blur)).toEqual([34, 24, 14, 8]);
  });

  test('level 0: garis rata di tinggi dasar; level 1: bergelombang dan naik', () => {
    const layer = WAVE_LAYERS[0]!;
    for (const u of [0, 0.25, 0.5, 1]) expect(waveY(layer, u, 3, 0, 500)).toBeCloseTo(500 * layer.base);
    const ys = Array.from({ length: 57 }, (_, i) => waveY(layer, i / 56, 3, 1, 500));
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(40);
    // Tidak pernah keluar kanvas.
    for (const y of ys) expect(y).toBeGreaterThan(0);
  });

  test('level dari desibel: -50 dB 0, -30 dB setengah, -10 dB penuh, hening 0', () => {
    expect(levelFromRms(10 ** (-50 / 20))).toBeCloseTo(0);
    expect(levelFromRms(10 ** (-30 / 20))).toBeCloseTo(0.5);
    expect(levelFromRms(10 ** (-10 / 20))).toBeCloseTo(1);
    expect(levelFromRms(0)).toBe(0);
    expect(pcmLevel(new Int16Array(1600).fill(300))).toBeGreaterThan(0.2);
  });

  test('naik cepat (kira-kira 40 ms), turun pelan (kira-kira 160 ms), tidak bergantung laju frame', () => {
    let up = 0;
    for (let i = 0; i < 3; i++) up = smoothLevel(up, 1, FRAME);
    expect(up).toBeGreaterThan(0.7);
    let down = 1;
    for (let i = 0; i < 3; i++) down = smoothLevel(down, 0, FRAME);
    expect(down).toBeGreaterThan(0.7);
    for (let i = 0; i < 7; i++) down = smoothLevel(down, 0, FRAME);
    expect(down).toBeLessThan(0.4);
    // Dua frame 60 fps = satu frame 30 fps.
    expect(smoothLevel(smoothLevel(0.2, 0.9, FRAME), 0.9, FRAME)).toBeCloseTo(smoothLevel(0.2, 0.9, 2 * FRAME), 6);
  });

  test('keadaan: mendengar ikut mikrofon dengan lantai, berpikir tenang, menjawab berirama, mati diam', () => {
    expect(targetLevel('listening', 1, 0, false)).toBe(LISTEN_FLOOR);
    expect(targetLevel('listening', 1, 0.8, false)).toBe(0.8);
    for (let t = 0; t < 10; t += 0.07) {
      const think = targetLevel('thinking', t, 1, false);
      expect(think).toBeGreaterThanOrEqual(0.1);
      expect(think).toBeLessThanOrEqual(0.18);
      const speak = speechEnvelope(t);
      expect(speak).toBeGreaterThanOrEqual(0.22);
      expect(speak).toBeLessThanOrEqual(0.52);
    }
    expect(targetLevel('off', 1, 1, false)).toBe(0.06);
    expect(goalSpeed('off', false)).toBe(0);
    expect(goalSpeed('error', false)).toBe(0);
    expect(goalSpeed('thinking', false)).toBe(0.45);
    expect(goalShimmer('thinking')).toBe(1);
    expect(goalShimmer('listening')).toBe(0);
    expect(goalAlpha('listening', false, true)).toBe(0.5);
    expect(goalAlpha('idle', true, false)).toBeLessThan(goalAlpha('idle', false, false));
  });

  test('peralihan halus: dari mendengar ke berpikir ke menjawab tanpa lompatan, sampai dalam 300 ms', () => {
    const trace = simulate([
      { state: 'listening', frames: 60, mic: 0.9 },
      { state: 'thinking', frames: 60 },
      { state: 'speaking', frames: 60 },
      { state: 'off', frames: 60 },
    ]);
    for (let i = 1; i < trace.length; i++) {
      // Kecepatan dan terang tidak pernah melompat lebih dari seperlima jarak dalam satu frame.
      expect(Math.abs(trace[i]!.speed - trace[i - 1]!.speed)).toBeLessThan(0.15);
      expect(Math.abs(trace[i]!.alpha - trace[i - 1]!.alpha)).toBeLessThan(0.1);
    }
    // 300 ms (18 frame) setelah berpikir dimulai: kecepatan sudah hampir 0,45.
    expect(trace[60 + 18]!.speed).toBeCloseTo(0.45, 1);
    // Mati: gelombang berhenti.
    expect(trace.at(-1)!.speed).toBeLessThan(0.01);
    expect(trace.at(-1)!.level).toBeCloseTo(0.06, 2);
  });

  test('menyalakan lagi dari level tinggi tidak membuat lompatan: satu frame paling banyak 0,35 jaraknya', () => {
    expect(smoothLevel(0.1, 1, FRAME)).toBeCloseTo(0.1 + 0.9 * 0.35, 5);
    expect(approach(1, 0, FRAME)).toBeGreaterThan(0.8);
  });
});

describe('komponen gelombang (Skia tiruan)', () => {
  const props = (state: WaveState) => ({ state, level: makeMutable(0), width: 393, height: 541 });

  test.each<WaveState>(['idle', 'listening', 'thinking', 'speaking', 'off', 'error'])(
    'keadaan %s: kanvas mengalir di bawah layar, hiasan saja',
    async (state) => {
      await render(<WavesSkia {...props(state)} />);
      const root = screen.getByTestId('gelombang', HIDDEN);
      expect(style(root)).toMatchObject({ position: 'absolute', bottom: 0, height: 541 });
      expect(root.props.pointerEvents).toBe('none');
      expect(root).not.toBeVisible();
      expect(screen.getByTestId(`gelombang-${state}`, HIDDEN)).toBeOnTheScreen();
      expect(screen.getByTestId('gelombang-mengalir', HIDDEN)).toBeOnTheScreen();
    },
  );

  test('berganti keadaan memakai kanvas yang sama (tanpa pasang ulang, jadi tanpa lompatan)', async () => {
    await render(<WavesSkia {...props('listening')} />);
    const canvas = screen.getByTestId('gelombang-listening', HIDDEN);
    await screen.rerender(<WavesSkia {...props('thinking')} />);
    expect(screen.getByTestId('gelombang-thinking', HIDDEN)).toBe(canvas);
    await screen.rerender(<WavesSkia {...props('speaking')} />);
    expect(screen.getByTestId('gelombang-speaking', HIDDEN)).toBe(canvas);
  });

  test('kurangi gerakan: bingkai diam yang hanya berdenyut', async () => {
    jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
    const glow = makeMutable(0.5);
    await render(<WavesSkia {...props('listening')} glow={glow} />);
    expect(screen.getByTestId('gelombang-diam', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByTestId('gelombang-mengalir', HIDDEN)).toBeNull();
    // Cahaya Inti tidak ikut membesar saat diam.
    expect(glow.get()).toBe(0);
  });

  test('jam frame mengisi cahaya Inti dengan level halus dari mikrofon', async () => {
    const level = makeMutable(0);
    const glow = makeMutable(0);
    await render(<WavesSkia state="listening" level={level} width={393} height={541} glow={glow} />);
    level.set(0.9);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(glow.get()).toBeGreaterThan(0.8);
    level.set(0);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    // Turun pelan ke lantai mendengar.
    expect(glow.get()).toBeCloseTo(LISTEN_FLOOR, 1);
  });
});

describe('level mikrofon dari pengendali', () => {
  test('potongan PCM menaikkan level bersama (desibel), lepas mengembalikannya ke 0', async () => {
    let voice: Voice | undefined;
    function Probe() {
      voice = useVoice();
      return null;
    }
    await renderWithProviders(<Probe />);
    const level: SharedValue<number> = voice!.level;
    expect(level.get()).toBe(0);
    await act(async () => void voice!.holdStart());
    await act(async () => audio.emitBuffer(new Array<number>(1600).fill(9000)));
    expect(level.get()).toBeCloseTo(levelFromRms(9000 / 32768), 3);
    await act(async () => audio.emitBuffer(new Array<number>(1600).fill(300)));
    expect(level.get()).toBeCloseTo(levelFromRms(300 / 32768), 3);
    for (let i = 0; i < 6; i++) await act(async () => audio.emitBuffer(new Array<number>(1600).fill(9000)));
    await act(async () => void voice!.holdEnd());
    expect(level.get()).toBe(0);
  });
});

describe('tata letak Mode Suara', () => {
  test.each([
    [393, 873],
    [412, 915],
    [360, 640],
  ])('%ix%i: gelombang di bawah, kontrol menempel di bawah tanpa jarak tetap dari atas', async (w, h) => {
    mockDims = { width: w, height: h, scale: 3, fontScale: 1 };
    await renderWithProviders(<Suara />);
    expect(style(screen.getByTestId('gelombang', HIDDEN)).height).toBe(Math.round(h * WAVE_HEIGHT_RATIO));
    const column = screen.getByTestId('suara-kolom');
    const controls = screen.getByTestId('suara-kontrol');
    // Isi bacaan mengambil sisa tinggi; kontrol anak terakhir kolom, tanpa posisi absolut atau jarak dari atas.
    expect(style(screen.getByTestId('suara-isi')).flex).toBe(1);
    expect(column.children.at(-1)).toBe(controls);
    expect(style(controls).position).toBeUndefined();
    expect(style(controls).top).toBeUndefined();
    expect(style(controls).marginTop).toBeUndefined();
    const inti = screen.getByRole('button', { name: 'Tahan untuk bicara' });
    for (const el of [
      inti,
      screen.getByRole('button', { name: 'Bisukan' }),
      screen.getByRole('button', { name: 'Ketik' }),
      screen.getByRole('button', { name: 'Selesai' }),
    ]) {
      expect(controls).toContainElement(el);
    }
    expect(style(inti)).toMatchObject({ width: 88, height: 88 });
    expect(style(screen.getByRole('button', { name: 'Bisukan' }))).toMatchObject({ width: 60, height: 60 });
    expect(style(screen.getByRole('button', { name: 'Selesai' })).minHeight).toBeGreaterThanOrEqual(56);
    // Tanpa label tulisan di tombol bulat dan tanpa nama bahasa.
    expect(screen.queryByText('Bisukan')).toBeNull();
    expect(screen.queryByText('Ketik')).toBeNull();
    expect(screen.queryByText(/Bahasa/)).toBeNull();
  });

  test.each(['light', 'dark'] as const)('mode %s: kanvas suara selalu gelap', async (scheme) => {
    await renderWithProviders(<Suara />, { scheme });
    expect(style(screen.getByTestId('suara')).backgroundColor).toBe(dark.voiceCanvas);
    expect(screen.getByText('Tahan Inti sambil bicara')).toHaveStyle({ color: 'rgba(242,243,245,0.42)' });
  });

  test('Ketik membuka kolom ketik di atas kontrol dan meredupkan gelombang di belakangnya', async () => {
    await renderWithProviders(<Suara />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ketik' }));
    expect(screen.getByTestId('suara-kontrol')).toContainElement(screen.getByLabelText('Ketik pesan'));
    expect(screen.getByRole('button', { name: 'Ketik' })).toBeSelected();
  });
});
