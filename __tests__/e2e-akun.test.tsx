import { act, fireEvent, screen } from '@testing-library/react-native';
import Agenda from '../app/(tabs)/agenda';
import { SAMPLE_CODE_HINT } from '../app/mulai/masuk';
import { audio } from './audioMock';
import { createFakeHttpServer, DEFAULT_VOICE_TURN, type FakeHttpServer, type VoiceTurnScript } from './fakeHttp';
import { advance, currentRoute, go, mockParams, restoreParams, showRoute } from './harness';
import { createTestApi, renderWithProviders, toastNow } from './helpers';
import type { Api, ApiFactory } from '@/api/ApiProvider';
import { SAMPLE_BANNER_TEXT } from '@/ui/SampleBanner';
import { RELEASE_TAIL_MS } from '@/voice/controller';
import { STT_FAILED_TEXT, VOICE_SOON_TEXT } from '@/voice/texts';

// Mode akun dari ujung ke ujung: HybridTransport di atas HttpTransport asli yang bicara lewat fetch dan soket palsu ke
// server palsu (`__tests__/fakeHttp.ts`, perilakunya seperti server Fase 1b-mini). Chat dan Mode Suara ke server itu;
// layar lain memakai data contoh di aplikasi dengan penanda "Contoh".

const API_URL = 'https://app.sekertaris.com';
/** Jalur yang sudah disediakan server asli. Mode akun tidak pernah meminta jalur lain (yang dibalas 501). */
const BUILT = /^\/(auth\/(start|verify|logout)|me|messages|push-tokens|media\/.+|agenda(\/.+)?)$/;
const DAY = 86_400_000;

let server: FakeHttpServer;

async function settle() {
  for (let i = 0; i < 4; i++) await advance(0);
}

interface Open {
  /** Sesi akun sudah tersimpan (aplikasi dibuka lagi). */
  signedIn?: boolean;
  /** `features.voice` akun ini di server. */
  voice?: boolean;
  /** Mulai di mode contoh (alamat server tetap diisi, jadi baris Data ada). */
  sample?: boolean;
  /** Giliran Mode Suara di server. */
  turn?: () => VoiceTurnScript;
}

/**
 * Buka aplikasi dengan alamat server diisi (build rilis). Mode yang diganti di aplikasi dibuat ulang lewat `factory`:
 * contoh = server tiruan, akun = transport baru ke server palsu yang sama dengan sesi yang sama.
 */
async function open(start: string, { signedIn = true, voice = true, sample = false, turn }: Open = {}) {
  server = createFakeHttpServer(
    {
      voice,
      me: {
        name: 'Budi Santoso',
        assistantName: 'Sari',
        phone: '6281220457781',
        plan: { name: 'Coba gratis 7 hari', activeUntil: new Date(Date.now() + 5 * DAY).toISOString() },
      },
    },
    { akun: true, voice: turn },
  );
  if (signedIn) await server.signIn();
  const contoh = createTestApi();
  const factory: ApiFactory = (mode) => (mode === 'contoh' ? contoh : server.newAkunApi());
  const initial: Api = sample ? contoh : server.api;
  await showRoute(start, { api: initial, apiUrl: API_URL, factory });
  await advance(400);
  await settle();
}

/** Permintaan ke jalur yang belum disediakan server: harus tidak ada. */
const unbuilt = () => server.requests.filter((r) => !BUILT.test(r.path)).map((r) => `${r.method} ${r.path}`);

beforeEach(() => {
  jest.clearAllMocks();
  audio.reset();
  mockParams();
});
afterEach(() => server?.dispose());
afterAll(restoreParams);

describe('masuk', () => {
  test('pemasangan baru: kode WhatsApp asli, lalu langsung Beranda yang menyapa pemilik akun', async () => {
    await open('/mulai', { signedIn: false });
    expect(currentRoute()).toBe('/mulai');
    await fireEvent.press(screen.getByRole('button', { name: 'Mulai' }));
    expect(currentRoute()).toBe('/mulai/masuk');
    // Tanpa nomor dan petunjuk contoh: kodenya sungguhan dari WhatsApp.
    expect(screen.getByLabelText('Nomor WhatsApp').props.value).toBe('');
    expect(screen.queryByText(SAMPLE_CODE_HINT)).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Nomor WhatsApp'), '0812 2045 7781');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    await settle();
    expect(server.hits('POST', '/auth/start')[0]!.body).toEqual({ phone: '6281220457781' });
    expect(toastNow()?.text).toBe('Kode dikirim lewat WhatsApp.');

    await fireEvent.changeText(screen.getByLabelText('Kode dari WhatsApp'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Masuk' }));
    await advance(400);
    await settle();
    expect(server.token()).not.toBeNull();
    expect(await server.api.session.get()).toBe(server.token());
    // Layar pilih layanan dilewati: tawarannya masih contoh.
    expect(currentRoute()).toBe('/');
    expect(await screen.findByText('Halo, Budi Santoso')).toBeOnTheScreen();
    expect(unbuilt()).toEqual([]);
  });

  test('nomor belum terdaftar: kalimat ramah dan jalan ke WhatsApp, tanpa kode error', async () => {
    await open('/mulai/masuk', { signedIn: false });
    await fireEvent.changeText(screen.getByLabelText('Nomor WhatsApp'), '0812 0000 0000');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    await settle();
    expect(screen.getByText('Nomor ini belum memakai Sekretaris AI. Mulai dulu lewat WhatsApp ya.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mulai lewat WhatsApp' })).toBeOnTheScreen();
    expect(screen.queryByText(/belum_terdaftar|404/)).toBeNull();
  });

  test('"Lihat contoh dulu": mode contoh tanpa masuk, langsung Beranda contoh', async () => {
    await open('/mulai', { signedIn: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Lihat contoh dulu' }));
    await advance(300);
    await settle();
    expect(currentRoute()).toBe('/');
    expect(await screen.findByText('Pagi, Rina')).toBeOnTheScreen();
    expect(server.hits('POST', '/auth/start')).toHaveLength(0);
    expect(server.token()).toBeNull();
  });
});

describe('Beranda, chat, dan Mode Suara asli', () => {
  test('Beranda: sapaan pemilik akun, tanpa blok contoh, "Coba bilang"; bilah tab hanya Beranda dan Agenda', async () => {
    await open('/');
    expect(await screen.findByText('Halo, Budi Santoso')).toBeOnTheScreen();
    for (const id of ['blok-persetujuan', 'blok-agenda', 'blok-favorit']) expect(screen.queryByTestId(id)).toBeNull();
    expect(screen.getByTestId('blok-saran')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Beranda' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Agenda' })).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Perangkat' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Usaha' })).toBeNull();
    // Inti berlabel nama asisten asli; Beranda tidak diberi penanda (isinya asli).
    expect(screen.getByRole('button', { name: 'Sari' })).toBeOnTheScreen();
    expect(screen.queryByText(SAMPLE_BANNER_TEXT)).toBeNull();
    expect(screen.queryByText(/Rina/)).toBeNull();
  });

  test('chat: kirim lewat POST /messages, berpikir dan balasan lewat stream; pesan WhatsApp bertanda', async () => {
    await open('/chat');
    expect(server.sockets[0]!.url).toBe('wss://app.sekertaris.com/app/v1/stream');
    const tags = screen.queryAllByText('lewat WhatsApp').length;
    await act(async () => {
      server.backend.receive({ from: 'user', via: 'whatsapp', parts: [{ type: 'text', text: 'Titip beli gula ya' }] });
    });
    await settle();
    expect(screen.getByText('Titip beli gula ya')).toBeOnTheScreen();
    expect(screen.getAllByText('lewat WhatsApp')).toHaveLength(tags + 1);

    await fireEvent.changeText(screen.getByLabelText('Tulis pesan untuk Sari'), 'Halo Sari');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim pesan' }));
    await settle();
    expect(server.hits('POST', '/messages')[0]!.body).toMatchObject({ kind: 'text', text: 'Halo Sari' });
    await advance(100);
    await settle();
    expect(screen.getAllByTestId('berpikir')).toHaveLength(1);
    await advance(1300);
    await settle();
    expect(screen.getByText(/Ini jawaban contoh/)).toBeOnTheScreen();
    expect(screen.queryByTestId('berpikir')).toBeNull();
    expect(unbuilt()).toEqual([]);
  });

  test('Mode Suara: ucapan ke /voice, teks, berpikir, balasan tampil dan suara MP3 diputar; masuk utas chat', async () => {
    await open('/suara');
    const inti = await screen.findByRole('button', { name: 'Tahan untuk bicara' });
    await fireEvent(inti, 'pressIn');
    await settle();
    for (let i = 0; i < 6; i++) await act(async () => audio.emitBuffer(new Array<number>(1600).fill(9000)));
    await fireEvent(inti, 'pressOut');
    await settle();
    // Mikrofon menyala sebentar setelah dilepas, lalu ucapannya dikirim sekaligus.
    await advance(RELEASE_TAIL_MS);
    await settle();

    const socket = server.voiceSockets[0]!;
    expect(socket.url).toBe('wss://app.sekertaris.com/app/v1/voice');
    expect(socket.headers.Authorization).toBe(`Bearer ${server.token()}`);
    const sent = socket.received.map((m) => m.type);
    expect(sent[0]).toBe('start');
    expect(sent.at(-1)).toBe('stop');
    expect(sent.filter((t) => t === 'audio').length).toBeGreaterThan(0);

    expect(screen.getByTestId('suara-ucapan')).toHaveTextContent(DEFAULT_VOICE_TURN.transcript);
    expect(screen.getByText('Sebentar…')).toBeOnTheScreen();
    // Tepat sejauh jeda jawaban server palsu (1 detik): jawabannya datang di ujung langkah jam tiruan. Dulu itu membuat
    // registri jam frame Reanimated menerima "hapus" untuk id yang belum terdaftar (lihat __tests__/jam-frame.test.tsx).
    const errors = jest.spyOn(console, 'error');
    await advance(1000);
    await settle();
    expect(screen.getByTestId('suara-balasan')).toHaveTextContent(DEFAULT_VOICE_TURN.reply);
    expect(audio.players).toHaveLength(1);
    expect((audio.players[0]!.source as { uri: string }).uri).toMatch(/\.mp3$/);
    await act(async () => audio.finishPlayback());
    expect(screen.getByLabelText('Siap')).toBeOnTheScreen();
    await advance(50);
    expect(errors.mock.calls.map((a) => a.map(String).join(' ')).filter((m) => /startTime/.test(m))).toEqual([]);
    errors.mockRestore();

    await go('/chat');
    await settle();
    expect(screen.getByText(DEFAULT_VOICE_TURN.reply)).toBeOnTheScreen();
    expect(unbuilt()).toEqual([]);
  });

  test('server gagal mengenali ucapan: kalimat ramah tanpa kode', async () => {
    await open('/suara', { turn: () => ({ ...DEFAULT_VOICE_TURN, error: 'stt_gagal' }) });
    const inti = await screen.findByRole('button', { name: 'Tahan untuk bicara' });
    await fireEvent(inti, 'pressIn');
    await settle();
    for (let i = 0; i < 6; i++) await act(async () => audio.emitBuffer(new Array<number>(1600).fill(9000)));
    await fireEvent(inti, 'pressOut');
    await settle();
    await advance(RELEASE_TAIL_MS);
    await settle();
    expect(screen.getByText(STT_FAILED_TEXT)).toBeOnTheScreen();
    expect(screen.queryByText(/stt_gagal/)).toBeNull();
  });

  test('features.voice mati: "Mode Suara segera hadir." tanpa membuka soket suara', async () => {
    await open('/suara', { voice: false });
    expect(screen.getByTestId('suara-segera')).toHaveTextContent(VOICE_SOON_TEXT);
    expect(screen.queryByRole('button', { name: 'Tahan untuk bicara' })).toBeNull();
    expect(server.voiceSockets).toHaveLength(0);
    await go('/chat');
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Bicara' }));
    expect(toastNow()?.text).toBe(VOICE_SOON_TEXT);
  });
});

describe('layar contoh', () => {
  const SAMPLE_SCREENS = [
    '/perangkat',
    '/perangkat/ac-kamar',
    '/perangkat/tambah',
    '/usaha',
    '/usaha/lainnya',
    '/terhubung',
    '/terhubung/moka',
    '/riwayat',
    '/akun/asisten',
    '/akun/notifikasi',
    '/akun/keamanan',
  ];

  test.each(SAMPLE_SCREENS)('%s: satu baris penanda "Contoh" di atas', async (path) => {
    await open(path);
    expect(screen.getAllByText(SAMPLE_BANNER_TEXT)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Tutup penanda contoh' })).toBeOnTheScreen();
  });

  test.each(['/', '/chat', '/akun', '/agenda'])('%s: tanpa penanda (isinya asli)', async (path) => {
    await open(path);
    expect(screen.queryByText(SAMPLE_BANNER_TEXT)).toBeNull();
  });

  test('penanda ditutup per kelompok layar sampai aplikasi dibuka lagi', async () => {
    await open('/perangkat');
    await fireEvent.press(screen.getByRole('button', { name: 'Tutup penanda contoh' }));
    expect(screen.queryByText(SAMPLE_BANNER_TEXT)).toBeNull();
    // Remote perangkat satu kelompok dengan Perangkat: tetap tertutup.
    await go('/perangkat/ac-kamar');
    await settle();
    expect(screen.queryByText(SAMPLE_BANNER_TEXT)).toBeNull();
    // Kelompok lain tetap diberi penanda.
    await go('/riwayat');
    await settle();
    expect(screen.getByText(SAMPLE_BANNER_TEXT)).toBeOnTheScreen();
  });

  test('mode contoh: tidak ada penanda', async () => {
    await renderWithProviders(<Agenda />);
    await advance(400);
    expect(screen.queryByText(SAMPLE_BANNER_TEXT)).toBeNull();
  });

  test('aksi di layar contoh hanya mengubah data contoh: tidak ada permintaan ke server asli', async () => {
    await open('/perangkat');
    const lamp = await screen.findByRole('switch', { name: 'Lampu utama' });
    expect(lamp).toBeChecked();
    await fireEvent.press(lamp);
    await settle();
    expect(screen.getByRole('switch', { name: 'Lampu utama' })).not.toBeChecked();
    const sample = await server.sample!.devices('Rumah');
    expect(sample.devices.find((d) => d.id === 'lampu-utama')!.on).toBe(false);
    expect(server.hits('POST', '/home/devices/lampu-utama')).toHaveLength(0);
    expect(unbuilt()).toEqual([]);
  });
});

describe('Agenda asli', () => {
  test('Agenda dari GET /agenda server asli; mencentang tugas mengirim PATCH ke server, bukan ke data contoh', async () => {
    await open('/agenda');
    expect(server.hits('GET', '/agenda').length).toBeGreaterThan(0);
    const task = await screen.findByRole('checkbox', { name: /^15\.00/ });
    expect(task).not.toBeChecked();
    await fireEvent.press(task);
    await settle();
    expect(server.hits('PATCH', '/agenda/a3').map((r) => r.body)).toEqual([{ done: true }]);
    expect(screen.getByRole('checkbox', { name: /^15\.00/ })).toBeChecked();
    // Data contoh di aplikasi tidak ikut berubah.
    const sample = await server.sample!.agenda();
    expect(sample.items.find((i) => i.id === 'a3')?.done).toBeUndefined();
    expect(unbuilt()).toEqual([]);
  });
});

describe('Akun', () => {
  test('profil, nomor, dan paket asli dari GET /me; baris yang isinya contoh disembunyikan', async () => {
    await open('/akun');
    expect(await screen.findByText('Budi Santoso')).toBeOnTheScreen();
    expect(screen.getByText(/^Coba gratis · \d hari$/)).toBeOnTheScreen();
    expect(screen.queryByText('Rina Wulandari')).toBeNull();
    // Nama asisten asli, belum bisa diubah dari aplikasi.
    expect(screen.getByText('Sari')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Asisten/ })).toBeNull();
    for (const row of ['Pemberitahuan', 'Keamanan', 'Layanan tersambung']) expect(screen.queryByText(row)).toBeNull();
    expect(screen.getByRole('button', { name: 'Data. Akun Anda' })).toBeOnTheScreen();
    expect(screen.queryByText('Data contoh')).toBeNull();
    expect(screen.getByRole('button', { name: 'Keluar' })).toBeOnTheScreen();
  });

  test('Data: Akun Anda ke Contoh tanpa keluar (sesi tetap tersimpan), lalu kembali tanpa masuk ulang', async () => {
    await open('/akun');
    const token = server.token();
    await fireEvent.press(screen.getByRole('button', { name: 'Data. Akun Anda' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Contoh' }));
    await advance(300);
    await settle();
    expect(currentRoute()).toBe('/akun');
    expect(screen.getByRole('button', { name: 'Data. Contoh' })).toBeOnTheScreen();
    expect(toastNow()?.text).toBe('Sekarang memakai data contoh.');
    expect(await screen.findByText('Rina Wulandari')).toBeOnTheScreen();
    expect(server.hits('POST', '/auth/logout')).toHaveLength(0);
    expect(await server.api.session.get()).toBe(token);

    await fireEvent.press(screen.getByRole('button', { name: 'Data. Contoh' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Akun Anda' }));
    await advance(400);
    await settle();
    expect(currentRoute()).toBe('/akun');
    expect(await screen.findByText('Budi Santoso')).toBeOnTheScreen();
  });

  test('Data: Contoh ke Akun Anda tanpa sesi membuka layar masuk', async () => {
    await open('/akun', { signedIn: false, sample: true });
    expect(screen.getByRole('button', { name: 'Data. Contoh' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Data. Contoh' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Akun Anda' }));
    await advance(400);
    await settle();
    expect(currentRoute()).toBe('/mulai');
    expect(screen.getByRole('button', { name: 'Lihat contoh dulu' })).toBeOnTheScreen();
  });
});

describe('sesi ditolak server (401)', () => {
  test('dari soket stream: keluar dan kembali ke layar masuk, seperti mode server', async () => {
    await open('/');
    expect(await screen.findByText('Halo, Budi Santoso')).toBeOnTheScreen();
    server.revoke();
    await advance(400);
    await settle();
    expect(await server.api.session.get()).toBeNull();
    expect(currentRoute()).toBe('/mulai');
  });

  test('dari kirim pesan di chat', async () => {
    await open('/chat');
    server.revoke({ sockets: false });
    await fireEvent.changeText(screen.getByLabelText('Tulis pesan untuk Sari'), 'Halo');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim pesan' }));
    await advance(400);
    await settle();
    expect(server.hits('POST', '/messages').some((r) => r.status === 401)).toBe(true);
    expect(await server.api.session.get()).toBeNull();
    expect(currentRoute()).toBe('/mulai');
  });
});
