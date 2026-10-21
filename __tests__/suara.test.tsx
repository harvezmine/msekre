import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import Suara from '../app/suara';
import { audio, stream } from './audioMock';
import { createTestApi, renderWithProviders } from './helpers';
import { THINK_MS } from '@/sample/chat';
import { deviceById, type SampleState } from '@/sample/store';
import { useSample } from '@/sample/store';
import { MAIN_AC_ID } from '@/sample/devices';
import { setAudioModeAsync } from 'expo-audio';

const flush = () => act(async () => {});
const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

/** Tahan Inti, bicara `chunks` x 100 ms, lalu lepas. */
async function speak(chunks = 6) {
  const inti = screen.getByRole('button', { name: 'Tahan untuk bicara' });
  await fireEvent(inti, 'pressIn');
  await flush();
  for (let i = 0; i < chunks; i++) {
    await act(async () => audio.emitBuffer(new Array<number>(1600).fill(9000)));
  }
  await fireEvent(inti, 'pressOut');
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  audio.reset();
});

test('satu ucapan: mendengar, teks bertahap, berpikir, balasan tampil, berbicara, lalu siap lagi', async () => {
  await renderWithProviders(<Suara />);
  expect(screen.getByText('Tahan Inti sambil bicara')).toBeOnTheScreen();
  const inti = screen.getByRole('button', { name: 'Tahan untuk bicara' });

  await fireEvent(inti, 'pressIn');
  await flush();
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  expect(stream.start).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Mendengar')).toBeOnTheScreen();
  expect(screen.getAllByTestId(/^inti-cincin-/)).toHaveLength(2);

  for (let i = 0; i < 3; i++) await act(async () => audio.emitBuffer(new Array<number>(1600).fill(9000)));
  // Teks sementara, belum final.
  expect(screen.getByTestId('suara-ucapan')).toHaveTextContent('Matikan AC');
  for (let i = 0; i < 3; i++) await act(async () => audio.emitBuffer(new Array<number>(1600).fill(9000)));

  await fireEvent(inti, 'pressOut');
  await flush();
  expect(stream.stop).toHaveBeenCalled();
  expect(screen.getByText('Nadia berpikir')).toBeOnTheScreen();
  expect(screen.getByTestId('suara-ucapan')).toHaveTextContent('Matikan AC kamar.');
  expect(screen.queryByTestId('suara-balasan')).toBeNull();
  expect(screen.queryAllByTestId(/^inti-cincin-/)).toHaveLength(0);

  await advance(THINK_MS);
  expect(screen.getByTestId('suara-balasan')).toHaveTextContent('Sudah. AC kamar saya matikan.');
  expect(screen.getAllByTestId(/^inti-gelombang-/)).toHaveLength(3);
  expect(audio.players).toHaveLength(1);
  expect(audio.players[0]!.play).toHaveBeenCalled();
  expect((audio.players[0]!.source as { uri: string }).uri).toMatch(/suara\/balasan-1\.wav$/);

  await act(async () => audio.finishPlayback());
  expect(screen.queryAllByTestId(/^inti-gelombang-/)).toHaveLength(0);
  expect(screen.getByText('Tahan Inti sambil bicara')).toBeOnTheScreen();
  // Teksnya tetap tampil.
  expect(screen.getByTestId('suara-balasan')).toHaveTextContent('Sudah. AC kamar saya matikan.');
  expect(audio.players[0]!.removed).toBe(true);
});

test('perintah suara dijalankan (AC mati, tercatat lewat suara) dan masuk utas chat bertanda suara', async () => {
  let seen: SampleState | undefined;
  function Probe() {
    seen = useSample().state;
    return null;
  }
  const api = createTestApi();
  await renderWithProviders(
    <>
      <Suara />
      <Probe />
    </>,
    { api },
  );
  expect(deviceById(seen!, MAIN_AC_ID)!.on).toBe(true);
  await speak();
  await advance(THINK_MS);
  expect(deviceById(seen!, MAIN_AC_ID)!.on).toBe(false);
  expect(seen!.history[0]).toMatchObject({ title: 'Mematikan AC kamar', sub: 'lewat suara · 10.41' });
  const page = await api.transport.messages();
  const voiced = page.items.filter((m) => m.voice);
  expect(voiced.map((m) => m.from).sort()).toEqual(['assistant', 'user']);
  const texts = voiced.flatMap((m) => m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])));
  expect(texts).toContain('Matikan AC kamar.');
  expect(texts).toContain('Sudah. AC kamar saya matikan.');
});

test('menyela: menahan Inti saat Nadia berbicara menghentikan suaranya', async () => {
  await renderWithProviders(<Suara />);
  await speak();
  await advance(THINK_MS);
  expect(screen.getAllByTestId(/^inti-gelombang-/)).toHaveLength(3);
  const player = audio.players[0]!;

  await fireEvent(screen.getByRole('button', { name: 'Tahan untuk bicara' }), 'pressIn');
  await flush();
  expect(player.pause).toHaveBeenCalled();
  expect(player.removed).toBe(true);
  expect(screen.queryAllByTestId(/^inti-gelombang-/)).toHaveLength(0);
  expect(screen.getByText('Mendengar')).toBeOnTheScreen();
  // Ucapan dan balasan sebelumnya dibersihkan untuk giliran baru.
  expect(screen.queryByTestId('suara-balasan')).toBeNull();
});

test('ketukan singkat tidak mengirim apa-apa dan memberi petunjuk', async () => {
  await renderWithProviders(<Suara />);
  await speak(1);
  expect(screen.getByText('Tahan Inti sambil bicara')).toBeOnTheScreen();
  expect(screen.queryByText('Nadia berpikir')).toBeNull();
  await advance(THINK_MS * 2);
  expect(screen.queryByTestId('suara-balasan')).toBeNull();
});

test('Bisukan: teks balasan tetap tampil, tidak ada suara', async () => {
  await renderWithProviders(<Suara />);
  await fireEvent.press(screen.getByRole('button', { name: 'Bisukan' }));
  expect(screen.getByRole('button', { name: 'Suarakan' })).toBeOnTheScreen();
  await speak();
  await advance(THINK_MS);
  expect(screen.getByTestId('suara-balasan')).toHaveTextContent('Sudah. AC kamar saya matikan.');
  expect(audio.players).toHaveLength(0);
  expect(screen.queryAllByTestId(/^inti-gelombang-/)).toHaveLength(0);
  expect(screen.getByText('Tahan Inti sambil bicara')).toBeOnTheScreen();
});

test('Bisukan saat suara berjalan menghentikannya', async () => {
  await renderWithProviders(<Suara />);
  await speak();
  await advance(THINK_MS);
  await fireEvent.press(screen.getByRole('button', { name: 'Bisukan' }));
  expect(audio.players[0]!.removed).toBe(true);
  expect(screen.queryAllByTestId(/^inti-gelombang-/)).toHaveLength(0);
  expect(screen.getByTestId('suara-balasan')).toBeOnTheScreen();
});

test('Ketik: kalimat dikirim sebagai teks dan dijawab seperti ucapan', async () => {
  await renderWithProviders(<Suara />);
  expect(screen.queryByLabelText('Ketik pesan')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Ketik' }));
  await fireEvent.changeText(screen.getByLabelText('Ketik pesan'), 'Nyalakan AC kamar');
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
  expect(screen.getByTestId('suara-ucapan')).toHaveTextContent('Nyalakan AC kamar');
  expect(screen.getByText('Nadia berpikir')).toBeOnTheScreen();
  expect(stream.start).not.toHaveBeenCalled();
  await advance(THINK_MS);
  expect(screen.getByTestId('suara-balasan')).toHaveTextContent(/AC kamar nyala/);
  expect(screen.getByLabelText('Ketik pesan')).toHaveDisplayValue('');
});

test('kalimat pembayaran: kartu menunggu ketukan, tidak ada yang dijalankan sebelumnya', async () => {
  const api = createTestApi();
  await renderWithProviders(<Suara />, { api });
  const qris = async () =>
    (await api.transport.messages()).items.filter((m) =>
      m.parts.some((p) => p.type === 'card' && p.card.kind === 'qris'),
    ).length;
  const before = await qris();
  await fireEvent.press(screen.getByRole('button', { name: 'Ketik' }));
  await fireEvent.changeText(screen.getByLabelText('Ketik pesan'), 'Bayar token listrik 100 ribu');
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
  await advance(THINK_MS);

  expect(screen.getByTestId('suara-konfirmasi')).toBeOnTheScreen();
  expect(screen.getByText('Token listrik PLN')).toBeOnTheScreen();
  expect(screen.getByText('Sudah benar?')).toBeOnTheScreen();
  expect(screen.getByTestId('suara-balasan')).toHaveTextContent(/Sudah benar/);
  await advance(5000);
  expect(await qris()).toBe(before);

  await fireEvent.press(screen.getByRole('button', { name: 'Ya, benar' }));
  await advance(THINK_MS + 500);
  await flush();
  expect(await qris()).toBe(before + 1);
});

test('kalimat kirim ke orang: draf muncul sebagai kartu, baru terkirim setelah Kirim diketuk', async () => {
  const api = createTestApi();
  await renderWithProviders(<Suara />, { api });
  await fireEvent.press(screen.getByRole('button', { name: 'Ketik' }));
  await fireEvent.changeText(
    screen.getByLabelText('Ketik pesan'),
    'Kirim ke Pak Budi, saya terlambat lima belas menit',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
  await advance(THINK_MS);
  await flush();
  expect(screen.getByText('Pak Budi')).toBeOnTheScreen();
  const statuses = async () =>
    (await api.transport.messages()).items.flatMap((m) =>
      m.parts.flatMap((p) =>
        p.type === 'card' && p.card.kind === 'draft' && p.card.draft.id.startsWith('d-contoh-')
          ? [p.card.draft.status]
          : [],
      ),
    );
  expect(await statuses()).toEqual(['draft']);
  await advance(5000);
  expect(await statuses()).toEqual(['draft']);
  // Dua tombol "Kirim": kartu draf (di atas) dan kolom ketik.
  const kirim = screen.getAllByRole('button', { name: 'Kirim' });
  await fireEvent.press(kirim[0]!);
  await flush();
  expect(await statuses()).toEqual(['held']);
});

test('ucapan kedua dan ketiga dari daftar contoh membawa kartu bayar dan kirim', async () => {
  await renderWithProviders(<Suara />);
  await speak();
  await advance(THINK_MS);
  await act(async () => audio.finishPlayback());
  await speak();
  await advance(THINK_MS);
  expect(screen.getByTestId('suara-ucapan')).toHaveTextContent(/^Bayar token listrik/);
  expect(screen.getByTestId('suara-konfirmasi')).toBeOnTheScreen();
  await act(async () => audio.finishPlayback());
  await speak();
  await advance(THINK_MS);
  expect(screen.getByTestId('suara-ucapan')).toHaveTextContent(/^Kirim ke Pak Budi/);
  expect(screen.getByText('Pak Budi')).toBeOnTheScreen();
});

test('Buka di chat dari kartu konfirmasi', async () => {
  await renderWithProviders(<Suara />);
  await fireEvent.press(screen.getByRole('button', { name: 'Ketik' }));
  await fireEvent.changeText(screen.getByLabelText('Ketik pesan'), 'bayar token');
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
  await advance(THINK_MS);
  await fireEvent.press(screen.getByRole('button', { name: 'Buka di chat' }));
  expect(router.replace).toHaveBeenCalledWith('/chat');
});

describe('izin mikrofon', () => {
  test('belum pernah ditanya: penjelasan dulu, lalu boleh', async () => {
    audio.permission = { status: 'undetermined', granted: false, canAskAgain: true };
    audio.requestResult = { status: 'granted', granted: true, canAskAgain: true };
    await renderWithProviders(<Suara />);
    await fireEvent(screen.getByRole('button', { name: 'Tahan untuk bicara' }), 'pressIn');
    await flush();
    expect(screen.getByText('Izinkan mikrofon ya')).toBeOnTheScreen();
    expect(stream.start).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Izinkan' }));
    await flush();
    expect(screen.queryByTestId('suara-izin')).toBeNull();
    expect(screen.getByText('Mikrofon sudah boleh dipakai. Tahan Inti sambil bicara.')).toBeOnTheScreen();
    await fireEvent(screen.getByRole('button', { name: 'Tahan untuk bicara' }), 'pressOut');
    await speak();
    expect(stream.start).toHaveBeenCalledTimes(1);
  });

  test('ditolak: lembar dengan Buka pengaturan', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    audio.permission = { status: 'denied', granted: false, canAskAgain: false };
    await renderWithProviders(<Suara />);
    await fireEvent(screen.getByRole('button', { name: 'Tahan untuk bicara' }), 'pressIn');
    await flush();
    expect(screen.getByText('Mikrofon sedang dimatikan')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Buka pengaturan' }));
    expect(open).toHaveBeenCalled();
    expect(screen.queryByTestId('suara-izin')).toBeNull();
    expect(stream.start).not.toHaveBeenCalled();
    open.mockRestore();
  });

  test('jendela sistem ditolak: lembar berubah ke pengaturan, Nanti saja menutup', async () => {
    audio.permission = { status: 'undetermined', granted: false, canAskAgain: true };
    audio.requestResult = { status: 'denied', granted: false, canAskAgain: false };
    await renderWithProviders(<Suara />);
    await fireEvent(screen.getByRole('button', { name: 'Tahan untuk bicara' }), 'pressIn');
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Izinkan' }));
    await flush();
    expect(screen.getByText('Mikrofon sedang dimatikan')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Nanti saja' }));
    expect(screen.queryByTestId('suara-izin')).toBeNull();
  });
});

test('tidak tersambung: Inti mati dengan kalimat ramah', async () => {
  const api = createTestApi();
  api.transport.drop();
  await renderWithProviders(<Suara />, { api });
  await flush();
  expect(screen.getByText('Belum tersambung. Coba lagi sebentar ya.')).toBeOnTheScreen();
  expect(screen.queryAllByTestId(/^inti-cincin-/)).toHaveLength(0);
  // Tersambung lagi: menahan Inti membuka sesi baru.
  api.transport.restore();
  await speak();
  await advance(THINK_MS);
  expect(screen.getByTestId('suara-balasan')).toBeOnTheScreen();
});

test('mikrofon gagal menyala: kendala ramah, boleh dicoba lagi', async () => {
  stream.start.mockRejectedValueOnce(new Error('mic'));
  await renderWithProviders(<Suara />);
  await fireEvent(screen.getByRole('button', { name: 'Tahan untuk bicara' }), 'pressIn');
  await flush();
  expect(screen.getByText('Mikrofon belum bisa dipakai. Coba lagi sebentar ya.')).toBeOnTheScreen();
  await fireEvent(screen.getByRole('button', { name: 'Tahan untuk bicara' }), 'pressOut');
  await speak();
  await advance(THINK_MS);
  expect(screen.getByTestId('suara-balasan')).toBeOnTheScreen();
});

test('dilepas sebelum mikrofon selesai menyala: tetap dimatikan', async () => {
  let release: () => void = () => {};
  audio.streamStart = () => new Promise<void>((resolve) => (release = resolve));
  await renderWithProviders(<Suara />);
  const inti = screen.getByRole('button', { name: 'Tahan untuk bicara' });
  await fireEvent(inti, 'pressIn');
  await flush();
  await fireEvent(inti, 'pressOut');
  expect(stream.stop).not.toHaveBeenCalled();
  release();
  await flush();
  expect(stream.stop).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Tahan Inti sambil bicara')).toBeOnTheScreen();
});

test('layar tetap menyala dan mode audio dipasang; semuanya dilepas saat ditutup', async () => {
  const { unmount } = await renderWithProviders(<Suara />);
  await flush();
  expect(activateKeepAwakeAsync).toHaveBeenCalledWith('mode-suara');
  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsRecording: true, playsInSilentMode: true }),
  );
  await speak();
  await advance(THINK_MS);
  const player = audio.players[0]!;
  await fireEvent(screen.getByRole('button', { name: 'Tahan untuk bicara' }), 'pressIn');
  await flush();
  await unmount();
  expect(stream.stop).toHaveBeenCalled();
  expect(player.removed).toBe(true);
  expect(deactivateKeepAwake).toHaveBeenCalledWith('mode-suara');
  expect(setAudioModeAsync).toHaveBeenLastCalledWith(expect.objectContaining({ allowsRecording: false }));
});

test('Selesai menutup Mode Suara', async () => {
  await renderWithProviders(<Suara />);
  await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
  expect(router.back).toHaveBeenCalled();
});

test('mode gelap tampil sama dengan teks yang sama', async () => {
  await renderWithProviders(<Suara />, { scheme: 'dark' });
  await speak();
  await advance(THINK_MS);
  expect(screen.getByTestId('suara-balasan')).toBeOnTheScreen();
});

test('cincin Inti mengikuti keras-pelannya suara dari mikrofon', async () => {
  await renderWithProviders(<Suara />);
  await fireEvent(screen.getByRole('button', { name: 'Tahan untuk bicara' }), 'pressIn');
  await flush();
  await act(async () => audio.emitBuffer(new Array<number>(1600).fill(20000)));
  await act(async () => audio.emitBuffer(new Array<number>(1600).fill(0)));
  expect(screen.getAllByTestId(/^inti-cincin-/)).toHaveLength(2);
});
