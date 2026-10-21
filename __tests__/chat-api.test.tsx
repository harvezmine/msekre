import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import Chat from '../app/chat';
import { createTestApi, renderWithProviders } from './helpers';
import { ChatController, FIND_DRAFT_MAX_PAGES, THINKING_MAX_MS } from '@/api/chatController';
import { isChatThinking } from '@/api/chatState';
import { useChatController } from '@/api/ChatProvider';
import { useAuth } from '@/api/useAuth';
import { UNKNOWN_PART_NOTE, HELD_MINUTES, type Message, type Part } from '@/api/contract';
import {
  BLOCKED_TEXT,
  DRAFT_CHANGED_TEXT,
  DRAFT_SENT_TEXT,
  FILE_DOWNLOAD_TEXT,
  FILE_NO_APP_TEXT,
  ERROR_TEXT,
  UPGRADE_TEXT,
} from '@/api/errors';
import { wibIso } from '@/api/fake/clock';
import { FakeTransport, type FakeOptions } from '@/api/fake/FakeTransport';
import { formatJam } from '@/api/format';
import { createMemorySession } from '@/api/session';
import { ApiFailure, type ConnectionStatus } from '@/api/transport';
import { deviceById, useSample, type SampleState } from '@/sample/store';
import { dark } from '@/theme/tokens';

let latest: SampleState;
function Probe() {
  const { state } = useSample();
  useEffect(() => {
    latest = state;
  });
  return null;
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

/** Mode `server` (label) dengan server tiruan: chat memakai kartu perangkat dari kontrak, bukan penyimpanan contoh. */
async function mount(options: FakeOptions & { scheme?: 'light' | 'dark' } = {}) {
  const { scheme, ...fakeOptions } = options;
  const api = createTestApi({ mode: 'server', token: 't', ...fakeOptions });
  await renderWithProviders(
    <>
      <Chat />
      <Probe />
    </>,
    { api, scheme },
  );
  // Pengendali baru berjalan setelah sesi diperiksa (`me`), baru riwayatnya dimuat: dua kali jeda request.
  await advance(fakeOptions.latencyMs ?? 0);
  await advance(fakeOptions.latencyMs ?? 0);
  for (let i = 0; i < 3; i++) await advance(0);
  return { api, fake: api.transport as FakeTransport };
}

/** Event stream berikutnya tidak sampai ke aplikasi (seperti koneksi yang diam-diam mati). `mockRestore` memulihkannya. */
function loseStreamEvents(fake: FakeTransport) {
  return jest.spyOn(fake as unknown as { emit(event: unknown): void }, 'emit').mockImplementation(() => {});
}

/** Beri waktu untuk rantai promise (request, resync) selesai. */
async function settle() {
  for (let i = 0; i < 6; i++) await advance(0);
}

const AT = wibIso(10, 20, '09.00');
function message(seq: number, parts: Part[], extra: Partial<Message> = {}): Message {
  return { id: `x${seq}`, seq, rev: seq, at: AT, from: 'assistant', via: 'app', parts, ...extra };
}
const say = (seq: number, text: string, extra: Partial<Message> = {}) => message(seq, [{ type: 'text', text }], extra);

async function type(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Tulis pesan untuk Nadia'), text);
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim pesan' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

describe('riwayat', () => {
  test('pesan dari server tampil, terbaru di bawah, dengan tanda lewat WhatsApp', async () => {
    await mount({
      history: [
        say(1, 'Besok ingatkan saya rapat', { from: 'user', via: 'whatsapp' }),
        say(2, 'Siap, saya ingatkan.', { via: 'whatsapp' }),
        say(3, 'Ada lagi?'),
        say(4, 'Tidak, terima kasih', { from: 'user' }),
      ],
    });
    for (const t of ['Besok ingatkan saya rapat', 'Siap, saya ingatkan.', 'Ada lagi?', 'Tidak, terima kasih']) {
      expect(screen.getByText(t)).toBeOnTheScreen();
    }
    expect(screen.getAllByText('lewat WhatsApp')).toHaveLength(2);
    // Daftar terbalik: pesan terbaru paling awal di data.
    expect(screen.getByTestId('utas').props.inverted).toBe(true);
    expect(screen.queryByTestId('memuat-lama')).toBeNull();
  });

  test('menggulir ke atas memuat halaman lama dengan indikator kecil', async () => {
    const history = Array.from({ length: 45 }, (_, i) => say(i + 1, `Pesan ${i + 1}`));
    const { fake } = await mount({ history, latencyMs: 300 });
    const spy = jest.spyOn(fake, 'messages');
    expect(screen.getByText('Pesan 45')).toBeOnTheScreen();
    expect(screen.queryByText('Pesan 10')).toBeNull();
    await fireEvent(screen.getByTestId('utas'), 'endReached');
    expect(spy).toHaveBeenCalledWith(16);
    expect(screen.getByTestId('memuat-lama')).toBeOnTheScreen();
    // ujung atas terpicu lagi saat masih memuat: tidak ada permintaan kedua
    await fireEvent(screen.getByTestId('utas'), 'endReached');
    expect(spy).toHaveBeenCalledTimes(1);
    await advance(300);
    expect(screen.queryByTestId('memuat-lama')).toBeNull();
    // sudah habis (before null): tidak meminta lagi
    await fireEvent(screen.getByTestId('utas'), 'endReached');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('pengendali menggabungkan halaman lama ke utas (45 pesan dalam dua halaman)', async () => {
    const history = Array.from({ length: 45 }, (_, i) => say(i + 1, `Pesan ${i + 1}`));
    const transport = new FakeTransport(createMemorySession('t'), { history });
    const controller = new ChatController(transport);
    controller.start();
    await advance(0);
    expect(controller.getState()).toMatchObject({ loaded: true, hasOlder: true, olderCursor: 16 });
    expect(controller.getState().messages).toHaveLength(30);
    await controller.loadOlder();
    expect(controller.getState().messages.map((m) => m.seq)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
    expect(controller.getState().hasOlder).toBe(false);
    controller.stop();
    transport.dispose();
  });
});

describe('mengirim', () => {
  test('optimistis "mengirim…", diganti pesan tersimpan; echo stream tidak menggandakan', async () => {
    await mount({ latencyMs: 300 });
    await type('Halo Nadia');
    expect(screen.getByText('Halo Nadia')).toBeOnTheScreen();
    expect(screen.getByText('mengirim…')).toBeOnTheScreen();
    await advance(300);
    expect(screen.queryByText('mengirim…')).toBeNull();
    expect(screen.getAllByText('Halo Nadia')).toHaveLength(1);
    await advance(1); // echo dari stream
    expect(screen.getAllByText('Halo Nadia')).toHaveLength(1);
  });

  test('gagal kirim: "Belum terkirim · Coba lagi", lalu Coba lagi mengirim dengan clientId yang sama', async () => {
    const { fake } = await mount();
    const spy = jest.spyOn(fake, 'send');
    fake.failNext('network');
    await type('Halo lagi');
    expect(screen.getByText('Belum terkirim · Coba lagi')).toBeOnTheScreen();
    expect(screen.queryByText('mengirim…')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Coba kirim lagi pesan Halo lagi' }));
    await advance(1);
    expect(screen.queryByText('Belum terkirim · Coba lagi')).toBeNull();
    expect(screen.getAllByText('Halo lagi')).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1]![0]).toEqual(spy.mock.calls[0]![0]);
  });

  test('pesan yang diketik saat sinyal putus diantre, lalu terkirim begitu tersambung lagi', async () => {
    const { fake } = await mount();
    const spy = jest.spyOn(fake, 'send');
    await act(async () => {
      fake.drop();
    });
    await advance(0);
    await type('Dikirim nanti');
    expect(screen.getByText('Dikirim nanti')).toBeOnTheScreen();
    expect(screen.getByText('mengirim…')).toBeOnTheScreen();
    expect(spy).not.toHaveBeenCalled();
    await act(async () => {
      fake.restore();
    });
    await advance(0);
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('mengirim…')).toBeNull();
    expect(screen.getAllByText('Dikirim nanti')).toHaveLength(1);
  });
});

describe('koneksi', () => {
  test('banner sinyal lemah setelah 3 detik putus; Inti di header mati; hilang saat tersambung', async () => {
    const { fake } = await mount();
    expect(screen.queryByTestId('banner-koneksi')).toBeNull();
    await act(async () => {
      fake.drop();
    });
    await advance(2999);
    expect(screen.queryByTestId('banner-koneksi')).toBeNull();
    expect(screen.getByTestId('inti-inti')).not.toHaveStyle({ opacity: 0.35 });
    await advance(1);
    expect(screen.getByText('Sinyal lemah, pesan Anda saya simpan dulu.')).toBeOnTheScreen();
    expect(screen.getByTestId('inti-inti')).toHaveStyle({ opacity: 0.35 });
    await act(async () => {
      fake.restore();
    });
    await advance(0);
    expect(screen.queryByTestId('banner-koneksi')).toBeNull();
    expect(screen.getByTestId('inti-inti')).not.toHaveStyle({ opacity: 0.35 });
  });

  test('putus sebentar (kurang dari 3 detik) tidak memunculkan banner', async () => {
    const { fake } = await mount();
    await act(async () => {
      fake.drop(1000);
    });
    await advance(2000);
    await advance(2000);
    expect(screen.queryByTestId('banner-koneksi')).toBeNull();
  });

  test.each<[ConnectionStatus, string, string]>([
    ['blocked', BLOCKED_TEXT, 'Akun sedang tidak aktif'],
    ['upgrade_required', UPGRADE_TEXT, 'Perbarui aplikasi untuk lanjut mengobrol'],
  ])('status %s langsung menampilkan banner penyebabnya', async (status, text, placeholder) => {
    class Forced extends FakeTransport {
      subscribe(...args: Parameters<FakeTransport['subscribe']>) {
        const [onEvent, onStatus, onResync] = args;
        return super.subscribe(onEvent, () => onStatus(status), onResync);
      }
    }
    const session = createMemorySession('t');
    const api = { mode: 'server' as const, session, transport: new Forced(session, { mode: 'server' }) };
    await renderWithProviders(<Chat />, { api });
    await advance(0);
    expect(screen.getByText(text)).toBeOnTheScreen();
    expect(screen.getByTestId('inti-inti')).toHaveStyle({ opacity: 0.35 });
    // Kolom ketik mati dengan petunjuk penyebabnya; mic juga tidak bisa dipakai.
    const input = screen.getByPlaceholderText(placeholder);
    expect(input.props.editable).toBe(false);
    expect(screen.getByRole('button', { name: 'Bicara' })).toBeDisabled();
  });

  test('tersambung: kolom ketik aktif dengan petunjuk biasa', async () => {
    await mount();
    expect(screen.getByPlaceholderText('Tulis pesan untuk Nadia').props.editable).not.toBe(false);
  });

  test('pengendali: resync berhalaman (more) membawa semua pesan yang terlewat saat putus', async () => {
    const transport = new FakeTransport(createMemorySession('t'), { afterLimit: 1 });
    const controller = new ChatController(transport);
    controller.start();
    await advance(0);
    const base = controller.getState().messages.length;
    transport.drop();
    for (const text of ['satu', 'dua', 'tiga'])
      transport.receive({ from: 'assistant', via: 'whatsapp', parts: [{ type: 'text', text }] });
    expect(controller.getState().messages).toHaveLength(base);
    transport.restore();
    for (let i = 0; i < 6; i++) await advance(0);
    const texts = controller
      .getState()
      .messages.slice(-3)
      .map((m) => (m.parts[0]!.type === 'text' ? m.parts[0].text : ''));
    expect(texts).toEqual(['satu', 'dua', 'tiga']);
    expect(controller.getState().messages).toHaveLength(base + 3);
    controller.stop();
    transport.dispose();
  });

  test('resync setelah putus membawa QRIS yang lunas selagi putus (lewat rev, bukan seq)', async () => {
    const { fake } = await mount();
    expect(screen.queryByTestId('qris-lunas')).toBeNull();
    await act(async () => {
      fake.drop();
    });
    await advance(0);
    fake.payQris();
    await advance(0);
    expect(screen.queryByTestId('qris-lunas')).toBeNull();
    await act(async () => {
      fake.restore();
    });
    for (let i = 0; i < 4; i++) await advance(0);
    expect(screen.getByTestId('qris-lunas')).toBeOnTheScreen();
    expect(screen.getByText('Sudah dibayar')).toBeOnTheScreen();
    expect(screen.queryByTestId('qris-kode')).toBeNull();
  });
});

describe('tombol pilihan', () => {
  test('mengetuk satu pilihan mengunci tombol, mengirim jawaban, lalu chosenId dari server mengonfirmasi', async () => {
    const { fake } = await mount({ latencyMs: 300, history: [say(1, 'Selamat datang')] });
    const spy = jest.spyOn(fake, 'send');
    await type('Beli token listrik 50 ribu');
    await advance(300);
    await advance(1200);
    await advance(1);
    expect(screen.getByText('Rp50.000')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ya, benar' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Batal' })).toBeOnTheScreen();
    spy.mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Ya, benar' }));
    // terkunci dan dijawab langsung: hanya pilihan itu yang tersisa, gelembung "mengirim…"
    expect(screen.queryByRole('button', { name: 'Batal' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ya, benar' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('mengirim…')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ya, benar' }));
    await advance(300);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toMatchObject({ kind: 'choice', choiceId: 'ya' });
    await advance(1);
    expect(screen.getAllByText('Ya, benar')).toHaveLength(2); // tombol terpilih + jawaban pengguna
    await advance(1200);
    await advance(1);
    expect(screen.getByText('Bayar dengan QRIS')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ya, benar' }).props.accessibilityState).toMatchObject({
      disabled: true,
      selected: true,
    });
  });
});

describe('kartu draf', () => {
  // Lima menit waktu palsu tanpa animasi Inti dan titik berpikir (kalau tidak, ribuan bingkai animasi dijalankan).
  beforeEach(() => jest.mocked(useIsFocused).mockReturnValue(false));
  afterEach(() => jest.mocked(useIsFocused).mockReturnValue(true));

  /** Minta draf balasan dan tunggu kartunya tampil. */
  async function askDraft() {
    await type('Balas Pak Andi, besok jam 9 ya');
    await advance(1);
    await advance(1200);
    await advance(1);
    expect(screen.getByText('Pak Andi')).toBeOnTheScreen();
  }

  test('Kirim menahan lima menit dengan jam, Batalkan membatalkan', async () => {
    await mount({ history: [say(1, 'Selamat datang')] });
    await askDraft();
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    await advance(1);
    const time = formatJam(new Date(Date.parse(wibIso(10, 20, '10.42')) + HELD_MINUTES * 60_000).toISOString());
    expect(screen.getByText(/^Dikirim \d\d\.\d\d$/)).toBeOnTheScreen();
    expect(screen.getByText(`Dikirim ${time}`, { exact: false })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
    await advance(1);
    expect(screen.getByText('Dibatalkan · tidak jadi terkirim')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Batalkan' })).toBeNull();
  });

  test('tertahan lima menit lalu terkirim', async () => {
    await mount({ history: [say(1, 'Selamat datang')] });
    await askDraft();
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    await advance(1);
    expect(screen.getByRole('button', { name: 'Batalkan' })).toBeOnTheScreen();
    await advance(HELD_MINUTES * 60_000);
    expect(screen.getByText(/^Terkirim \d\d\.\d\d$/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Batalkan' })).toBeNull();
  });

  test('gagal setelah masa tahan: "Gagal terkirim", Coba lagi mengirim ulang sampai terkirim', async () => {
    const { fake } = await mount({ history: [say(1, 'Selamat datang')] });
    fake.failHeldSends();
    await askDraft();
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    await advance(1);
    await advance(HELD_MINUTES * 60_000);
    expect(screen.getByText('Gagal terkirim')).toBeOnTheScreen();
    fake.failHeldSends(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Coba kirim lagi draf ke Pak Andi' }));
    await advance(1);
    expect(screen.getByText(/^Dikirim \d\d\.\d\d$/)).toBeOnTheScreen();
    await advance(HELD_MINUTES * 60_000);
    expect(screen.getByText(/^Terkirim \d\d\.\d\d$/)).toBeOnTheScreen();
  });

  test('Buang draf membuang draf yang belum disetujui', async () => {
    await mount({ history: [say(1, 'Selamat datang')] });
    await askDraft();
    await fireEvent.press(screen.getByRole('button', { name: 'Buang draf' }));
    await advance(1);
    expect(screen.getByText('Dibatalkan · tidak jadi terkirim')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Kirim' })).toBeNull();
  });

  test('kendala server saat aksi memberi toast ramah dan kartu tetap bisa dicoba lagi', async () => {
    const { fake } = await mount({ history: [say(1, 'Selamat datang')] });
    await askDraft();
    fake.failNext('server');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    await advance(1);
    expect(latest.toast?.text).toBe('Lagi ada kendala, sudah dilaporkan ke tim. Coba lagi sebentar ya.');
    expect(screen.getByRole('button', { name: 'Kirim' }).props.accessibilityState.disabled).toBe(false);
  });

  test('draf sudah berubah di tempat lain (409 status_draf): teks ramah dan kartu menampilkan keadaan sebenarnya', async () => {
    const { fake } = await mount({ history: [say(1, 'Selamat datang')] });
    await askDraft();
    // Draf dibuang dari tempat lain, tapi kabarnya tidak sampai ke aplikasi.
    const lost = loseStreamEvents(fake);
    await fake.draftAction('d-contoh-1', { action: 'discard' });
    await advance(1);
    lost.mockRestore();
    expect(screen.getByRole('button', { name: 'Kirim' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    for (let i = 0; i < 4; i++) await advance(0);
    expect(latest.toast?.text).toBe(DRAFT_CHANGED_TEXT);
    expect(screen.getByText('Dibatalkan · tidak jadi terkirim')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Kirim' })).toBeNull();
  });

  test('Batalkan terlambat (sudah terkirim): "tidak bisa dibatalkan lagi" dan kartu jadi Terkirim', async () => {
    const { fake } = await mount({ history: [say(1, 'Selamat datang')] });
    await askDraft();
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    await advance(1);
    expect(screen.getByRole('button', { name: 'Batalkan' })).toBeOnTheScreen();
    const lost = loseStreamEvents(fake);
    await advance(HELD_MINUTES * 60_000); // di server sudah terkirim; kabarnya tidak sampai
    lost.mockRestore();
    await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
    for (let i = 0; i < 4; i++) await advance(0);
    expect(latest.toast?.text).toBe(DRAFT_SENT_TEXT);
    expect(screen.getByText(/^Terkirim \d\d\.\d\d$/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Batalkan' })).toBeNull();
  });

  test('selagi aksi berjalan semua tombol kartu mati dan ketukan kedua tidak mengirim permintaan lagi', async () => {
    const { fake } = await mount({ latencyMs: 300, history: [say(1, 'Selamat datang')] });
    await type('Balas Pak Andi, besok jam 9 ya');
    await advance(300);
    await advance(1200);
    await advance(1);
    const spy = jest.spyOn(fake, 'draftAction');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    for (const name of ['Kirim', 'Ubah', 'Buang draf']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Buang draf' }));
    await advance(300);
    await advance(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/^Dikirim \d\d\.\d\d$/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Batalkan' })).not.toBeDisabled();
  });

  test('kolom Ubah menutup sendiri kalau drafnya sudah berubah di tempat lain', async () => {
    const { fake } = await mount({ history: [say(1, 'Selamat datang')] });
    await askDraft();
    await fireEvent.press(screen.getByRole('button', { name: 'Ubah' }));
    expect(screen.getByLabelText('Isi pesan')).toBeOnTheScreen();
    await fake.draftAction('d-contoh-1', { action: 'discard' });
    await advance(1);
    expect(screen.queryByLabelText('Isi pesan')).toBeNull();
    expect(screen.getByText('Dibatalkan · tidak jadi terkirim')).toBeOnTheScreen();
  });
});

describe('berpikir', () => {
  test('dua proses yang tumpang tindih: tanda berpikir hidup sampai keduanya selesai', async () => {
    await mount();
    await type('Halo');
    await advance(1);
    expect(screen.getAllByTestId('berpikir')).toHaveLength(1);
    await advance(600);
    await type('Halo lagi');
    await advance(1);
    expect(screen.getAllByTestId('berpikir')).toHaveLength(1);
    await advance(600); // proses pertama selesai, yang kedua belum
    await advance(1);
    expect(screen.getAllByTestId('berpikir')).toHaveLength(1);
    await advance(600); // kedua selesai
    await advance(1);
    expect(screen.queryByTestId('berpikir')).toBeNull();
  });
});

describe('bagian dan kartu', () => {
  test('bagian yang tidak dikenal: teks versi terbaru', async () => {
    await mount({ history: [message(1, [{ type: 'unknown', note: UNKNOWN_PART_NOTE }])] });
    expect(screen.getByText('Pesan ini butuh aplikasi versi terbaru.')).toBeOnTheScreen();
  });

  test('gambar, dokumen, suara, notulen, pembayaran, dan QRIS kedaluwarsa', async () => {
    await mount({
      history: [
        message(1, [{ type: 'image', mediaId: 'contoh-qris', mime: 'image/png', caption: 'Foto struk' }]),
        message(2, [
          {
            type: 'document',
            mediaId: 'contoh-laporan',
            name: 'Laporan.pdf',
            mime: 'application/pdf',
            sizeBytes: 2_621_440,
          },
        ]),
        message(3, [{ type: 'audio', mediaId: 'contoh-suara', mime: 'audio/ogg', transcript: 'Tolong cek stok susu' }]),
        message(4, [
          {
            type: 'card',
            card: {
              kind: 'notes',
              title: 'Rapat mingguan',
              when: 'Senin · 09.00',
              decisions: ['Satu'],
              meetingId: 'r1',
            },
          },
        ]),
        message(5, [
          {
            type: 'card',
            card: {
              kind: 'payment',
              title: 'Token PLN',
              amountRp: 100000,
              lines: [{ label: 'No. meter', value: '123' }],
              ask: 'Sudah benar?',
            },
          },
        ]),
        message(6, [
          {
            type: 'card',
            card: {
              kind: 'qris',
              amountRp: 20000,
              until: wibIso(10, 20, '10.00'),
              status: 'kedaluwarsa',
              mediaId: 'contoh-qris',
            },
          },
        ]),
      ],
    });
    expect(screen.getByTestId('gambar-contoh')).toBeOnTheScreen();
    expect(screen.getByText('Foto struk')).toBeOnTheScreen();
    expect(screen.getByText('Laporan.pdf')).toBeOnTheScreen();
    expect(screen.getByText('2,5 MB · PDF')).toBeOnTheScreen();
    expect(screen.getByText('Tolong cek stok susu')).toBeOnTheScreen();
    expect(screen.getByText('Rapat mingguan')).toBeOnTheScreen();
    expect(screen.getByText('Rp100.000', { exact: false })).toBeOnTheScreen();
    expect(screen.getByText('No. meter')).toBeOnTheScreen();
    expect(screen.getByText('QRIS ini sudah kedaluwarsa. Minta saya buatkan yang baru.')).toBeOnTheScreen();
    // Kodenya tidak ditampilkan lagi, supaya tidak terpindai.
    expect(screen.getByTestId('qris-kedaluwarsa')).toBeOnTheScreen();
    expect(screen.queryByTestId('qris-kode')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Putar pesan suara' }));
    expect(latest.toast?.text).toBe('Pemutar suara segera hadir.');
  });

  test('kartu perangkat dari kontrak: sakelar dan suhu memanggil kendali, kartu mengikuti jawaban server', async () => {
    const { fake } = await mount({
      history: [
        message(1, [
          {
            type: 'card',
            card: { kind: 'device', deviceId: 'ac-kamar', name: 'AC kamar', on: true, temp: 24, mode: 'Dingin' },
          },
        ]),
      ],
    });
    const spy = jest.spyOn(fake, 'controlDevice');
    expect(screen.getByText('Nyala · Dingin')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('switch', { name: 'AC kamar' }));
    await advance(0);
    expect(spy).toHaveBeenCalledWith('ac-kamar', { on: false });
    expect(screen.getByText('Mati')).toBeOnTheScreen();
    expect(deviceById(fake.sample.getState(), 'ac-kamar')!.on).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Naikkan suhu' }));
    await advance(0);
    expect(spy).toHaveBeenLastCalledWith('ac-kamar', { temp: 25 });
    expect(deviceById(fake.sample.getState(), 'ac-kamar')!.ac!.temp).toBe(25);
    expect(screen.getByText('25°')).toBeOnTheScreen();
  });

  test('kartu perangkat: kendali gagal jadi toast ramah dan kartu tidak berubah', async () => {
    const { fake } = await mount({
      history: [
        message(1, [
          {
            type: 'card',
            card: { kind: 'device', deviceId: 'ac-kamar', name: 'AC kamar', on: true, temp: 24, mode: 'Dingin' },
          },
        ]),
      ],
    });
    fake.failNext('network');
    await fireEvent.press(screen.getByRole('switch', { name: 'AC kamar' }));
    await advance(0);
    expect(latest.toast?.text).toBe(ERROR_TEXT);
    expect(screen.getByText('Nyala · Dingin')).toBeOnTheScreen();
    expect(deviceById(fake.sample.getState(), 'ac-kamar')!.on).toBe(true);
  });

  test('kartu perangkat yang dijaga (kunci): hanya keadaan dan "Buka di Perangkat", tanpa sakelar', async () => {
    const { fake } = await mount({
      history: [
        message(1, [
          {
            type: 'card',
            card: {
              kind: 'device',
              deviceId: 'pintu-depan',
              name: 'Pintu depan',
              on: true,
              deviceKind: 'lock',
              sensitive: true,
              switchable: true,
            },
          },
        ]),
      ],
    });
    const spy = jest.spyOn(fake, 'controlDevice');
    expect(screen.getByText('Pintu depan')).toBeOnTheScreen();
    expect(screen.getByText('Terkunci')).toBeOnTheScreen();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Naikkan suhu' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Buka di Perangkat' }));
    expect(router.navigate).toHaveBeenCalledWith('/perangkat');
    expect(spy).not.toHaveBeenCalled();
  });

  test('kartu perangkat tanpa deviceKind tapi dijaga lewat sensitive, dan jenis asing: tanpa salju dan suhu', async () => {
    await mount({
      history: [
        message(1, [
          {
            type: 'card',
            card: { kind: 'device', deviceId: 'a', name: 'Alarm rumah', on: true, sensitive: true, temp: 24 },
          },
        ]),
        message(2, [
          {
            type: 'card',
            card: {
              kind: 'device',
              deviceId: 'b',
              name: 'Alat baru',
              on: true,
              deviceKind: 'robot-masa-depan' as 'other',
              temp: 20,
            },
          },
        ]),
      ],
    });
    expect(screen.queryByTestId('ikon-snow')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Naikkan suhu' })).toBeNull();
    // Jenis asing dibaca `other`: sakelar hanya bila switchable.
    expect(screen.queryByRole('switch', { name: 'Alat baru' })).toBeNull();
    expect(screen.getAllByText('Nyala')).toHaveLength(2);
  });

  test('kartu perangkat jenis lain yang switchable: sakelar saja, tanpa pengatur suhu', async () => {
    await mount({
      history: [
        message(1, [
          {
            type: 'card',
            card: {
              kind: 'device',
              deviceId: 'colokan',
              name: 'Colokan meja',
              on: false,
              deviceKind: 'plug',
              switchable: true,
            },
          },
        ]),
      ],
    });
    expect(screen.getByRole('switch', { name: 'Colokan meja' })).toBeOnTheScreen();
    expect(screen.queryByTestId('ikon-snow')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Turunkan suhu' })).toBeNull();
  });

  test('kartu perangkat: 428 pin_diperlukan membuka lembar PIN, bukan toast buntu', async () => {
    const { fake } = await mount({
      history: [
        message(1, [
          {
            type: 'card',
            card: { kind: 'device', deviceId: 'ac-kamar', name: 'AC kamar', on: true, temp: 24, mode: 'Dingin' },
          },
        ]),
      ],
    });
    jest
      .spyOn(fake, 'controlDevice')
      .mockRejectedValue(new ApiFailure('pin_required', { status: 428, error: 'pin_diperlukan' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'AC kamar' }));
    await advance(0);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/pin', params: { id: 'ac-kamar' } });
    expect(latest.toast).toBeNull();
  });

  test('kartu perangkat di chat mengikuti perangkat yang diubah dari layar lain (event device)', async () => {
    const { fake } = await mount({
      history: [
        message(1, [
          {
            type: 'card',
            card: { kind: 'device', deviceId: 'ac-kamar', name: 'AC kamar', on: true, temp: 24, mode: 'Dingin' },
          },
        ]),
      ],
    });
    await act(async () => {
      fake.sample.dispatch({ type: 'setAc', deviceId: 'ac-kamar', on: false });
    });
    await settle();
    expect(screen.getByText('Mati')).toBeOnTheScreen();
  });

  test('mode gelap memakai warna palet gelap', async () => {
    await mount({ scheme: 'dark', history: [say(1, 'Halo gelap', { from: 'user' })] });
    expect(screen.getByText('Halo gelap').parent).toHaveStyle({ backgroundColor: dark.green });
    expect(within(screen.getByTestId('utas')).getByText('Halo gelap')).toBeOnTheScreen();
  });
});

describe('"Lihat draf" (?draf=)', () => {
  const draftPart = (id: string, text = 'Pesan 10 karton susu'): Part => ({
    type: 'card',
    card: {
      kind: 'draft',
      draft: { id, to: 'PT Sumber Susu', channel: 'whatsapp', what: 'pesanan', text, status: 'draft' },
    },
  });
  /** Draf di pesan paling lama, diikuti 44 pesan biasa: halaman pertama (30 pesan) tidak memuatnya. */
  const oldDraft = () => [
    message(1, [draftPart('d9')]),
    ...Array.from({ length: 44 }, (_, i) => say(i + 2, `Pesan ${i + 2}`)),
  ];

  test('draf di halaman lama: dicari dengan memuat halaman lama, lalu digulir sekali', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ draf: 'd9' });
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
    const pages = jest.spyOn(FakeTransport.prototype, 'messages');
    try {
      const { fake } = await mount({ history: oldDraft() });
      await settle();
      await settle();
      expect(latest.toast).toBeNull();
      // Halaman lama (dengan penanda `before`) dimuat untuk menemukan draf.
      expect(pages.mock.calls.some((call) => call[0] !== undefined)).toBe(true);
      // Daftar terbalik: pesan paling lama (berisi draf) ada di ujung data.
      expect(scroll).toHaveBeenCalledTimes(1);
      const index = (scroll.mock.calls[0]![0] as { index: number }).index;
      expect(index).toBeGreaterThanOrEqual(40);
      // Pesan baru masuk: tidak menggulir lagi.
      await act(async () => {
        fake.sample.dispatch({ type: 'setAc', deviceId: 'ac-kamar', on: false });
      });
      await settle();
      expect(scroll).toHaveBeenCalledTimes(1);
    } finally {
      scroll.mockRestore();
      pages.mockRestore();
    }
  });

  test('pesan dikenal (dari "Pesan lagi"): draf ditemukan lewat id pesannya', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ draf: 'tidak-cocok', pesan: 'x1' });
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
    try {
      await mount({ history: oldDraft() });
      await settle();
      await settle();
      // Id draf tidak cocok, tapi pesan x1 ada di halaman lama: ketemu, tanpa toast.
      expect(latest.toast).toBeNull();
    } finally {
      scroll.mockRestore();
    }
  });

  test('draf yang tidak ada di mana pun: toast ramah, tanpa menggulir', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ draf: 'hilang' });
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
    const pages = jest.spyOn(FakeTransport.prototype, 'messages');
    try {
      await mount({ history: oldDraft() });
      await settle();
      await settle();
      await settle();
      expect(latest.toast?.text).toBe('Drafnya tidak ketemu, mungkin sudah dikirim atau dibuang.');
      // Halaman pertama + halaman lama yang ada (45 pesan = dua halaman), lalu berhenti.
      expect(pages.mock.calls.length).toBeLessThanOrEqual(1 + FIND_DRAFT_MAX_PAGES);
      expect(scroll).not.toHaveBeenCalled();
    } finally {
      scroll.mockRestore();
      pages.mockRestore();
    }
  });
});

describe('pengendali bersama (ChatProvider)', () => {
  let setChatOpen: (open: boolean) => void;
  function Toggle() {
    const [open, set] = useState(true);
    useEffect(() => {
      setChatOpen = set;
    }, [set]);
    return open ? <Chat /> : null;
  }

  test('antrean offline tetap terkirim setelah chat ditutup, dan pesannya ada saat chat dibuka lagi', async () => {
    const api = createTestApi({ mode: 'server', token: 't' });
    const fake = api.transport as FakeTransport;
    await renderWithProviders(<Toggle />, { api });
    await settle();
    const spy = jest.spyOn(fake, 'send');
    await act(async () => {
      fake.drop();
    });
    await advance(0);
    await type('Dikirim nanti');
    expect(screen.getByText('mengirim…')).toBeOnTheScreen();
    await act(async () => {
      setChatOpen(false); // kembali ke Beranda
    });
    expect(spy).not.toHaveBeenCalled();
    await act(async () => {
      fake.restore();
    });
    await settle();
    expect(spy).toHaveBeenCalledTimes(1);
    await act(async () => {
      setChatOpen(true);
    });
    await settle();
    expect(screen.getAllByText('Dikirim nanti')).toHaveLength(1);
    expect(screen.queryByText('mengirim…')).toBeNull();
  });

  test('keluar (mode server) membuang pengendali dan antreannya; pengguna berikutnya mulai bersih', async () => {
    const api = createTestApi({ mode: 'server', token: 't' });
    const fake = api.transport as FakeTransport;
    const seen: { controller: ChatController; logout: () => Promise<void> }[] = [];
    function Probe2() {
      const controller = useChatController();
      const { logout } = useAuth();
      useEffect(() => {
        seen.push({ controller, logout });
      });
      return null;
    }
    await renderWithProviders(<Probe2 />, { api });
    await settle();
    const first = seen.at(-1)!.controller;
    await act(async () => {
      fake.drop();
    });
    first.send('antre');
    expect(first.getState().pending).toHaveLength(1);
    await act(async () => {
      await seen.at(-1)!.logout();
    });
    await settle();
    const second = seen.at(-1)!.controller;
    expect(second).not.toBe(first);
    expect(second.getState().pending).toHaveLength(0);
    expect(second.getState().messages).toHaveLength(0);
  });
});

describe('dokumen: unduh lalu buka atau bagikan', () => {
  const doc = message(1, [
    { type: 'document', mediaId: 'contoh-laporan', name: 'Laporan.pdf', mime: 'application/pdf', sizeBytes: 1000 },
  ]);
  const real = { kind: 'uri', uri: 'https://x.test/app/v1/media/lap', headers: { Authorization: 'Bearer t' } } as const;

  beforeEach(() => {
    jest.mocked(File.downloadFileAsync).mockClear();
    jest.mocked(IntentLauncher.startActivityAsync).mockClear().mockResolvedValue({ resultCode: -1 });
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    jest.mocked(Sharing.shareAsync).mockClear().mockResolvedValue();
  });

  test('Buka mengunduh dengan header token lalu membukanya di aplikasi bawaan (Android)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { fake } = await mount({ history: [doc] });
    jest.spyOn(fake, 'mediaUrl').mockResolvedValue(real);
    await fireEvent.press(screen.getByRole('button', { name: 'Buka' }));
    await settle();
    expect(File.downloadFileAsync).toHaveBeenCalledWith(
      'https://x.test/app/v1/media/lap',
      expect.objectContaining({ uri: expect.stringMatching(/\/contoh-laporan\/Laporan\.pdf$/) }),
      { headers: { Authorization: 'Bearer t' }, idempotent: true },
    );
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith('android.intent.action.VIEW', {
      data: expect.stringMatching(/^content:\/\/.*Laporan\.pdf$/),
      type: 'application/pdf',
      flags: 1,
    });
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(latest.toast).toBeNull();
    jest.restoreAllMocks();
  });

  test('tidak ada aplikasi pembuka: jatuh ke lembar bagikan; tanpa itu pun, toast ramah', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { fake } = await mount({ history: [doc] });
    jest.spyOn(fake, 'mediaUrl').mockResolvedValue(real);
    jest.mocked(IntentLauncher.startActivityAsync).mockRejectedValue(new Error('ActivityNotFoundException'));
    await fireEvent.press(screen.getByRole('button', { name: 'Buka' }));
    await settle();
    expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.stringMatching(/Laporan\.pdf$/), {
      mimeType: 'application/pdf',
      dialogTitle: 'Laporan.pdf',
    });
    expect(latest.toast).toBeNull();
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Buka' }));
    await settle();
    expect(latest.toast?.text).toBe(FILE_NO_APP_TEXT);
    jest.restoreAllMocks();
  });

  test('Bagikan mengunduh lalu membuka lembar bagikan', async () => {
    const { fake } = await mount({ history: [doc] });
    jest.spyOn(fake, 'mediaUrl').mockResolvedValue(real);
    await fireEvent.press(screen.getByRole('button', { name: 'Bagikan' }));
    await settle();
    expect(File.downloadFileAsync).toHaveBeenCalledTimes(1);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.stringMatching(/Laporan\.pdf$/), {
      mimeType: 'application/pdf',
      dialogTitle: 'Laporan.pdf',
    });
    expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalled();
  });

  test('selagi mengunduh kedua tombol sibuk, lalu kembali', async () => {
    const { fake } = await mount({ history: [doc] });
    jest.spyOn(fake, 'mediaUrl').mockResolvedValue(real);
    let finish: (f: File) => void = () => {};
    jest.mocked(File.downloadFileAsync).mockReturnValueOnce(new Promise<File>((r) => (finish = r)));
    await fireEvent.press(screen.getByRole('button', { name: 'Bagikan' }));
    await settle();
    expect(screen.getByRole('button', { name: 'Mengunduh…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Buka' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Buka' }));
    expect(File.downloadFileAsync).toHaveBeenCalledTimes(1);
    await act(async () => finish(new File('file:///cache/berkas/x/Laporan.pdf')));
    await settle();
    expect(screen.getByRole('button', { name: 'Bagikan' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Buka' })).toBeEnabled();
  });

  test('unduhan gagal, atau media tidak ada: toast ramah dan tombol kembali', async () => {
    const { fake } = await mount({ history: [doc] });
    const media = jest.spyOn(fake, 'mediaUrl').mockResolvedValue(real);
    jest.mocked(File.downloadFileAsync).mockRejectedValueOnce(new Error('UnableToDownload 404'));
    await fireEvent.press(screen.getByRole('button', { name: 'Buka' }));
    await settle();
    expect(latest.toast?.text).toBe(FILE_DOWNLOAD_TEXT);
    expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalled();
    media.mockRejectedValue(new ApiFailure('network'));
    await fireEvent.press(screen.getByRole('button', { name: 'Bagikan' }));
    await settle();
    expect(latest.toast?.text).toBe(FILE_DOWNLOAD_TEXT);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Buka' })).toBeEnabled();
  });

  test('tombol tidak sibuk lagi begitu aplikasi pembuka berjalan, walau pengguna belum kembali', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { fake } = await mount({ history: [doc] });
    jest.spyOn(fake, 'mediaUrl').mockResolvedValue(real);
    // Aplikasi pembuka belum menjawab (pengguna masih membaca berkasnya).
    jest.mocked(IntentLauncher.startActivityAsync).mockReturnValue(new Promise(() => {}));
    await fireEvent.press(screen.getByRole('button', { name: 'Buka' }));
    await settle();
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Buka' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Bagikan' })).toBeEnabled();
    jest.restoreAllMocks();
  });

  test('berkas yang sudah diunduh dengan ukuran sama dipakai lagi, tanpa mengunduh ulang; ukuran beda mengunduh lagi', async () => {
    const { fake } = await mount({ history: [doc] });
    jest.spyOn(fake, 'mediaUrl').mockResolvedValue(real);
    const existing = (File as unknown as { existing: Map<string, number> }).existing;
    existing.set('file:///cache/berkas/contoh-laporan/Laporan.pdf', 1000);
    try {
      await fireEvent.press(screen.getByRole('button', { name: 'Bagikan' }));
      await settle();
      expect(File.downloadFileAsync).not.toHaveBeenCalled();
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        'file:///cache/berkas/contoh-laporan/Laporan.pdf',
        expect.anything(),
      );
      existing.set('file:///cache/berkas/contoh-laporan/Laporan.pdf', 999);
      await fireEvent.press(screen.getByRole('button', { name: 'Bagikan' }));
      await settle();
      expect(File.downloadFileAsync).toHaveBeenCalledTimes(1);
    } finally {
      existing.clear();
    }
  });

  test('unduhan gagal: sesi diperiksa satu kali (401 menghapus sesi seperti request lain)', async () => {
    const { fake } = await mount({ history: [doc] });
    jest.spyOn(fake, 'mediaUrl').mockResolvedValue(real);
    const me = jest.spyOn(fake, 'me');
    jest.mocked(File.downloadFileAsync).mockRejectedValueOnce(new Error('UnableToDownload 401'));
    await fireEvent.press(screen.getByRole('button', { name: 'Buka' }));
    await settle();
    expect(latest.toast?.text).toBe(FILE_DOWNLOAD_TEXT);
    expect(me).toHaveBeenCalledTimes(1);
  });

  test('server tiruan: berkas teks contoh ditulis ke cache, lalu dibuka', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await mount({ history: [doc] });
    await fireEvent.press(screen.getByRole('button', { name: 'Buka' }));
    await settle();
    expect(File.downloadFileAsync).not.toHaveBeenCalled();
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.intent.action.VIEW',
      expect.objectContaining({ type: 'text/plain', data: expect.stringMatching(/Laporan \(contoh\)\.txt$/) }),
    );
    jest.restoreAllMocks();
  });

  test('Lampiran tetap "segera hadir"', async () => {
    await mount({ history: [doc] });
    await fireEvent.press(screen.getByRole('button', { name: 'Lampiran' }));
    expect(latest.toast?.text).toBe('Lampiran segera hadir.');
  });
});

describe('pengendali: antrean, riwayat awal, dan pengaman', () => {
  function make(options: FakeOptions = {}) {
    const transport = new FakeTransport(createMemorySession('t'), options);
    const controller = new ChatController(transport);
    return { transport, controller };
  }

  test('pesan yang diketik selagi antrean dikirim berada di belakang antrean (urutan ketik terjaga)', async () => {
    const { transport, controller } = make({ latencyMs: 100 });
    controller.start();
    await advance(300);
    const sent: string[] = [];
    const real = transport.send.bind(transport);
    jest.spyOn(transport, 'send').mockImplementation((req) => {
      if (req.kind === 'text') sent.push(req.text);
      return real(req);
    });
    transport.drop();
    await advance(0);
    controller.send('a');
    controller.send('b');
    transport.restore();
    await advance(0); // antrean mulai dikirim
    controller.send('c');
    expect(controller.getState().pending.find((p) => p.text === 'c')?.queued).toBe(true);
    for (let i = 0; i < 12; i++) {
      await advance(100);
      await settle();
    }
    expect(sent).toEqual(['a', 'b', 'c']);
    expect(controller.getState().pending).toHaveLength(0);
    controller.stop();
    transport.dispose();
  });

  test('pesan yang masuk antara pengambilan riwayat dan stream terbuka tidak hilang', async () => {
    const { transport, controller } = make();
    const real = transport.messages.bind(transport);
    let first = true;
    jest.spyOn(transport, 'messages').mockImplementation(async (before) => {
      const page = await real(before);
      if (first) {
        first = false;
        // Selagi halaman ini di jalan, stream putus-sambung dan satu pesan terlewat.
        transport.drop();
        transport.receive({ from: 'assistant', via: 'whatsapp', parts: [{ type: 'text', text: 'terlewat' }] });
        transport.restore();
      }
      return page;
    });
    controller.start();
    for (let i = 0; i < 8; i++) await advance(0);
    const texts = controller
      .getState()
      .messages.flatMap((m) => m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])));
    expect(texts).toContain('terlewat');
    controller.stop();
    transport.dispose();
  });

  test('resync berhenti kalau halaman tidak maju (tanpa putaran tanpa akhir)', async () => {
    const { transport, controller } = make();
    controller.start();
    await advance(0);
    const base = controller.getState().messages.at(-1)!;
    const spy = jest
      .spyOn(transport, 'messagesChanged')
      .mockResolvedValue({ items: [{ ...base, id: 'z', rev: 1 }], more: true });
    transport.drop();
    transport.restore();
    for (let i = 0; i < 8; i++) await advance(0);
    expect(spy).toHaveBeenCalledTimes(1);
    controller.stop();
    transport.dispose();
  });

  test('tanda berpikir yang tak pernah dimatikan padam sendiri setelah batas waktu', async () => {
    const { transport, controller } = make({ thinkMs: THINKING_MAX_MS * 2 });
    controller.start();
    await advance(0);
    controller.send('Halo');
    await settle();
    await advance(1);
    expect(isChatThinking(controller.getState())).toBe(true);
    await advance(THINKING_MAX_MS - 10);
    expect(isChatThinking(controller.getState())).toBe(true);
    await advance(20);
    expect(isChatThinking(controller.getState())).toBe(false);
    controller.stop();
    transport.dispose();
  });

  test('pilihan yang sudah diambil di tempat lain (sudah_dipilih): tidak gagal, tombol terbuka lagi tanpa Coba lagi', async () => {
    const choices: Part = {
      type: 'choices',
      prompt: 'Lanjut?',
      choices: [
        { id: 'a', title: 'Ya' },
        { id: 'b', title: 'Tidak' },
      ],
    };
    const { transport, controller } = make({ history: [message(1, [choices], { id: 'pilih' })] });
    controller.start();
    await advance(0);
    jest.spyOn(transport, 'send').mockRejectedValue(new ApiFailure('server', { status: 409, error: 'sudah_dipilih' }));
    controller.choose('pilih', 'a');
    expect(controller.getState().locks).toEqual({ pilih: 'a' });
    await advance(0);
    const state = controller.getState();
    expect(state.pending).toHaveLength(0);
    expect(state.locks).toEqual({});
    controller.stop();
    transport.dispose();
  });
});

describe('tampilan utas', () => {
  test('keterangan header mengikuti koneksi', async () => {
    const { fake } = await mount();
    expect(screen.getByText('Siap membantu')).toBeOnTheScreen();
    await act(async () => {
      fake.drop();
    });
    expect(screen.getByText('Menyambung lagi…')).toBeOnTheScreen();
    expect(screen.queryByText('Siap membantu')).toBeNull();
    await act(async () => {
      fake.restore();
    });
    await settle();
    expect(screen.getByText('Siap membantu')).toBeOnTheScreen();
  });

  test('pengaturan daftar: tahan posisi baca, tutup keyboard dengan geser', async () => {
    await mount();
    const list = screen.getByTestId('utas');
    expect(list.props.keyboardDismissMode).toBe('interactive');
    expect(list.props.maintainVisibleContentPosition).toMatchObject({ minIndexForVisible: 1 });
  });

  test('mengirim saat sedang menggulir ke pesan lama kembali ke dasar', async () => {
    await mount();
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    await fireEvent(screen.getByTestId('utas'), 'scroll', {
      nativeEvent: {
        contentOffset: { x: 0, y: 900 },
        contentSize: { width: 300, height: 3000 },
        layoutMeasurement: { width: 300, height: 600 },
      },
    });
    await type('Halo dari atas');
    expect(scroll).toHaveBeenCalledWith({ offset: 0, animated: true });
    scroll.mockRestore();
  });

  test('tombol pilihan: label pembaca layar memuat keterangannya', async () => {
    await mount({
      history: [
        message(1, [
          {
            type: 'choices',
            choices: [
              { id: 'a', title: 'Besok pagi', description: 'Jam 9' },
              { id: 'b', title: 'Lusa' },
            ],
          },
        ]),
      ],
    });
    expect(screen.getByRole('button', { name: 'Besok pagi. Jam 9' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lusa' })).toBeOnTheScreen();
  });

  test('kartu pembayaran dengan label yang sama tidak bentrok kuncinya', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    await mount({
      history: [
        message(1, [
          {
            type: 'card',
            card: {
              kind: 'payment',
              title: 'Tagihan',
              amountRp: 5000,
              lines: [
                { label: 'Catatan', value: 'satu' },
                { label: 'Catatan', value: 'dua' },
              ],
              ask: 'Sudah benar?',
            },
          },
        ]),
      ],
    });
    expect(screen.getByText('satu')).toBeOnTheScreen();
    expect(screen.getByText('dua')).toBeOnTheScreen();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  test('gambar yang gagal: "Coba muat lagi" mengambil ulang, juga saat unduhannya yang gagal', async () => {
    const { fake } = await mount({
      history: [message(1, [{ type: 'image', mediaId: 'm1', mime: 'image/png', alt: 'Foto struk' }])],
    });
    // Alamat gambarnya sendiri tidak didapat (berkas tidak ada).
    expect(screen.getByTestId('gambar-gagal')).toBeOnTheScreen();
    jest.spyOn(fake, 'mediaUrl').mockResolvedValue({ kind: 'uri', uri: 'https://x.test/a.png', headers: {} });
    await fireEvent.press(screen.getByRole('button', { name: 'Coba muat ulang gambar' }));
    await settle();
    expect(screen.queryByTestId('gambar-gagal')).toBeNull();
    // Unduhan gambarnya gagal.
    await fireEvent(screen.getByLabelText('Foto struk'), 'error');
    expect(screen.getByTestId('gambar-gagal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Coba muat ulang gambar' }));
    await settle();
    expect(screen.getByLabelText('Foto struk')).toBeOnTheScreen();
    expect(screen.queryByTestId('gambar-gagal')).toBeNull();
  });
});
