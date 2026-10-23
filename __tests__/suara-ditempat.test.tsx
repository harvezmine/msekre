/**
 * Mode Suara di tempat (Beranda): menahan Inti besar tidak pindah layar. Geser untuk batal, ketuk di luar menutup,
 * tahanan singkat, Mode Suara yang belum tersedia, izin mikrofon, menyela jawaban, bilah tab yang ikut meredup, dan
 * hitungan murninya (zona geser, peralihan dari bilah tab, gelombang melingkar).
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { makeMutable } from 'react-native-reanimated';
import Beranda from '../app/(tabs)/index';
import { audio, stream } from './audioMock';
import { advance, currentRoute, mockParams, restoreParams, showRoute } from './harness';
import { createTestApi, renderWithProviders, toastNow } from './helpers';
import { THINK_MS } from '@/sample/chat';
import { RELEASE_TAIL_MS, SHORT_HOLD_TEXT } from '@/voice/controller';
import { handoffFrom, restCentre, VOICE_INTI } from '@/voice/handoff';
import { ARMED_HINT_TEXT, SLIDE_HINT_TEXT } from '@/voice/InPlaceVoice';
import { RadialWaves } from '@/voice/RadialWaves';
import { CANCEL_DISTANCE, inPlace, SLIDE_START, slideZoneFor } from '@/voice/inPlace';
import {
  advancePhase,
  goalPresence,
  RADIAL_LISTENING,
  RADIAL_THINKING,
  radialTarget,
  ringAlpha,
  ringPhase,
  ringScale,
  wrapUnit,
} from '@/voice/radialMath';

const ANCHOR = { x: 196, y: 300, size: 140 };

async function settle() {
  for (let i = 0; i < 3; i++) await advance(0);
}

/** Tahan Inti besar (lewat penyimpan sesi, dengan titik jari dan pusat Inti yang diketahui) dan bicara 0,6 detik. */
async function holdAndSpeak(chunks = 6) {
  await act(async () => inPlace.begin({ finger: { x: ANCHOR.x, y: ANCHOR.y }, anchor: ANCHOR }));
  await settle();
  for (let i = 0; i < chunks; i++) await act(async () => audio.emitBuffer(new Array<number>(1600).fill(9000)));
}

async function release() {
  await act(async () => inPlace.release());
  await advance(RELEASE_TAIL_MS);
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  audio.reset();
  mockParams();
});
afterAll(restoreParams);

describe('di Beranda', () => {
  test('geser menjauh: petunjuk batal, lalu siap batal; dilepas di sana tidak mengirim apa pun dan lapisan menutup', async () => {
    await renderWithProviders(<Beranda />);
    await holdAndSpeak();
    expect(stream.start).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(SLIDE_HINT_TEXT)).toBeNull();

    await act(async () => inPlace.move(ANCHOR.x, ANCHOR.y + SLIDE_START + 10));
    expect(screen.getByText(SLIDE_HINT_TEXT)).toBeOnTheScreen();
    await act(async () => inPlace.move(ANCHOR.x, ANCHOR.y + CANCEL_DISTANCE + 10));
    expect(screen.getByText(ARMED_HINT_TEXT)).toBeOnTheScreen();

    await release();
    await advance(THINK_MS);
    expect(stream.stop).toHaveBeenCalled();
    expect(screen.queryByTestId('suara-ditempat-balasan')).toBeNull();
    await advance(200);
    expect(screen.queryByTestId('suara-ditempat')).toBeNull();
  });

  test('ketuk di luar menutup lapisan; tombol Bisukan di kartu jawaban', async () => {
    await renderWithProviders(<Beranda />);
    await holdAndSpeak();
    await release();
    await advance(THINK_MS);
    expect(screen.getByTestId('suara-ditempat-balasan')).toHaveTextContent('Sudah. AC kamar saya matikan.');
    await fireEvent.press(screen.getByRole('button', { name: 'Bisukan' }));
    expect(screen.getByRole('button', { name: 'Suarakan' })).toBeSelected();
    await fireEvent.press(screen.getByTestId('suara-ditempat-tutup'));
    await settle();
    expect(screen.queryByTestId('suara-ditempat')).toBeNull();
    expect(inPlace.get().open).toBe(false);
  });

  test('menahan Inti lagi saat jawaban dibacakan: suaranya berhenti, giliran baru mendengar', async () => {
    await renderWithProviders(<Beranda />);
    await holdAndSpeak();
    await release();
    await advance(THINK_MS);
    const player = audio.players[0]!;
    expect(player).toBeTruthy();
    await fireEvent(screen.getByTestId('suara-ditempat-inti'), 'longPress', {
      nativeEvent: { pageX: ANCHOR.x, pageY: ANCHOR.y },
    });
    await settle();
    expect(player.pause).toHaveBeenCalled();
    expect(stream.start).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('suara-ditempat-balasan')).toBeNull();
    expect(screen.getByTestId('suara-ditempat-ucapan')).toHaveTextContent('Mendengarkan…');
    // Ketuk (bukan tahan) pengganti Inti membuka chat.
    await act(async () => inPlace.release());
    await fireEvent.press(screen.getByTestId('suara-ditempat-inti'));
    expect(router.navigate).toHaveBeenCalledWith('/chat');
  });

  test('tahanan terlalu singkat: tidak dikirim, petunjuk singkat, lalu lapisan menutup sendiri', async () => {
    await renderWithProviders(<Beranda />);
    await holdAndSpeak(1);
    await release();
    expect(screen.getByTestId('suara-ditempat-kabar')).toHaveTextContent(SHORT_HOLD_TEXT);
    await advance(4100);
    expect(screen.queryByTestId('suara-ditempat')).toBeNull();
  });

  test('izin mikrofon belum ada: lembar izin, mikrofon tidak menyala; Nanti saja menutup semuanya', async () => {
    audio.permission = { status: 'undetermined', granted: false, canAskAgain: true };
    await renderWithProviders(<Beranda />);
    await act(async () => inPlace.begin({ anchor: ANCHOR }));
    await settle();
    expect(screen.getByTestId('suara-izin')).toBeOnTheScreen();
    expect(stream.start).not.toHaveBeenCalled();
    await act(async () => inPlace.release());
    await fireEvent.press(screen.getByRole('button', { name: 'Nanti saja' }));
    await settle();
    expect(screen.queryByTestId('suara-ditempat')).toBeNull();
  });

  test('akun tanpa Mode Suara: menahan Inti besar memberi kabar ramah, tanpa lapisan dan mikrofon', async () => {
    await renderWithProviders(<Beranda />, { api: createTestApi({ mode: 'server', token: 'tok', voice: false }) });
    await settle();
    await fireEvent(screen.getByRole('button', { name: 'Nadia' }), 'longPress');
    expect(toastNow()?.text).toBe('Mode Suara segera hadir.');
    expect(screen.queryByTestId('suara-ditempat')).toBeNull();
    expect(stream.start).not.toHaveBeenCalled();
  });
});

test('bilah tab ikut meredup selama lapisan terbuka; ketukan di sana menutupnya', async () => {
  await showRoute('/');
  await settle();
  await fireEvent(screen.getByRole('button', { name: 'Nadia' }), 'longPress');
  await settle();
  await act(async () => inPlace.release());
  await fireEvent.press(screen.getByTestId('bilah-tab-tutup-suara'));
  await settle();
  expect(screen.queryByTestId('bilah-tab-tutup-suara')).toBeNull();
  expect(currentRoute()).toBe('/');
});

test('gelombang melingkar tepat berpusat di Inti: kotak 2 × Inti digeser setengah kotak dari titik pusatnya', async () => {
  const drive = { mode: makeMutable(1), level: makeMutable(0.5), cancel: makeMutable(0), smooth: makeMutable(0) };
  await renderWithProviders(<RadialWaves size={140} drive={drive} still={false} />);
  const box = screen.getByTestId('suara-cincin', { includeHiddenElements: true });
  const style = box.props.style as { left: number; top: number; width: number; height: number };
  expect(style).toMatchObject({ width: 280, height: 280, left: -140, top: -140 });
  // Pusat kotak = titik pusat Inti (0, 0 di pembungkusnya).
  expect(style.left + style.width / 2).toBe(0);
  expect(style.top + style.height / 2).toBe(0);
});

describe('hitungan murni', () => {
  test('zona geser: diam, bergeser, siap batal; masukan rusak = diam', () => {
    expect(slideZoneFor(0, 0)).toBe('none');
    expect(slideZoneFor(0, SLIDE_START)).toBe('sliding');
    expect(slideZoneFor(CANCEL_DISTANCE, 0)).toBe('armed');
    expect(slideZoneFor(Number.NaN, 4)).toBe('none');
  });

  test('peralihan dari bilah tab: Inti Mode Suara mulai tepat di bawah jari, sebesar Inti bilah', () => {
    const rest = restCentre(393, 873, 24);
    expect(rest.x).toBeCloseTo(196.5);
    const h = handoffFrom({ x: 196.5, y: 830, size: 48 }, rest)!;
    expect(h.dx).toBeCloseTo(0);
    expect(h.dy).toBeCloseTo(830 - rest.y);
    expect(h.scale).toBeCloseTo(48 / VOICE_INTI);
    expect(handoffFrom(null, rest)).toBeNull();
    expect(handoffFrom({ x: Number.NaN, y: 1, size: 48 }, rest)).toBeNull();
  });

  test('gelombang melingkar: angka selalu terhingga dan dalam batas', () => {
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY, -3, 0.4, 7]) {
      expect(wrapUnit(v)).toBeGreaterThanOrEqual(0);
      expect(wrapUnit(v)).toBeLessThan(1);
      expect(Number.isFinite(advancePhase(v, v, v))).toBe(true);
      expect(Number.isFinite(ringScale(v, v, v))).toBe(true);
      const a = ringAlpha(v, v, v, v);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
    expect(radialTarget(RADIAL_LISTENING, 0, 0)).toBeCloseTo(0.1);
    expect(radialTarget(RADIAL_LISTENING, 0, 0.8)).toBeCloseTo(0.8);
    expect(goalPresence(RADIAL_LISTENING)).toBeGreaterThan(goalPresence(RADIAL_THINKING));
    expect(ringPhase(0.9, 1, 3)).toBeCloseTo(wrapUnit(0.9 + 1 / 3));
  });
});
