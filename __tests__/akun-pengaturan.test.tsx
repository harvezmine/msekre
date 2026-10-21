import { act, fireEvent, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { ERASE_TEXT, PRIVACY_URL, RENEW_TEXT, WA_UNAVAILABLE_TEXT } from '@/api/account';
import { ERROR_TEXT, INVALID_NAME_TEXT } from '@/api/errors';
import { waUrl } from '@/api/waNumber';
import { dark } from '@/theme/tokens';
import { advance, currentRoute, currentStack, go, mockParams, restoreParams, sampleState, showRoute } from './harness';
import { createTestApi, toastNow } from './helpers';

const WA = '6281110003333';
const config = Constants.expoConfig as { extra?: Record<string, unknown> };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams();
  config.extra = { waNumber: WA };
});
afterEach(() => {
  delete config.extra;
  jest.restoreAllMocks();
});
afterAll(restoreParams);

async function settle() {
  for (let i = 0; i < 3; i++) await advance(0);
}
async function show(start: string, options: Parameters<typeof showRoute>[1] = {}) {
  const api = (options.api ?? createTestApi()) as ReturnType<typeof createTestApi>;
  await showRoute(start, { ...options, api });
  await settle();
  return api;
}

describe('Nama dan gaya asisten', () => {
  test('nama terisi, contoh sapaan hidup, gaya dengan contoh kalimat', async () => {
    await show('/akun/asisten');
    const field = screen.getByLabelText('Nama asisten');
    expect(field.props.value).toBe('Nadia');
    expect(screen.getByText('Halo, saya Nadia.')).toBeOnTheScreen();
    await fireEvent.changeText(field, 'Sari');
    expect(screen.getByText('Halo, saya Sari.')).toBeOnTheScreen();
    for (const title of ['Singkat', 'Ramah', 'Formal']) {
      expect(screen.getByRole('radio', { name: title })).toBeOnTheScreen();
    }
    expect(screen.getByRole('radio', { name: 'Ramah' })).toBeChecked();
    expect(screen.getByText(/Rapat jam 9\. Sudah saya ingatkan\./)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeEnabled();
  });

  test('nama bukan 2-20 huruf: kalimat ramah dan Simpan mati, tanpa permintaan', async () => {
    const api = await show('/akun/asisten');
    const spy = jest.spyOn(api.transport, 'setAssistant');
    const field = screen.getByLabelText('Nama asisten');
    for (const bad of ['S', 'Sari 2', 'Siti Nur', '!!']) {
      await fireEvent.changeText(field, bad);
      expect(screen.getByText(INVALID_NAME_TEXT)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
    }
    await fireEvent.changeText(field, '');
    expect(screen.queryByText(INVALID_NAME_TEXT)).toBeNull();
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
    expect(spy).not.toHaveBeenCalled();
  });

  test('tanpa perubahan Simpan mati; hanya gaya yang diubah: hanya gaya yang dikirim', async () => {
    const api = await show('/akun/asisten');
    const spy = jest.spyOn(api.transport, 'setAssistant');
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Formal' }));
    expect(screen.getByRole('radio', { name: 'Formal' })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
    await settle();
    expect(spy).toHaveBeenCalledWith({ style: 'formal' });
    expect((await api.transport.account()).assistant.style).toBe('formal');
  });

  test('ganti nama dari Beranda: tersimpan, kembali, dan nama baru ada di mana-mana', async () => {
    const api = await show('/');
    expect(screen.getByRole('button', { name: 'Bicara dengan Nadia' })).toBeOnTheScreen();
    await go('/akun/asisten');
    await settle();
    await fireEvent.changeText(screen.getByLabelText('Nama asisten'), ' Sari ');
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
    await settle();
    expect(toastNow()?.text).toBe('Tersimpan. Sekarang saya Sari.');
    expect(router.back).toHaveBeenCalled();
    expect(currentRoute()).toBe('/');
    expect(screen.getByRole('button', { name: 'Bicara dengan Sari' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Bicara dengan Nadia' })).toBeNull();
    expect((await api.transport.me()).assistantName).toBe('Sari');
    // Chat memakai nama yang sama.
    await go('/chat');
    await settle();
    expect(screen.getByLabelText('Tulis pesan untuk Sari')).toBeOnTheScreen();
  });

  test('server menolak: kalimat ramah di bawah kolom, nama lama tetap', async () => {
    const api = await show('/akun/asisten');
    await fireEvent.changeText(screen.getByLabelText('Nama asisten'), 'Sari');
    api.transport.failNext('network');
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
    await settle();
    expect(screen.getByText(ERROR_TEXT)).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
    expect((await api.transport.me()).assistantName).toBe('Nadia');
    // Mengetik lagi menghapus kalimat gagal.
    await fireEvent.changeText(screen.getByLabelText('Nama asisten'), 'Sar');
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
  });

  test('Akun belum terbaca: "Sebentar ya"; gagal: Coba lagi', async () => {
    const api = createTestApi();
    api.transport.failNext('network');
    await show('/akun/asisten', { api });
    expect(screen.getByText(ERROR_TEXT)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
    await settle();
    expect(screen.getByLabelText('Nama asisten').props.value).toBe('Nadia');
  });

  test('mode gelap', async () => {
    await show('/akun/asisten', { scheme: 'dark' });
    expect(screen.getByText('Halo, saya Nadia.')).toBeOnTheScreen();
    expect(screen.getByText('Gaya bicara')).toHaveStyle({ color: dark.text });
  });
});

describe('Sapaan harian', () => {
  test('hidup bawaan dengan jam; catatan pengingat tetap dikirim', async () => {
    await show('/akun/sapaan');
    expect(screen.getByRole('switch', { name: 'Sapa saya tiap pagi' })).toBeChecked();
    expect(screen.getByRole('button', { name: '07.00' })).toBeSelected();
    expect(screen.getByText(/Pengingat tetap dikirim walau sapaan dimatikan\./)).toBeOnTheScreen();
  });

  test('pilih jam, lalu matikan: jam hilang, pengingat tidak disebut mati', async () => {
    const api = await show('/akun/sapaan');
    await fireEvent.press(screen.getByRole('button', { name: '08.00' }));
    await settle();
    expect(screen.getByRole('button', { name: '08.00' })).toBeSelected();
    expect((await api.transport.account()).greeting).toEqual({ daily: true, time: '08.00' });
    await fireEvent.press(screen.getByRole('switch', { name: 'Sapa saya tiap pagi' }));
    await settle();
    expect(screen.getByRole('switch', { name: 'Sapa saya tiap pagi' })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: '08.00' })).toBeNull();
    expect((await api.transport.account()).greeting.daily).toBe(false);
    // Dihidupkan lagi: jam terakhir kembali.
    await fireEvent.press(screen.getByRole('switch', { name: 'Sapa saya tiap pagi' }));
    await settle();
    expect(screen.getByRole('button', { name: '08.00' })).toBeSelected();
  });

  test('gagal: saklar kembali dan ada toast', async () => {
    const api = await show('/akun/sapaan');
    api.transport.failNext('network');
    await fireEvent.press(screen.getByRole('switch', { name: 'Sapa saya tiap pagi' }));
    await settle();
    expect(screen.getByRole('switch', { name: 'Sapa saya tiap pagi' })).toBeChecked();
    expect(toastNow()?.text).toBe(ERROR_TEXT);
  });

  test('jam di luar pilihan (diatur dari tempat lain) tetap tampil dan terpilih', async () => {
    const api = await show('/akun/sapaan');
    await act(async () => {
      await api.transport.setGreeting({ daily: true, time: '05.30' });
    });
    await settle();
    expect(screen.getByRole('button', { name: '05.30' })).toBeSelected();
  });
});

describe('Notifikasi', () => {
  test('izin dari HP dan saklar per jenis; semuanya hidup bawaan', async () => {
    await show('/akun/notifikasi');
    expect(screen.getByRole('button', { name: /^Izin notifikasi/ })).toBeOnTheScreen();
    for (const title of ['Pesan dari asisten', 'Pengingat', 'Ringkasan harian', 'Rumah', 'Usaha']) {
      expect(screen.getByRole('switch', { name: title })).toBeChecked();
    }
    expect(screen.queryByRole('button', { name: /^Alarm tepat waktu/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Izin notifikasi/ }));
    expect(router.push).toHaveBeenCalledWith('/izin-notifikasi');
  });

  test('mematikan satu jenis dikirim ke server dan bertahan', async () => {
    const api = await show('/akun/notifikasi');
    const spy = jest.spyOn(api.transport, 'setNotifications');
    await fireEvent.press(screen.getByRole('switch', { name: 'Rumah' }));
    await settle();
    expect(spy).toHaveBeenCalledWith({ rumah: false });
    expect(screen.getByRole('switch', { name: 'Rumah' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Usaha' })).toBeChecked();
    expect((await api.transport.account()).notifications.rumah).toBe(false);
  });

  test('gagal: saklar kembali dan toast ramah', async () => {
    const api = await show('/akun/notifikasi');
    api.transport.failNext('server');
    await fireEvent.press(screen.getByRole('switch', { name: 'Pesan dari asisten' }));
    await settle();
    expect(screen.getByRole('switch', { name: 'Pesan dari asisten' })).toBeChecked();
    expect(toastNow()?.text).toBe(ERROR_TEXT);
    expect((await api.transport.account()).notifications.pesan).toBe(true);
  });
});

describe('HP yang terhubung', () => {
  test('daftar dengan lencana HP ini; HP ini tanpa Keluarkan', async () => {
    await show('/akun/hp');
    expect(screen.getByText('Pixel 8 (HP ini)')).toBeOnTheScreen();
    expect(screen.getByText('HP ini')).toBeOnTheScreen();
    expect(screen.getByText('Galaxy A54')).toBeOnTheScreen();
    expect(screen.getByText(/^Terakhir dipakai \d+ hari lalu$/)).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^Keluarkan/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Keluarkan Galaxy A54' })).toBeOnTheScreen();
  });

  test('Keluarkan: lembar konfirmasi, lalu HP itu hilang dari daftar dan tercatat di server', async () => {
    const api = await show('/akun/hp');
    await fireEvent.press(screen.getByRole('button', { name: 'Keluarkan Galaxy A54' }));
    expect(router.push).toHaveBeenCalledWith('/akun/konfirmasi?aksi=hp&id=hp-lama');
    expect(currentRoute()).toBe('/akun/konfirmasi');
    expect(await screen.findByText('Keluarkan Galaxy A54?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ya, keluarkan' }));
    await advance(300);
    await settle();
    expect(api.transport.removedPhones).toEqual(['hp-lama']);
    expect(toastNow()?.text).toBe('Galaxy A54 dikeluarkan.');
    expect(router.back).toHaveBeenCalled();
    expect(currentStack()).toEqual(['/akun/hp']);
    expect(screen.queryByText('Galaxy A54')).toBeNull();
  });

  test('Batal tidak mengeluarkan siapa pun; gagal: toast ramah dan HP tetap', async () => {
    const api = await show('/akun/hp');
    await fireEvent.press(screen.getByRole('button', { name: 'Keluarkan Galaxy A54' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Batal' }));
    await advance(300);
    expect(api.transport.removedPhones).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Keluarkan Galaxy A54' }));
    api.transport.failNext('network');
    await fireEvent.press(await screen.findByRole('button', { name: 'Ya, keluarkan' }));
    await advance(300);
    await settle();
    expect(toastNow()?.text).toBe(ERROR_TEXT);
    expect(screen.getByText('Galaxy A54')).toBeOnTheScreen();
  });

  test('HP ini tidak bisa dikeluarkan lewat lembar konfirmasi', async () => {
    await show('/akun/konfirmasi?aksi=hp&id=hp-ini');
    expect(await screen.findByText('HP ini tidak ditemukan.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ya, keluarkan' })).toBeNull();
  });
});

describe('Privasi', () => {
  test('jumlah yang diingat per layanan, catatan hapus akun, dan kebijakan', async () => {
    await show('/akun/privasi');
    expect(screen.getByText('Yang Nadia tahu, per layanan')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Hapus yang Nadia tahu dari Moka' })).toBeOnTheScreen();
    expect(screen.getByText('48 hal diingat')).toBeOnTheScreen();
    expect(screen.getByText('Untuk menghapus akun, kirim pesan ke Nadia di WhatsApp.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Hapus akun$/ })).toBeNull();
  });

  test('hapus per layanan memakai alur Terhubung; jumlahnya jadi nol dan tombolnya mati', async () => {
    await show('/akun/privasi');
    await fireEvent.press(screen.getByRole('button', { name: 'Hapus yang Nadia tahu dari Moka' }));
    expect(router.push).toHaveBeenCalledWith('/terhubung/konfirmasi?id=moka&aksi=lupa');
    expect(await screen.findByText('Hapus yang Nadia pelajari dari Moka?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ya, hapus' }));
    await advance(300);
    await settle();
    expect(sampleState().forgotten).toContain('moka');
    expect(currentRoute()).toBe('/akun/privasi');
    expect(screen.getByText('Tidak ada yang diingat')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Hapus yang Nadia tahu dari Moka' })).toBeDisabled();
    // Layanan lain tidak ikut terhapus.
    expect(screen.getByRole('button', { name: 'Hapus yang Nadia tahu dari Google Kalender' })).toBeEnabled();
  });

  test('hapus akun lewat WhatsApp; tanpa nomor: kalimat ramah', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(async () => {});
    await show('/akun/privasi');
    await fireEvent.press(screen.getByRole('button', { name: 'Buka WhatsApp' }));
    expect(open).toHaveBeenCalledWith(waUrl(WA, ERASE_TEXT));
    delete config.extra;
    await fireEvent.press(screen.getByRole('button', { name: 'Buka WhatsApp' }));
    expect(toastNow()?.text).toBe(WA_UNAVAILABLE_TEXT);
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('kebijakan privasi dibuka di peramban; gagal membuka: toast', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(async () => {});
    await show('/akun/privasi');
    await fireEvent.press(screen.getByRole('link', { name: 'Baca kebijakan privasi' }));
    expect(open).toHaveBeenCalledWith(PRIVACY_URL);
    open.mockRejectedValueOnce(new Error('tidak ada peramban'));
    await fireEvent.press(screen.getByRole('link', { name: 'Baca kebijakan privasi' }));
    await settle();
    expect(toastNow()?.text).toMatch(/kebijakan privasi belum bisa dibuka/);
  });
});

describe('Langganan di Akun', () => {
  const soon = (days: number) => new Date(Date.now() + days * 86_400_000 - 60_000).toISOString();

  test.each([
    [{ name: 'Coba', status: 'trial' as const, until: soon(5) }, 'Paket Coba', 'Coba gratis, tersisa 5 hari'],
    [{ name: 'Bisnis', status: 'berakhir' as const, until: soon(-3) }, 'Paket Bisnis', 'Sudah berakhir'],
    [
      { name: 'Bisnis', status: 'aktif' as const, until: '2027-01-12T05:00:00Z' },
      'Paket Bisnis',
      'Aktif sampai 12 Jan 2027',
    ],
  ])('paket %# menulis keadaannya', async (plan, title, text) => {
    await show('/akun', { api: createTestApi({ plan }) });
    expect(screen.getByText(title)).toBeOnTheScreen();
    expect(screen.getByText(text)).toBeOnTheScreen();
  });

  test('Perpanjang membuka WhatsApp dengan kalimat siap kirim; tanpa nomor: toast', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(async () => {});
    await show('/akun', { api: createTestApi({ plan: { status: 'berakhir' } }) });
    await fireEvent.press(screen.getByRole('button', { name: 'Perpanjang' }));
    expect(open).toHaveBeenCalledWith(waUrl(WA, RENEW_TEXT));
    delete config.extra;
    await fireEvent.press(screen.getByRole('button', { name: 'Perpanjang' }));
    expect(toastNow()?.text).toBe(WA_UNAVAILABLE_TEXT);
  });

  test('Bantuan (mode server) membuka WhatsApp untuk melapor kendala; tanpa nomor: toast, tanpa menyebut fase', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(async () => {});
    await show('/akun', { api: createTestApi({ mode: 'server', token: 'tok' }) });
    await fireEvent.press(screen.getByRole('button', { name: /^Bantuan/ }));
    expect(open).toHaveBeenCalledWith(`https://wa.me/${WA}?text=Halo%2C%20saya%20mau%20lapor%20kendala.`);
    delete config.extra;
    await fireEvent.press(screen.getByRole('button', { name: /^Bantuan/ }));
    expect(toastNow()?.text).toBe(WA_UNAVAILABLE_TEXT);
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('nama asisten yang baru ikut ke baris Akun', async () => {
    const api = await show('/akun');
    await act(async () => {
      await api.transport.setAssistant({ name: 'Sari', style: 'singkat' });
    });
    await settle();
    expect(screen.getByRole('button', { name: 'Nama dan gaya asisten. Sari · singkat' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Privasi\. Lihat dan hapus yang Sari tahu/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Riwayat. Semua yang sudah Sari kerjakan' })).toBeOnTheScreen();
  });
});
