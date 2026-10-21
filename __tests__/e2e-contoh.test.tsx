import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { TEMP_DEBOUNCE_MS } from '../app/perangkat/[id]';
import { PREVIEW_DEBOUNCE_MS } from '../app/agenda/tambah';
import { audio } from './audioMock';
import { advance, currentRoute, currentStack, go, mockParams, restoreParams, sampleState, showRoute } from './harness';
import { createTestApi, toastNow } from './helpers';
import { THINK_MS } from '@/sample/chat';
import { deviceById, MAIN_AC_ID } from '@/sample/store';

// Perjalanan pengguna di mode contoh, dari layar pertama sampai keluar, lewat navigasi tiruan (harness) dan server tiruan.
// Tiap tes memulai dari layar yang masuk akal dan berpindah dengan mengetuk, seperti pengguna.

async function settle() {
  for (let i = 0; i < 3; i++) await advance(0);
}

const dpad = async (digits: string) => {
  for (const d of digits) await fireEvent.press(screen.getByRole('button', { name: d }));
  for (let i = 0; i < 4; i++) await advance(0);
};

beforeEach(() => {
  jest.clearAllMocks();
  audio.reset();
  mockParams();
});
afterAll(restoreParams);

test('onboarding: Mulai, masuk dengan nomor dan kode, pilih minat, tiba di Beranda dengan tumpukan bersih', async () => {
  await showRoute('/mulai');
  expect(screen.getByText('Halo, saya Nadia, sekretaris AI Anda.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Mulai' }));
  expect(currentRoute()).toBe('/mulai/masuk');

  expect(screen.getByRole('button', { name: 'Masuk' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
  await settle();
  expect(toastNow()?.text).toBe('Kode dikirim lewat WhatsApp.');
  await fireEvent.changeText(screen.getByLabelText('Kode dari WhatsApp'), '123456');
  expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Masuk' }));
  await settle();
  expect(currentRoute()).toBe('/mulai/pilih');

  await fireEvent.press(screen.getByRole('checkbox', { name: 'Usaha' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sambungkan Google Kalender' }));
  expect(toastNow()?.text).toBe('Google Kalender bisa disambungkan dari Terhubung.');
  await settle();
  expect(currentStack()).toEqual(['/']);
  expect(screen.getByText('Selamat pagi, Rina')).toBeOnTheScreen();
});

test('Beranda: kartu persetujuan, sakelar AC, baris agenda, lalu Lihat semua ke Agenda', async () => {
  await showRoute('/');
  await settle();
  expect(screen.getByText('Butuh persetujuan Anda')).toBeOnTheScreen();
  expect(screen.getByText('AC kamar nyala · 24°')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('switch', { name: 'AC kamar' }));
  await settle();
  expect(screen.getByText('AC kamar mati')).toBeOnTheScreen();
  expect(deviceById(sampleState(), MAIN_AC_ID)!.on).toBe(false);

  for (const t of ['Rapat dengan supplier susu', 'Bayar listrik Kedai Dago', 'Jemput Kayla les']) {
    expect(screen.getByText(t)).toBeOnTheScreen();
  }
  await fireEvent.press(screen.getByRole('link', { name: 'Lihat semua' }));
  expect(currentRoute()).toBe('/agenda');
  expect(screen.getByText('Senin, 20 Okt')).toBeOnTheScreen();
});

test('chat: teks dijawab, permintaan AC, pilihan Ya benar, draf Kirim lalu Batalkan, kartu perangkat', async () => {
  await showRoute('/');
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: 'Bicara dengan Nadia' }));
  expect(currentRoute()).toBe('/chat');
  await settle();
  const box = () => screen.getByLabelText('Tulis pesan untuk Nadia');
  const kirimPesan = async (text: string) => {
    await fireEvent.changeText(box(), text);
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim pesan' }));
    await advance(2000);
    await settle();
  };

  await kirimPesan('Halo Nadia');
  expect(screen.getByText('Halo Nadia')).toBeOnTheScreen();
  expect(screen.getByText(/Ini jawaban contoh/)).toBeOnTheScreen();

  // Permintaan AC lewat chat mengubah AC yang sama dengan kartu dan Beranda.
  await kirimPesan('AC kamar 22 derajat');
  expect(screen.getByText('Sudah. AC kamar nyala di 22°.')).toBeOnTheScreen();
  expect(deviceById(sampleState(), MAIN_AC_ID)!.ac!.temp).toBe(22);

  // Kartu perangkat: sakelar di dalam chat mematikan AC.
  await fireEvent.press(screen.getAllByRole('switch', { name: 'AC kamar' })[0]!);
  await settle();
  expect(deviceById(sampleState(), MAIN_AC_ID)!.on).toBe(false);

  // Pilihan: tombol terkunci sesudah dijawab.
  await kirimPesan('Beli token listrik 50 ribu');
  expect(screen.getByText('Rp50.000')).toBeOnTheScreen();
  await fireEvent.press(screen.getAllByRole('button', { name: 'Ya, benar' })[0]!);
  await advance(2000);
  await settle();
  expect(screen.queryByRole('button', { name: 'Batal' })).toBeNull();

  // Draf Pak Budi: Kirim menahan, Batalkan membatalkan.
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
  await settle();
  expect(sampleState().outgoing['o-budi']!.status).toBe('held');
  await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
  await settle();
  expect(sampleState().outgoing['o-budi']!.status).toBe('cancelled');
  expect(screen.getByText('Dibatalkan · tidak jadi terkirim')).toBeOnTheScreen();
});

test('Agenda: Tambah dengan teks yang dirapikan server, tugas dicentang, pengingat ditahan membuka alarm', async () => {
  await showRoute('/agenda');
  await settle();
  const row = (time: string) => screen.getByRole(/button|checkbox/, { name: new RegExp(`^${time}`) });

  await fireEvent.press(screen.getByRole('button', { name: 'Tambah' }));
  expect(currentRoute()).toBe('/agenda/tambah');
  await fireEvent.changeText(
    screen.getByPlaceholderText('Ingatkan saya bayar pajak motor tanggal 25'),
    'Ingatkan saya bayar pajak motor tanggal 25',
  );
  await advance(PREVIEW_DEBOUNCE_MS);
  expect(screen.getByText('Akan saya simpan sebagai')).toBeOnTheScreen();
  expect(screen.getByText('Bayar pajak motor')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
  await settle();
  expect(toastNow()?.text).toBe('Tersimpan di agenda.');
  await advance(300);
  expect(currentRoute()).toBe('/agenda');
  expect(sampleState().agenda.some((a) => a.title === 'Bayar pajak motor')).toBe(true);

  // Tugas dicentang dan dilepas lagi.
  await fireEvent.press(row('15.00'));
  await settle();
  expect(within(row('15.00')).getByTestId('ikon-taskDone')).toBeOnTheScreen();
  await fireEvent.press(row('15.00'));
  await settle();
  expect(within(row('15.00')).getByTestId('ikon-task')).toBeOnTheScreen();

  // Tahan pengingat beralarm: layar alarm untuk dilihat saja.
  await fireEvent(row('16.00'), 'longPress');
  await settle();
  expect(currentRoute()).toBe('/alarm');
  expect(screen.getByText('Jemput Kayla les')).toBeOnTheScreen();
});

test('Perangkat: pilih Rumah, sakelar, rutinitas, detail AC dengan dial, PIN untuk mematikan kamera', async () => {
  const api = createTestApi({ security: { pinEnabled: true, pin: '123456' } });
  await showRoute('/perangkat', { api });
  await settle();

  await fireEvent.press(screen.getByRole('button', { name: 'Tempat: Semua' }));
  await fireEvent.press(await screen.findByRole('radio', { name: 'Rumah' }));
  await advance(300);
  await settle();
  expect(screen.getByRole('tab', { name: 'Ruang tamu' })).toBeSelected();

  // Lampu tanpa PIN langsung berubah.
  await fireEvent.press(screen.getByRole('switch', { name: 'Lampu utama, Nyala · 80%' }));
  await settle();
  expect(screen.getByText('Mati')).toBeOnTheScreen();

  // Rutinitas.
  await fireEvent.press(screen.getByRole('button', { name: 'Jalankan Saya pulang' }));
  await settle();
  expect(toastNow()?.text).toBe('Rutinitas Saya pulang dijalankan.');

  // Detail AC: dial dan tombol suhu.
  await fireEvent.press(screen.getByRole('tab', { name: 'Kamar' }));
  await fireEvent.press(screen.getByRole('button', { name: /^AC kamar, / }));
  await settle();
  expect(currentRoute()).toBe('/perangkat/[id]');
  const dial = screen.getByRole('adjustable', { name: 'Suhu AC kamar' });
  const sendTemp = () =>
    act(async () => {
      jest.advanceTimersByTime(TEMP_DEBOUNCE_MS);
    });
  await fireEvent(dial, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  await sendTemp();
  expect(deviceById(sampleState(), MAIN_AC_ID)!.ac!.temp).toBe(24); // rutinitas Saya pulang tadi memasang 25°
  await fireEvent.press(screen.getByRole('button', { name: 'Turunkan suhu' }));
  await sendTemp();
  await settle();
  expect(deviceById(sampleState(), MAIN_AC_ID)!.ac!.temp).toBe(23);
  await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));
  expect(currentRoute()).toBe('/perangkat');

  // PIN: kamera tidak mati sebelum PIN benar.
  await fireEvent.press(screen.getByRole('tab', { name: 'Ruang tamu' }));
  await fireEvent.press(screen.getByRole('switch', { name: /^Kamera ruang tamu, / }));
  await settle();
  expect(currentRoute()).toBe('/pin');
  expect(screen.getByText('Masukkan PIN')).toBeOnTheScreen();
  await dpad('111111');
  expect(screen.getByText('PIN belum cocok, coba lagi.')).toBeOnTheScreen();
  expect(deviceById(sampleState(), 'kamera-tamu')!.on).toBe(true);
  await dpad('123456');
  expect(deviceById(sampleState(), 'kamera-tamu')!.on).toBe(false);
  await advance(300);
  expect(currentRoute()).toBe('/perangkat');
});

test('Usaha: Pesan lagi membuat draf, Lihat draf membuka chat di kartu itu', async () => {
  await showRoute('/usaha');
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: 'Pesan lagi Susu UHT' }));
  await settle();
  expect(currentRoute()).toBe('/chat');
  expect(screen.getByText('PT Sumber Susu')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));
  await settle();
  expect(currentRoute()).toBe('/usaha');
  await fireEvent.press(await screen.findByRole('button', { name: 'Lihat draf Susu UHT' }));
  await settle();
  expect(currentRoute()).toBe('/chat');
  expect(screen.getByText('PT Sumber Susu')).toBeOnTheScreen();
});

test('Terhubung: sambungkan TikTok, simpul baru di cincin, hapus yang diingat, putuskan', async () => {
  await showRoute('/');
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: '7 terhubung · CCTV tidak terjangkau' }));
  expect(currentRoute()).toBe('/terhubung');
  await fireEvent.press(await screen.findByRole('button', { name: 'Sambungkan TikTok Shop & Tokopedia' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Masuk (contoh)' }));
  await advance(500);
  await advance(250);
  await settle();
  expect(currentRoute()).toBe('/terhubung/tersambung');
  await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
  await settle();
  expect(await screen.findByText('8 terhubung · CCTV tidak terjangkau')).toBeOnTheScreen();
  expect(screen.getByTestId('simpul-tiktok')).toBeOnTheScreen();

  // Moka: lupakan yang diingat, lalu putuskan.
  await go('/terhubung');
  await settle();
  await fireEvent.press(await screen.findByRole('button', { name: /^Moka\./ }));
  await settle();
  await fireEvent.press(await screen.findByRole('button', { name: /^Hapus yang Nadia tahu dari layanan ini/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Ya, hapus' }));
  await advance(300);
  await settle();
  expect(toastNow()?.text).toBe('Yang Nadia pelajari dari Moka sudah dihapus.');
  await fireEvent.press(await screen.findByRole('button', { name: 'Putuskan' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Ya, putuskan' }));
  await advance(300);
  await settle();
  expect(toastNow()?.text).toBe('Moka diputuskan.');
  expect(sampleState().services.some((s) => s.id === 'moka')).toBe(false);
  expect(currentRoute()).toBe('/terhubung');
});

test('Riwayat: entri dari kiriman tampil dengan hitung mundur dan Batalkan mencoretnya', async () => {
  await showRoute('/chat');
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
  await settle();
  await go('/riwayat');
  await settle();
  expect(screen.getByText('Mengirim balasan ke Pak Budi')).toBeOnTheScreen();
  expect(screen.getByText(/^sisa [45]:\d\d$/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
  await settle();
  expect(screen.getByText('Kiriman dibatalkan.')).toBeOnTheScreen();
  expect(screen.getByText('Mengirim balasan ke Pak Budi')).toHaveStyle({ textDecorationLine: 'line-through' });
});

test('Akun: ganti nama asisten mengubah Beranda dan chat; notifikasi, HP, privasi terbuka', async () => {
  await showRoute('/');
  await settle();
  await go('/akun');
  await settle();
  expect(screen.getByText('Rina Wulandari')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: /^Nama dan gaya asisten/ }));
  await settle();
  expect(currentRoute()).toBe('/akun/asisten');
  await fireEvent.changeText(screen.getByLabelText('Nama asisten'), 'Sari');
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
  await settle();
  expect(toastNow()?.text).toBe('Tersimpan. Sekarang saya Sari.');
  expect(currentRoute()).toBe('/akun');
  expect(screen.getByRole('button', { name: /^Privasi\. Lihat dan hapus yang Sari tahu/ })).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: /^Notifikasi/ }));
  await settle();
  expect(currentRoute()).toBe('/akun/notifikasi');
  await fireEvent.press(screen.getByRole('switch', { name: 'Rumah' }));
  await settle();
  expect(screen.getByRole('switch', { name: 'Rumah' })).not.toBeChecked();
  await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));

  await fireEvent.press(screen.getByRole('button', { name: /^HP yang terhubung/ }));
  await settle();
  expect(currentRoute()).toBe('/akun/hp');
  expect(screen.getByRole('button', { name: 'Keluarkan Galaxy A54' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));

  await fireEvent.press(screen.getByRole('button', { name: /^Privasi/ }));
  await settle();
  expect(currentRoute()).toBe('/akun/privasi');
  expect(screen.getByRole('button', { name: 'Hapus yang Sari tahu dari Moka' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));

  // Nama baru sampai ke Beranda dan chat.
  await go('/');
  await settle();
  expect(screen.getByRole('button', { name: 'Bicara dengan Sari' })).toBeOnTheScreen();
  await go('/chat');
  await settle();
  expect(screen.getByLabelText('Tulis pesan untuk Sari')).toBeOnTheScreen();
});

test('Mode Suara: tahan Inti, ucapan menjadi teks, balasan, lalu Selesai; lalu Keluar kembali ke layar pertama', async () => {
  await showRoute('/');
  await settle();
  await fireEvent(screen.getByRole('button', { name: 'Bicara dengan Nadia' }), 'longPress');
  expect(currentRoute()).toBe('/suara');
  const inti = screen.getByRole('button', { name: 'Tahan untuk bicara' });
  await fireEvent(inti, 'pressIn');
  await advance(1);
  for (let i = 0; i < 6; i++) await act(async () => audio.emitBuffer(new Array<number>(1600).fill(9000)));
  await fireEvent(inti, 'pressOut');
  await advance(1);
  expect(screen.getByTestId('suara-ucapan')).toHaveTextContent('Matikan AC kamar.');
  await advance(THINK_MS);
  expect(screen.getByTestId('suara-balasan')).toHaveTextContent('Sudah. AC kamar saya matikan.');
  await advance(4500);
  await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
  expect(currentRoute()).toBe('/');
  expect(screen.getByText('AC kamar mati')).toBeOnTheScreen();

  // Keluar: konfirmasi, lalu kembali ke layar pertama dengan tumpukan bersih.
  await go('/akun');
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: 'Keluar' }));
  await settle();
  expect(currentRoute()).toBe('/keluar');
  await fireEvent.press(screen.getByRole('button', { name: 'Keluar' }));
  await advance(300);
  await settle();
  expect(router.dismissAll).toHaveBeenCalled();
  expect(currentRoute()).toBe('/mulai');
});
