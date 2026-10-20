import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import Chat from '../app/chat';
import { createTestApi, renderWithProviders } from './helpers';
import { ChatController } from '@/api/chatController';
import { UNKNOWN_PART_NOTE, HELD_MINUTES, type Message, type Part } from '@/api/contract';
import { BLOCKED_TEXT, UNAVAILABLE_TEXT, UPGRADE_TEXT } from '@/api/errors';
import { wibIso } from '@/api/fake/clock';
import { FakeTransport, type FakeOptions } from '@/api/fake/FakeTransport';
import { formatJam } from '@/api/format';
import { createMemorySession } from '@/api/session';
import type { ConnectionStatus } from '@/api/transport';
import { useSample, type SampleState } from '@/sample/store';
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
  await advance(fakeOptions.latencyMs ?? 0);
  for (let i = 0; i < 3; i++) await advance(0);
  return { api, fake: api.transport as FakeTransport };
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
    await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
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
  async function askDraft(fake: FakeTransport) {
    await type('Balas Pak Andi, besok jam 9 ya');
    await advance(1);
    await advance(1200);
    await advance(1);
    expect(fake).toBeDefined();
    expect(screen.getByText('Pak Andi')).toBeOnTheScreen();
  }

  test('Kirim menahan lima menit dengan jam, Batalkan membatalkan', async () => {
    const { fake } = await mount({ history: [say(1, 'Selamat datang')] });
    await askDraft(fake);
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
    const { fake } = await mount({ history: [say(1, 'Selamat datang')] });
    await askDraft(fake);
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
    await askDraft(fake);
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    await advance(1);
    await advance(HELD_MINUTES * 60_000);
    expect(screen.getByText('Gagal terkirim')).toBeOnTheScreen();
    fake.failHeldSends(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
    await advance(1);
    expect(screen.getByText(/^Dikirim \d\d\.\d\d$/)).toBeOnTheScreen();
    await advance(HELD_MINUTES * 60_000);
    expect(screen.getByText(/^Terkirim \d\d\.\d\d$/)).toBeOnTheScreen();
  });

  test('Buang draf membuang draf yang belum disetujui', async () => {
    const { fake } = await mount({ history: [say(1, 'Selamat datang')] });
    await askDraft(fake);
    await fireEvent.press(screen.getByRole('button', { name: 'Buang draf' }));
    await advance(1);
    expect(screen.getByText('Dibatalkan · tidak jadi terkirim')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Kirim' })).toBeNull();
  });

  test('aksi yang ditolak server (draf sudah berubah) memberi toast ramah', async () => {
    const { fake } = await mount({ history: [say(1, 'Selamat datang')] });
    await askDraft(fake);
    fake.failNext('server');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    await advance(1);
    expect(latest.toast?.text).toBe('Lagi ada kendala, sudah dilaporkan ke tim. Coba lagi sebentar ya.');
    expect(screen.getByRole('button', { name: 'Kirim' })).toBeOnTheScreen();
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
    await fireEvent.press(screen.getByRole('button', { name: 'Putar pesan suara' }));
    expect(latest.toast?.text).toBe('Pemutar suara dibangun di Fase 6.');
  });

  test('kartu perangkat dari kontrak: mengetuk sakelar memanggil kendali dan 501 jadi toast ramah', async () => {
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
    expect(latest.toast?.text).toBe(UNAVAILABLE_TEXT);
    await fireEvent.press(screen.getByRole('button', { name: 'Naikkan suhu' }));
    await advance(0);
    expect(spy).toHaveBeenLastCalledWith('ac-kamar', { temp: 25 });
    // kartu tetap seperti dari server
    expect(screen.getByText('Nyala · Dingin')).toBeOnTheScreen();
  });

  test('mode gelap memakai warna palet gelap', async () => {
    await mount({ scheme: 'dark', history: [say(1, 'Halo gelap', { from: 'user' })] });
    expect(screen.getByText('Halo gelap').parent).toHaveStyle({ backgroundColor: dark.green });
    expect(within(screen.getByTestId('utas')).getByText('Halo gelap')).toBeOnTheScreen();
  });
});
