import { act, fireEvent, screen } from '@testing-library/react-native';
import { createFakeHttpServer, type FakeHttpServer } from './fakeHttp';
import { advance, currentRoute, go, mockParams, restoreParams, showRoute } from './harness';
import { toastNow } from './helpers';
import { PREVIEW_DEBOUNCE_MS } from '../app/agenda/tambah';
import { UPGRADE_TEXT } from '@/api/errors';

// Mode server dari ujung ke ujung: `HttpTransport` asli bicara lewat fetch dan soket palsu ke server tiruan di
// belakang (`__tests__/fakeHttp.ts`). Yang diuji: layar, kontrol, permintaan HTTP sungguhan, pembacaan longgar, stream.

let server: FakeHttpServer;

async function settle() {
  for (let i = 0; i < 4; i++) await advance(0);
}

/** Buka aplikasi di mode server. `signedIn`: sesi sudah ada (token tersimpan), seperti membuka aplikasi lagi. */
async function open(start: string, signedIn = true) {
  server = createFakeHttpServer();
  if (signedIn) await server.signIn();
  await showRoute(start, { api: server.api });
  await advance(400);
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams();
});
afterEach(() => server?.dispose());
afterAll(restoreParams);

test('masuk: kode diminta dan dicocokkan lewat HTTP, token disimpan, layar aplikasi terbuka', async () => {
  await open('/mulai', false);
  expect(currentRoute()).toBe('/mulai');
  await fireEvent.press(screen.getByRole('button', { name: 'Mulai' }));
  expect(currentRoute()).toBe('/mulai/masuk');

  await fireEvent.changeText(screen.getByLabelText('Nomor WhatsApp'), '0812 2045 7781');
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
  await settle();
  const start = server.hits('POST', '/auth/start');
  expect(start).toHaveLength(1);
  expect(start[0]!.body).toEqual({ phone: '6281220457781' });
  expect(start[0]!.headers.Authorization).toBeUndefined();
  expect(start[0]!.headers['X-App-Version']).toBe('1.0.0');
  expect(toastNow()?.text).toBe('Kode dikirim lewat WhatsApp.');

  await fireEvent.changeText(screen.getByLabelText('Kode dari WhatsApp'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Masuk' }));
  await advance(400);
  await settle();
  expect(server.hits('POST', '/auth/verify')).toHaveLength(1);
  expect(server.token()).not.toBeNull();
  expect(await server.api.session.get()).toBe(server.token());
  // Layar masuk sudah ditutup penjaga; selanjutnya pilihan minat atau Beranda.
  expect(['/mulai/pilih', '/']).toContain(currentRoute());
});

test('kode salah: kalimat ramah, tanpa token', async () => {
  await open('/mulai/masuk', false);
  await fireEvent.changeText(screen.getByLabelText('Nomor WhatsApp'), '0812 2045 7781');
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
  await settle();
  await fireEvent.changeText(screen.getByLabelText('Kode dari WhatsApp'), '000000');
  await fireEvent.press(screen.getByRole('button', { name: 'Masuk' }));
  await settle();
  expect(screen.getByText('Kodenya belum cocok. Coba cek lagi pesan WhatsApp-nya.')).toBeOnTheScreen();
  expect(server.token()).toBeNull();
  expect(await server.api.session.get()).toBeNull();
});

test('Beranda dimuat dari GET /home dengan token; sakelar AC memanggil POST /home/devices/:id', async () => {
  await open('/');
  const homes = server.hits('GET', '/home');
  expect(homes.length).toBeGreaterThan(0);
  expect(homes[0]!.headers.Authorization).toBe(`Bearer ${server.token()}`);
  expect(await screen.findByText('Selamat pagi, Rina')).toBeOnTheScreen();
  expect(screen.getByText('AC kamar nyala · 24°')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('switch', { name: 'AC kamar' }));
  await settle();
  const control = server.hits('POST', '/home/devices/ac-kamar');
  expect(control).toHaveLength(1);
  expect(control[0]!.body).toMatchObject({ on: false });
  expect(await screen.findByText('AC kamar mati')).toBeOnTheScreen();
});

test('chat: pesan dikirim lewat POST /messages, balasan dan tanda berpikir datang lewat soket stream', async () => {
  await open('/chat');
  // Riwayat dari GET /messages, soket terbuka dengan token di header jabat tangan.
  expect(server.hits('GET', '/messages').length).toBeGreaterThan(0);
  expect(server.sockets.length).toBeGreaterThan(0);
  expect(server.sockets[0]!.headers.Authorization).toBe(`Bearer ${server.token()}`);
  expect(server.sockets[0]!.url).toMatch(/^wss:\/\/app\.sekertaris\.com\/app\/v1\/stream$/);

  await fireEvent.changeText(screen.getByLabelText('Tulis pesan untuk Nadia'), 'Halo Nadia');
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim pesan' }));
  await settle();
  const sent = server.hits('POST', '/messages');
  expect(sent).toHaveLength(1);
  expect(sent[0]!.body).toMatchObject({ kind: 'text', text: 'Halo Nadia' });
  expect(screen.getByText('Halo Nadia')).toBeOnTheScreen();

  await advance(100);
  await settle();
  expect(screen.getAllByTestId('berpikir')).toHaveLength(1);
  await advance(1300);
  await settle();
  expect(screen.getByText(/Ini jawaban contoh/)).toBeOnTheScreen();
  expect(screen.queryByTestId('berpikir')).toBeNull();
});

test('perangkat: ganti tempat lewat PUT /places/current, sakelar lampu lewat POST, backend ikut berubah', async () => {
  await open('/perangkat');
  await fireEvent.press(screen.getByRole('button', { name: 'Tempat: Semua' }));
  await fireEvent.press(await screen.findByRole('radio', { name: 'Rumah' }));
  await advance(300);
  await settle();
  expect(server.hits('PUT', '/places/current')[0]!.body).toEqual({ place: 'Rumah' });
  expect(await screen.findByRole('tab', { name: 'Ruang tamu' })).toBeSelected();

  await fireEvent.press(screen.getByRole('switch', { name: 'Lampu utama, Nyala · 80%' }));
  await settle();
  expect(server.hits('POST', '/home/devices/lampu-utama')).toHaveLength(1);
  expect(screen.getByText('Mati')).toBeOnTheScreen();
  const devices = await server.backend.devices('Rumah');
  expect(devices.devices.find((d) => d.id === 'lampu-utama')!.on).toBe(false);
});

test('agenda: Tambah memakai POST /agenda/parse lalu POST /agenda, item baru ada di daftar', async () => {
  await open('/agenda');
  await fireEvent.press(screen.getByRole('button', { name: 'Tambah' }));
  await fireEvent.changeText(
    screen.getByPlaceholderText('Ingatkan saya bayar pajak motor tanggal 25'),
    'Ingatkan saya bayar pajak motor tanggal 25',
  );
  await advance(PREVIEW_DEBOUNCE_MS);
  await settle();
  expect(server.hits('POST', '/agenda/parse')).toHaveLength(1);
  expect(await screen.findByText('Akan saya simpan sebagai')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
  await settle();
  const added = server.hits('POST', '/agenda');
  expect(added).toHaveLength(1);
  expect(added[0]!.body).toMatchObject({ item: { title: 'Bayar pajak motor' } });
  expect(toastNow()?.text).toBe('Tersimpan di agenda.');
  await advance(300);
  expect(currentRoute()).toBe('/agenda');
  const all = await server.backend.agenda();
  expect(all.items.some((a) => a.title === 'Bayar pajak motor')).toBe(true);
});

test('akun: ganti nama asisten lewat PUT /account/assistant, nama baru sampai ke Beranda dan chat', async () => {
  await open('/akun/asisten');
  await fireEvent.changeText(screen.getByLabelText('Nama asisten'), ' Sari ');
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
  await settle();
  expect(server.hits('PUT', '/account/assistant')[0]!.body).toMatchObject({ name: 'Sari' });
  expect(toastNow()?.text).toBe('Tersimpan. Sekarang saya Sari.');
  await go('/');
  await settle();
  expect(screen.getByRole('button', { name: 'Bicara dengan Sari' })).toBeOnTheScreen();
  await go('/chat');
  await settle();
  expect(screen.getByLabelText('Tulis pesan untuk Sari')).toBeOnTheScreen();
  expect((await server.backend.me()).assistantName).toBe('Sari');
});

test('keluar: POST /auth/logout, sesi kosong, kembali ke /mulai', async () => {
  await open('/akun');
  const token = server.token();
  await fireEvent.press(screen.getByRole('button', { name: 'Keluar' }));
  expect(currentRoute()).toBe('/keluar');
  await fireEvent.press(screen.getByRole('button', { name: 'Keluar' }));
  await advance(300);
  await settle();
  expect(server.hits('POST', '/auth/logout')).toHaveLength(1);
  expect(server.hits('POST', '/auth/logout')[0]!.headers.Authorization).toBe(`Bearer ${token}`);
  expect(await server.api.session.get()).toBeNull();
  expect(currentRoute()).toBe('/mulai');
});

test('401 dari soket stream (4401): sesi dihapus dan pengguna dibawa ke /mulai', async () => {
  await open('/');
  expect(await screen.findByText('Selamat pagi, Rina')).toBeOnTheScreen();
  server.revoke();
  await advance(400);
  await settle();
  expect(await server.api.session.get()).toBeNull();
  expect(currentRoute()).toBe('/mulai');
});

test('401 dari permintaan HTTP di tengah sesi: sesi dihapus dan pengguna dibawa ke /mulai', async () => {
  await open('/');
  expect(await screen.findByText('Selamat pagi, Rina')).toBeOnTheScreen();
  server.revoke({ sockets: false });
  await fireEvent.press(screen.getByRole('switch', { name: 'AC kamar' }));
  await advance(400);
  await settle();
  expect(server.requests.some((r) => r.status === 401)).toBe(true);
  expect(await server.api.session.get()).toBeNull();
  expect(currentRoute()).toBe('/mulai');
});

test('426 pada jabat tangan stream: banner perlu pembaruan, kolom ketik mati', async () => {
  await open('/chat');
  server.requireUpgrade();
  // Soket yang sedang terbuka putus; tiga kali gagal terbuka memicu pemeriksaan GET /me yang dijawab 426.
  await act(async () => {
    for (const s of server.sockets) {
      if (s.closed) continue;
      s.off?.();
      s.onerror?.({});
      s.onclose?.({ code: 1006 });
    }
  });
  for (let i = 0; i < 12; i++) await advance(20_000);
  await settle();
  expect(server.requests.some((r) => r.status === 426 && r.path === '/me')).toBe(true);
  expect(screen.getByText(UPGRADE_TEXT)).toBeOnTheScreen();
  expect(screen.getByPlaceholderText('Perbarui aplikasi untuk lanjut mengobrol').props.editable).toBe(false);
});
