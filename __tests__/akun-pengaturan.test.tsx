import { act, fireEvent, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { ERASE_TEXT, PRIVACY_URL, RENEW_TEXT, WA_UNAVAILABLE_TEXT } from '@/api/account';
import { ERROR_TEXT, INVALID_NAME_TEXT } from '@/api/errors';
import { waUrl } from '@/api/waNumber';
import { getSoundSettings, setSoundSettings, SoundSettingsStore } from '@/reminders/soundSettings';
import { newUserSampleState } from '@/sample/fresh';
import { dark, markerLight } from '@/theme/tokens';
import {
  advance,
  currentRoute,
  currentStack,
  go,
  mockParams,
  restoreParams,
  ROUTES,
  sampleState,
  showRoute,
} from './harness';
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

describe('Asisten: nama, gaya bicara, dan sapaan pagi di satu halaman', () => {
  test('nama terisi; gaya sebagai segmen dengan satu contoh kalimat; Simpan hanya saat nama diubah', async () => {
    await show('/akun/asisten');
    expect(screen.getByRole('header', { name: 'Asisten' })).toBeOnTheScreen();
    const field = screen.getByLabelText('Nama asisten');
    expect(field.props.value).toBe('Nadia');
    expect(screen.queryByRole('button', { name: 'Simpan' })).toBeNull();
    for (const title of ['Singkat', 'Ramah', 'Formal']) {
      expect(screen.getByRole('tab', { name: title })).toBeOnTheScreen();
    }
    expect(screen.getByRole('tab', { name: 'Ramah' })).toBeSelected();
    expect(screen.getByText(/Siap, Kak! Besok jam 9 ada rapat/)).toBeOnTheScreen();
    // Satu contoh kalimat saja, untuk gaya yang terpilih.
    expect(screen.queryByText(/Rapat jam 9\. Sudah saya ingatkan\./)).toBeNull();
    await fireEvent.changeText(field, 'Sari');
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Sapaan pagi' })).toBeOnTheScreen();
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
    await fireEvent(field, 'submitEditing');
    expect(spy).not.toHaveBeenCalled();
  });

  test('gaya berlaku seketika: hanya gaya yang dikirim, contoh kalimat ikut berganti', async () => {
    const api = await show('/akun/asisten');
    const spy = jest.spyOn(api.transport, 'setAssistant');
    await fireEvent.press(screen.getByRole('tab', { name: 'Singkat' }));
    await settle();
    expect(spy).toHaveBeenCalledWith({ style: 'singkat' });
    expect(screen.getByRole('tab', { name: 'Singkat' })).toBeSelected();
    expect(screen.getByText(/Rapat jam 9\. Sudah saya ingatkan\./)).toBeOnTheScreen();
    expect((await api.transport.account()).assistant.style).toBe('singkat');
  });

  test('gaya ditolak server: pilihan kembali dan toast ramah', async () => {
    const api = await show('/akun/asisten');
    api.transport.failNext('network');
    await fireEvent.press(screen.getByRole('tab', { name: 'Formal' }));
    await settle();
    expect(screen.getByRole('tab', { name: 'Ramah' })).toBeSelected();
    expect(toastNow()?.text).toBe(ERROR_TEXT);
    expect((await api.transport.account()).assistant.style).toBe('ramah');
  });

  test('ganti nama dari Beranda: tersimpan di tempat, lalu nama baru ada di mana-mana', async () => {
    const api = await show('/');
    expect(screen.getByRole('button', { name: 'Nadia' })).toBeOnTheScreen();
    await go('/akun/asisten');
    await settle();
    await fireEvent.changeText(screen.getByLabelText('Nama asisten'), ' Sari ');
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
    await settle();
    expect(toastNow()?.text).toBe('Tersimpan. Sekarang saya Sari.');
    // Tetap di halaman Asisten (gaya dan sapaan ada di sini juga); Simpan hilang lagi.
    expect(currentRoute()).toBe('/akun/asisten');
    expect(screen.getByLabelText('Nama asisten').props.value).toBe('Sari');
    expect(screen.queryByRole('button', { name: 'Simpan' })).toBeNull();
    expect((await api.transport.me()).assistantName).toBe('Sari');
    await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));
    expect(currentRoute()).toBe('/');
    expect(screen.getByRole('button', { name: 'Sari' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Nadia' })).toBeNull();
    // Chat memakai nama yang sama.
    await go('/chat');
    await settle();
    expect(screen.getByLabelText('Tulis pesan untuk Sari')).toBeOnTheScreen();
  });

  test('Simpan lewat tombol selesai di papan ketik', async () => {
    const api = await show('/akun/asisten');
    await fireEvent.changeText(screen.getByLabelText('Nama asisten'), 'Dewi');
    await fireEvent(screen.getByLabelText('Nama asisten'), 'submitEditing');
    await settle();
    expect((await api.transport.me()).assistantName).toBe('Dewi');
  });

  test('server menolak: kalimat ramah di bawah kolom, nama lama tetap', async () => {
    const api = await show('/akun/asisten');
    await fireEvent.changeText(screen.getByLabelText('Nama asisten'), 'Sari');
    api.transport.failNext('network');
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
    await settle();
    expect(screen.getByText(ERROR_TEXT)).toBeOnTheScreen();
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
    expect(screen.getByText('Gaya bicara')).toHaveStyle({ color: dark.text });
    expect(screen.getByText('Sapaan pagi')).toHaveStyle({ color: dark.text });
  });

  test('sapaan pagi hidup bawaan dengan jam, tanpa kalimat keterangan', async () => {
    await show('/akun/asisten');
    expect(screen.getByRole('switch', { name: 'Sapaan pagi' })).toBeChecked();
    expect(screen.getByRole('button', { name: '07.00' })).toBeSelected();
    expect(screen.queryByText(/Pengingat tetap dikirim/)).toBeNull();
  });

  test('pilih jam, lalu matikan sapaan: jam hilang; hidupkan lagi: jam terakhir kembali', async () => {
    const api = await show('/akun/asisten');
    await fireEvent.press(screen.getByRole('button', { name: '08.00' }));
    await settle();
    expect(screen.getByRole('button', { name: '08.00' })).toBeSelected();
    expect((await api.transport.account()).greeting).toEqual({ daily: true, time: '08.00' });
    await fireEvent.press(screen.getByRole('switch', { name: 'Sapaan pagi' }));
    await settle();
    expect(screen.getByRole('switch', { name: 'Sapaan pagi' })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: '08.00' })).toBeNull();
    expect((await api.transport.account()).greeting.daily).toBe(false);
    await fireEvent.press(screen.getByRole('switch', { name: 'Sapaan pagi' }));
    await settle();
    expect(screen.getByRole('button', { name: '08.00' })).toBeSelected();
  });

  test('sapaan gagal disimpan: sakelar kembali dan ada toast', async () => {
    const api = await show('/akun/asisten');
    api.transport.failNext('network');
    await fireEvent.press(screen.getByRole('switch', { name: 'Sapaan pagi' }));
    await settle();
    expect(screen.getByRole('switch', { name: 'Sapaan pagi' })).toBeChecked();
    expect(toastNow()?.text).toBe(ERROR_TEXT);
  });

  test('jam sapaan di luar pilihan (diatur dari tempat lain) tetap tampil dan terpilih', async () => {
    const api = await show('/akun/asisten');
    await act(async () => {
      await api.transport.setGreeting({ daily: true, time: '05.30' });
    });
    await settle();
    expect(screen.getByRole('button', { name: '05.30' })).toBeSelected();
  });
});

describe('Pemberitahuan: izin HP, alarm, dan jenis kabar di satu halaman', () => {
  test('izin HP belum ada: baris membuka lembar izin; jenis kabar sebagai sakelar, semuanya hidup bawaan', async () => {
    await show('/akun/notifikasi');
    expect(screen.getByRole('header', { name: 'Pemberitahuan' })).toBeOnTheScreen();
    for (const title of ['Pesan', 'Pengingat', 'Ringkasan harian', 'Rumah', 'Usaha']) {
      expect(screen.getByRole('switch', { name: title })).toBeChecked();
    }
    // Tanpa alarm native (jest): tidak ada baris alarm.
    expect(screen.queryByRole('button', { name: /^Alarm/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Izin HP. Perlu izin' }));
    expect(router.push).toHaveBeenCalledWith('/izin-notifikasi');
    // Tanpa kalimat keterangan.
    expect(screen.queryByText(/Alarm yang sudah dijadwalkan|Balasan dan hal|Kabar yang dikirim/)).toBeNull();
  });

  test('pengguna baru tanpa perangkat dan usaha: hanya Pesan, Pengingat, dan Ringkasan harian', async () => {
    await show('/akun/notifikasi', { api: createTestApi({ sample: newUserSampleState }) });
    expect(screen.getByRole('switch', { name: 'Pesan' })).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Ringkasan harian' })).toBeOnTheScreen();
    expect(screen.queryByRole('switch', { name: 'Rumah' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Usaha' })).toBeNull();
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

  test('gagal: sakelar kembali dan toast ramah', async () => {
    const api = await show('/akun/notifikasi');
    api.transport.failNext('server');
    await fireEvent.press(screen.getByRole('switch', { name: 'Pesan' }));
    await settle();
    expect(screen.getByRole('switch', { name: 'Pesan' })).toBeChecked();
    expect(toastNow()?.text).toBe(ERROR_TEXT);
    expect((await api.transport.account()).notifications.pesan).toBe(true);
  });

  test('Getar: pilihan di HP ini saja (tidak ke server), hidup bawaan', async () => {
    setSoundSettings(new SoundSettingsStore(false));
    try {
      const api = await show('/akun/notifikasi');
      const spy = jest.spyOn(api.transport, 'setNotifications');
      expect(screen.getByRole('switch', { name: 'Getar' })).toBeChecked();
      await fireEvent.press(screen.getByRole('switch', { name: 'Getar' }));
      await settle();
      expect(screen.getByRole('switch', { name: 'Getar' })).not.toBeChecked();
      expect(getSoundSettings().get().vibrate).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      setSoundSettings(null);
    }
  });

  test('semua jenis dimatikan: baris Akun menyebut Mati (setelah izin HP ada, lihat tes push)', async () => {
    const api = await show('/akun/notifikasi');
    for (const title of ['Pesan', 'Pengingat', 'Ringkasan harian', 'Rumah', 'Usaha']) {
      await fireEvent.press(screen.getByRole('switch', { name: title }));
      await settle();
    }
    expect(Object.values((await api.transport.account()).notifications).every((v) => !v)).toBe(true);
  });
});

describe('Keamanan: HP yang terhubung dan privasi', () => {
  test('Keluarkan: lembar konfirmasi, lalu HP itu hilang dari daftar dan tercatat di server', async () => {
    const api = await show('/akun/keamanan');
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
    expect(currentStack()).toEqual(['/akun/keamanan']);
    expect(screen.queryByText('Galaxy A54')).toBeNull();
    expect(screen.getByText('Pixel 8')).toBeOnTheScreen();
  });

  test('Batal tidak mengeluarkan siapa pun; gagal: toast ramah dan HP tetap', async () => {
    const api = await show('/akun/keamanan');
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

  test('hapus per layanan memakai alur Terhubung; jumlahnya jadi nol dan tombolnya hilang', async () => {
    await show('/akun/keamanan');
    expect(screen.getByText('48 hal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Hapus yang Nadia tahu dari Moka. 48 hal' }));
    expect(router.push).toHaveBeenCalledWith('/terhubung/konfirmasi?id=moka&aksi=lupa');
    expect(await screen.findByText('Hapus yang Nadia pelajari dari Moka?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ya, hapus' }));
    await advance(300);
    await settle();
    expect(sampleState().forgotten).toContain('moka');
    expect(currentRoute()).toBe('/akun/keamanan');
    expect(screen.getByText('0 hal')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Hapus yang Nadia tahu dari Moka/ })).toBeNull();
    // Layanan lain tidak ikut terhapus.
    expect(
      screen.getByRole('button', { name: /^Hapus yang Nadia tahu dari Google Kalender\. \d+ hal$/ }),
    ).toBeEnabled();
  });

  test('hapus akun lewat WhatsApp; tanpa nomor: kalimat ramah', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(async () => {});
    await show('/akun/keamanan');
    await fireEvent.press(screen.getByRole('button', { name: 'Hapus akun. WhatsApp' }));
    expect(open).toHaveBeenCalledWith(waUrl(WA, ERASE_TEXT));
    delete config.extra;
    await fireEvent.press(screen.getByRole('button', { name: 'Hapus akun. WhatsApp' }));
    expect(toastNow()?.text).toBe(WA_UNAVAILABLE_TEXT);
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('kebijakan privasi dibuka di peramban; gagal membuka: toast', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(async () => {});
    await show('/akun/keamanan');
    await fireEvent.press(screen.getByRole('link', { name: 'Kebijakan privasi' }));
    expect(open).toHaveBeenCalledWith(PRIVACY_URL);
    open.mockRejectedValueOnce(new Error('tidak ada peramban'));
    await fireEvent.press(screen.getByRole('link', { name: 'Kebijakan privasi' }));
    await settle();
    expect(toastNow()?.text).toMatch(/kebijakan privasi belum bisa dibuka/);
  });
});

describe('rute lama Akun', () => {
  test('halaman yang digabung tidak ada lagi', () => {
    for (const old of ['/akun/sapaan', '/akun/tampilan', '/akun/hp', '/akun/privasi']) {
      expect(Object.keys(ROUTES)).not.toContain(old);
    }
  });
});

describe('Langganan di Akun', () => {
  const soon = (days: number) => new Date(Date.now() + days * 86_400_000 - 60_000).toISOString();

  test.each([
    [{ name: 'Coba', status: 'trial' as const, until: soon(5) }, 'Coba gratis · 5 hari', 5],
    [{ name: 'Coba', status: 'trial' as const, until: soon(0) }, 'Coba gratis · hari terakhir', 1],
    [{ name: 'Bisnis', status: 'berakhir' as const, until: soon(-3) }, 'Sudah berakhir', null],
    [{ name: 'Bisnis', status: 'aktif' as const, until: '2027-01-12T05:00:00Z' }, /^Aktif sampai 12 Jan/, null],
  ])('paket %# menulis keadaannya dalam satu baris, batang hari hanya di masa coba', async (plan, text, left) => {
    await show('/akun', { api: createTestApi({ plan }) });
    expect(screen.getByText(text)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Perpanjang' })).toBeOnTheScreen();
    const hidden = { includeHiddenElements: true };
    if (left === null) {
      expect(screen.queryByTestId('batang-hari', hidden)).toBeNull();
    } else {
      expect(screen.getAllByTestId('ruas-sisa', hidden)).toHaveLength(left);
      expect(screen.getAllByTestId('ruas-lewat', hidden)).toHaveLength(7 - left);
    }
  });

  test('paket berakhir ditulis dengan warna peringatan', async () => {
    await show('/akun', { api: createTestApi({ plan: { status: 'berakhir' } }) });
    expect(screen.getByText('Sudah berakhir')).toHaveStyle({ color: markerLight.warn.ink });
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
    expect(screen.getByRole('button', { name: 'Asisten. Sari' })).toBeOnTheScreen();
  });
});
