import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { AccessibilityInfo, AppState, Linking, Text, TextInput } from 'react-native';
import { canOpen, routeKind, type RouteKind } from '@/api/routeAccess';
import { ERROR_TEXT, NOT_REGISTERED_TEXT, WRONG_CODE_TEXT } from '@/api/errors';
import { FAKE_WA_NUMBER } from '@/api/fake/FakeTransport';
import { readWaNumber, waStartUrl } from '@/api/waNumber';
import { ApiFailure } from '@/api/transport';
import { useAuth, type AuthStatus } from '@/api/useAuth';
import { TabBar } from '@/ui/TabBar';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import Beranda from '../app/(tabs)/index';
import Chat from '../app/chat';
import Akun from '../app/akun';
import Mode from '../app/mode';
import Masuk from '../app/mulai/masuk';
import { currentRoute, currentStack, go, mockParams, restoreParams, showRoute } from './harness';
import { createTestApi, renderWithProviders } from './helpers';

beforeEach(() => jest.clearAllMocks());

const PHONE = '6281220457781';

async function signIn(code = '123456') {
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
  await fireEvent.changeText(screen.getByLabelText('Kode dari WhatsApp'), code);
  await fireEvent.press(screen.getByRole('button', { name: 'Masuk' }));
}

/** Menampilkan status masuk dan memberi tombol untuk memuat ulang `me`. */
function AuthProbe() {
  const { status, me, refreshMe } = useAuth();
  return (
    <>
      <Text>{`status ${status}`}</Text>
      <Text>{`me ${me?.name ?? '-'}`}</Text>
      <Text onPress={() => void refreshMe()}>muat ulang</Text>
    </>
  );
}

describe('layar masuk', () => {
  test('berhasil: token tersimpan dan pindah ke pilih', async () => {
    const api = createTestApi();
    const verify = jest.spyOn(api.transport, 'authVerify');
    await renderWithProviders(<Masuk />, { api });
    await signIn();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/mulai/pilih'));
    expect(verify).toHaveBeenCalledWith({ phone: PHONE, code: '123456' });
    expect(await api.session.get()).toMatch(/^contoh-/);
  });

  test('nomor memakai 62 tanpa plus', async () => {
    const api = createTestApi();
    const start = jest.spyOn(api.transport, 'authStart');
    await renderWithProviders(<Masuk />, { api });
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(start).toHaveBeenCalledWith({ phone: PHONE });
  });

  test('kode salah: teks di bawah kotak dan kotak dikosongkan', async () => {
    const api = createTestApi();
    await renderWithProviders(<Masuk />, { api });
    await signIn('000000');
    expect(await screen.findByText(WRONG_CODE_TEXT)).toBeTruthy();
    expect(screen.getByLabelText('Kode dari WhatsApp').props.value).toBe('');
    expect(router.push).not.toHaveBeenCalled();
    expect(await api.session.get()).toBeNull();
  });

  test('error jaringan: teks ramah tanpa kode error, kode tetap terisi', async () => {
    const api = createTestApi();
    await renderWithProviders(<Masuk />, { api });
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    await fireEvent.changeText(screen.getByLabelText('Kode dari WhatsApp'), '123456');
    api.transport.failNext('network');
    await fireEvent.press(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByText(ERROR_TEXT)).toBeTruthy();
    expect(screen.queryByText(/network/i)).toBeNull();
    expect(screen.getByLabelText('Kode dari WhatsApp').props.value).toBe('123456');
    expect(router.push).not.toHaveBeenCalled();
  });

  test('gagal mengirim kode: teks ramah, lalu bisa dicoba lagi', async () => {
    const api = createTestApi();
    await renderWithProviders(<Masuk />, { api });
    api.transport.failNext('server');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(await screen.findByText(ERROR_TEXT)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(screen.getByText('Kirim ulang kode dalam 01.00')).toBeTruthy();
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
  });

  test('Kirim ulang kode memanggil start lagi dan mengulang hitung mundur', async () => {
    const api = createTestApi();
    const start = jest.spyOn(api.transport, 'authStart');
    await renderWithProviders(<Masuk />, { api });
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(screen.getByText('Kirim ulang kode')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim ulang kode' }));
    expect(start).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Kirim ulang kode dalam 01.00')).toBeTruthy();
  });
});

describe('layar masuk: nomor belum terdaftar (aplikasi add-on)', () => {
  const UNREGISTERED = '0812 0000 0000';
  const WA_TEXT = 'Halo%2C%20saya%20mau%20coba%20Sekretaris%20AI.';

  test('teks ramah dan tombol Mulai lewat WhatsApp membuka wa.me dengan nomor dari server', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(async () => {});
    const api = createTestApi();
    await renderWithProviders(<Masuk />, { api });
    await fireEvent.changeText(screen.getByLabelText('Nomor WhatsApp'), UNREGISTERED);
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(
      await screen.findByText('Nomor ini belum memakai Sekretaris AI. Mulai dulu lewat WhatsApp ya.'),
    ).toBeTruthy();
    expect(NOT_REGISTERED_TEXT).toBe('Nomor ini belum memakai Sekretaris AI. Mulai dulu lewat WhatsApp ya.');
    // Tidak ada kode yang diminta: tombol masuk tetap mati dan tidak ada hitung mundur.
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeDisabled();
    expect(screen.queryByText(/Kirim ulang kode dalam/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Mulai lewat WhatsApp' }));
    expect(open).toHaveBeenCalledWith(`https://wa.me/${FAKE_WA_NUMBER}?text=${WA_TEXT}`);
    open.mockRestore();
  });

  test('server tidak menyebut nomor: cadangan dari konfigurasi; tanpa keduanya tombol tersembunyi', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(async () => {});
    const api = createTestApi({ waNumber: null });
    await renderWithProviders(<Masuk />, { api });
    await fireEvent.changeText(screen.getByLabelText('Nomor WhatsApp'), UNREGISTERED);
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(await screen.findByText(NOT_REGISTERED_TEXT)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mulai lewat WhatsApp' })).toBeNull();

    const config = Constants.expoConfig as { extra?: Record<string, unknown> };
    config.extra = { waNumber: '+62 811-1000-3333' };
    try {
      await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
      await fireEvent.press(await screen.findByRole('button', { name: 'Mulai lewat WhatsApp' }));
      expect(open).toHaveBeenCalledWith(waStartUrl('6281110003333'));
    } finally {
      delete config.extra;
    }
    jest.restoreAllMocks();
  });

  test('mengubah nomor menyembunyikan ajakan; nomor terdaftar tetap mendapat kode', async () => {
    const api = createTestApi();
    await renderWithProviders(<Masuk />, { api });
    await fireEvent.changeText(screen.getByLabelText('Nomor WhatsApp'), UNREGISTERED);
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(await screen.findByRole('button', { name: 'Mulai lewat WhatsApp' })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nomor WhatsApp'), '0812 2045 7781');
    expect(screen.queryByRole('button', { name: 'Mulai lewat WhatsApp' })).toBeNull();
    expect(screen.queryByText(NOT_REGISTERED_TEXT)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(await screen.findByText(/Kirim ulang kode dalam/)).toBeTruthy();
  });

  test('readWaNumber: hanya angka yang sah', () => {
    expect(readWaNumber({ waNumber: '+62 811-1000-3333' })).toBe('6281110003333');
    expect(readWaNumber({ waNumber: '' })).toBeNull();
    expect(readWaNumber({ waNumber: '12' })).toBeNull();
    expect(readWaNumber({})).toBeNull();
    expect(readWaNumber(undefined)).toBeNull();
  });
});

describe('layar masuk: nomor, tunggu, dan aksesibilitas', () => {
  const type = async (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);
  const wait = (n: number) =>
    act(async () => {
      jest.advanceTimersByTime(n * 1000);
    });

  test('429 terlalu sering: teks ramah dengan detiknya, hitung mundur dari retryInSec, Masuk tetap bisa', async () => {
    const api = createTestApi();
    jest
      .spyOn(api.transport, 'authStart')
      .mockRejectedValueOnce(new ApiFailure('rate_limited', { status: 429, error: 'terlalu_sering', retryInSec: 42 }));
    await renderWithProviders(<Masuk />, { api });
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(await screen.findByText('Tunggu sebentar ya, coba lagi dalam 42 detik.')).toBeTruthy();
    expect(screen.getByText('Kirim ulang kode dalam 00.42')).toBeTruthy();
    await wait(2);
    expect(screen.getByText('Kirim ulang kode dalam 00.40')).toBeTruthy();
    // Kode sudah pernah dikirim: boleh langsung dicocokkan.
    await type('Kode dari WhatsApp', '123456');
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled();
    await wait(40);
    expect(screen.getByRole('button', { name: 'Kirim ulang kode' })).toBeTruthy();
  });

  test('tunggu per nomor: mengubah nomor lalu mengembalikannya tidak mengulang tunggu', async () => {
    await renderWithProviders(<Masuk />, { api: createTestApi() });
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(screen.getByText('Kirim ulang kode dalam 01.00')).toBeTruthy();
    await wait(30);
    await type('Nomor WhatsApp', '0813 1111 2222');
    // Nomor lain belum meminta kode.
    expect(screen.getByRole('button', { name: 'Kirim kode' })).toBeTruthy();
    expect(screen.queryByText(/Kirim ulang kode dalam/)).toBeNull();
    await wait(10);
    await type('Nomor WhatsApp', '0812 2045 7781');
    expect(screen.getByText('Kirim ulang kode dalam 00.20')).toBeTruthy();
  });

  test('batas waktu mengikuti jam, bukan hitungan interval: lompatan jam di latar belakang tidak meleset', async () => {
    await renderWithProviders(<Masuk />, { api: createTestApi() });
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    // Aplikasi di latar belakang 45 detik: tidak ada tik yang jalan, jam bergeser.
    jest.setSystemTime(Date.now() + 45_000);
    await wait(1);
    expect(screen.getByText('Kirim ulang kode dalam 00.14')).toBeTruthy();
  });

  test('Masuk menunggu kode diminta untuk nomor ini; Kirim kode memindahkan fokus ke kolom kode', async () => {
    // Tiruan TextInput di Jest: focus() adalah jest.fn bersama untuk semua kolom.
    const focus = jest.mocked(TextInput.prototype.focus);
    focus.mockClear();
    await renderWithProviders(<Masuk />, { api: createTestApi() });
    await type('Kode dari WhatsApp', '123456');
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled();
    expect(focus).toHaveBeenCalledTimes(1);
  });

  test('kolom kode bukan SMS: tanpa isi otomatis sms-otp', async () => {
    await renderWithProviders(<Masuk />, { api: createTestApi() });
    const code = screen.getByLabelText('Kode dari WhatsApp');
    expect(code.props.autoComplete).toBeUndefined();
    expect(code.props.textContentType).toBe('oneTimeCode');
  });

  test('kesalahan diumumkan ke pembaca layar', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    await renderWithProviders(<Masuk />, { api: createTestApi() });
    await signIn('000000');
    expect(await screen.findByText(WRONG_CODE_TEXT)).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(WRONG_CODE_TEXT);
    announce.mockRestore();
  });

  test('Ganti mode data membuka lembar mode', async () => {
    await renderWithProviders(<Masuk />, { api: createTestApi() });
    await fireEvent.press(screen.getByRole('button', { name: 'Ganti mode data' }));
    expect(router.push).toHaveBeenCalledWith('/mode');
  });
});

describe('profil di mode server', () => {
  const serverWithMe = async (patch: object) => {
    const api = createTestApi({ mode: 'server', token: 'token', requireSession: true });
    const me = await api.transport.me();
    jest.spyOn(api.transport, 'me').mockResolvedValue({ ...me, ...patch });
    // Sapaan Beranda datang dari server (`greetingName`), sama dengan nama akun.
    const home = await api.transport.home();
    const name = (patch as { name?: string | null }).name ?? null;
    jest.spyOn(api.transport, 'home').mockResolvedValue({ ...home, greetingName: name });
    return api;
  };

  test('Beranda tanpa nama: sapaan tanpa nama contoh dan avatar ikon', async () => {
    const api = await serverWithMe({ name: null });
    await renderWithProviders(<Beranda />, { api });
    expect(await screen.findByText('Selamat pagi')).toBeTruthy();
    expect(screen.queryByText(/Rina/)).toBeNull();
    expect(screen.queryByText('RW')).toBeNull();
  });

  test('Beranda dengan nama dari server menyapa dengan nama itu', async () => {
    await renderWithProviders(<Beranda />, { api: await serverWithMe({ name: 'Budi Santoso' }) });
    expect(await screen.findByText('Selamat pagi, Budi Santoso')).toBeTruthy();
    expect(screen.getByText('BS')).toBeTruthy();
  });

  test('Akun tanpa nama: nomor dari server, "Akun Anda", paket dari server, tanpa data contoh', async () => {
    const api = await serverWithMe({
      name: null,
      phone: '6281311112222',
      plan: { name: 'Coba', activeUntil: null },
    });
    await renderWithProviders(<Akun />, { api });
    expect(await screen.findByText('+62 813-1111-2222')).toBeTruthy();
    expect(screen.getByText('Akun Anda')).toBeTruthy();
    expect(screen.getByText('Paket Coba')).toBeTruthy();
    expect(screen.queryByText(/Rina|Wulandari|Aktif sampai/)).toBeNull();
  });

  test('Akun sebelum me terbaca: tetap tanpa nama contoh', async () => {
    const api = createTestApi({ mode: 'server', token: 'token', requireSession: true });
    jest.spyOn(api.transport, 'me').mockRejectedValue(new ApiFailure('network'));
    await renderWithProviders(<Akun />, { api });
    expect(await screen.findByText('Akun Anda')).toBeTruthy();
    expect(screen.queryByText(/Rina|Wulandari/)).toBeNull();
  });
});

describe('me yang belum terbaca', () => {
  test('dicoba lagi saat stream terbuka', async () => {
    const api = createTestApi({ mode: 'server', token: 'token' });
    const real = api.transport.me.bind(api.transport);
    const me = jest
      .spyOn(api.transport, 'me')
      .mockRejectedValueOnce(new ApiFailure('network'))
      .mockImplementation(real);
    await renderWithProviders(<AuthProbe />, { api });
    expect(await screen.findByText('me Rina')).toBeTruthy();
    expect(me).toHaveBeenCalledTimes(2);
  });

  test('dicoba lagi saat aplikasi kembali dibuka; berhenti setelah terbaca', async () => {
    const api = createTestApi({ mode: 'server', token: 'token' });
    const real = api.transport.me.bind(api.transport);
    // Sinyal hilang: pemuatan awal dan percobaan saat stream terbuka gagal.
    const me = jest
      .spyOn(api.transport, 'me')
      .mockRejectedValueOnce(new ApiFailure('network'))
      .mockRejectedValueOnce(new ApiFailure('network'))
      .mockImplementation(real);
    let appState: (s: string) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
      appState = cb;
      return { remove };
    }) as never);
    await renderWithProviders(<AuthProbe />, { api });
    await screen.findByText('status signedIn');
    expect(screen.getByText('me -')).toBeTruthy();
    expect(me).toHaveBeenCalledTimes(2);
    await act(async () => appState('background'));
    expect(me).toHaveBeenCalledTimes(2);
    await act(async () => appState('active'));
    expect(await screen.findByText('me Rina')).toBeTruthy();
    expect(me).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenCalled();
  });
});

describe('helper tes', () => {
  test('createTestApi: mode server juga dibawa transportnya', () => {
    expect(createTestApi({ mode: 'server' }).transport.mode).toBe('server');
    expect(createTestApi().transport.mode).toBe('contoh');
  });
});

describe('penjaga rute (mode server)', () => {
  beforeEach(mockParams);
  afterEach(restoreParams);
  const server = (token: string | null = null) => createTestApi({ mode: 'server', token, requireSession: true });

  test('aturan: layar masuk hanya untuk yang belum masuk, layar aplikasi hanya setelah masuk, /mode selalu terbuka', () => {
    expect(['/mulai', '/mulai/masuk', '/mode', '/mulai/pilih', '/', '/akun', '/chat'].map(routeKind)).toEqual([
      'entry',
      'entry',
      'open',
      'app',
      'app',
      'app',
      'app',
    ]);
    const open = (kind: RouteKind, mode: 'contoh' | 'server', status: AuthStatus) => canOpen(kind, mode, status);
    for (const status of ['checking', 'signedOut', 'signedIn'] as const) {
      for (const kind of ['app', 'entry', 'open'] as const) expect(open(kind, 'contoh', status)).toBe(true);
      expect(open('open', 'server', status)).toBe(true);
    }
    expect(open('app', 'server', 'signedOut')).toBe(false);
    expect(open('app', 'server', 'checking')).toBe(false);
    expect(open('app', 'server', 'signedIn')).toBe(true);
    expect(open('entry', 'server', 'signedOut')).toBe(true);
    expect(open('entry', 'server', 'signedIn')).toBe(false);
    expect(open('entry', 'server', 'checking')).toBe(false);
  });

  test('tanpa sesi, layar aplikasi diganti sapaan', async () => {
    await showRoute('/', { api: server() });
    await waitFor(() => expect(currentStack()).toEqual(['/mulai']));
  });

  test('sapaan dan masuk tetap terbuka tanpa sesi; /mode juga', async () => {
    await showRoute('/mulai/masuk', { api: server() });
    await act(async () => {});
    expect(currentStack()).toEqual(['/mulai/masuk']);
    await go('/mode');
    expect(currentStack()).toEqual(['/mulai/masuk', '/mode']);
  });

  test('menuju layar aplikasi tanpa sesi dialihkan ke sapaan', async () => {
    await showRoute('/mulai', { api: server() });
    await go('/akun');
    expect(currentStack()).toEqual(['/mulai']);
  });

  test('dengan sesi: aplikasi biasa, layar masuk ditutup', async () => {
    await showRoute('/', { api: server('token') });
    await go('/mulai/masuk');
    expect(currentStack()).toEqual(['/']);
    await go('/akun');
    expect(currentStack()).toEqual(['/', '/akun']);
  });

  test('mode contoh tidak memaksa masuk', async () => {
    await showRoute('/akun');
    await act(async () => {});
    expect(currentStack()).toEqual(['/akun']);
  });

  test('sesi dicabut server: semua layar aplikasi ditutup berikut riwayatnya', async () => {
    const api = server('token');
    await showRoute('/', { api });
    await go('/akun');
    await waitFor(() => expect(screen.getByText('Akun')).toBeTruthy());
    api.transport.revokeSession();
    await act(async () => {
      await api.transport.me().catch(() => {});
    });
    await waitFor(() => expect(currentStack()).toEqual(['/mulai']));
    expect(await api.session.get()).toBeNull();
  });

  test('jalur lengkap: sapaan, masuk, pilih, Beranda; tumpukan akhirnya tepat [Beranda]', async () => {
    const api = server();
    await showRoute('/mulai', { api });
    await fireEvent.press(screen.getByRole('button', { name: 'Mulai' }));
    expect(currentStack()).toEqual(['/mulai', '/mulai/masuk']);
    await fireEvent.changeText(screen.getByLabelText('Nomor WhatsApp'), '0812 2045 7781');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim kode' }));
    await fireEvent.changeText(screen.getByLabelText('Kode dari WhatsApp'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Masuk' }));
    // Setelah masuk, layar sapaan dan masuk ditutup penjaga: "kembali" dari pilih tidak mendarat di sana.
    await waitFor(() => expect(currentRoute()).toBe('/mulai/pilih'));
    expect(currentStack()).toEqual(['/', '/mulai/pilih']);
    await fireEvent.press(screen.getByRole('button', { name: 'Lewati dulu' }));
    expect(currentStack()).toEqual(['/']);
    // "Kembali" dari Beranda tidak membawa ke layar mana pun.
    await act(async () => {
      router.back();
    });
    expect(currentStack()).toEqual(['/']);
    expect(currentRoute()).toBe('/');
  });

  test('keluar: sesi hilang, tumpukan hanya sapaan', async () => {
    const api = server('token');
    await showRoute('/', { api });
    await go('/akun');
    await go('/keluar');
    await fireEvent.press(screen.getByRole('button', { name: 'Keluar' }));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => expect(currentStack()).toEqual(['/mulai']));
    expect(await api.session.get()).toBeNull();
  });

  test('ganti mode data dari layar masuk membuka /mode', async () => {
    await showRoute('/mulai/masuk', { api: server() });
    await fireEvent.press(screen.getByRole('button', { name: 'Ganti mode data' }));
    expect(currentRoute()).toBe('/mode');
  });
});

describe('keluar', () => {
  beforeEach(mockParams);
  afterEach(restoreParams);

  test('menghapus sesi dan membuka /mulai dengan tumpukan bersih', async () => {
    const api = createTestApi({ token: 'token' });
    await showRoute('/', { api });
    await go('/akun');
    await fireEvent.press(screen.getByRole('button', { name: 'Keluar' }));
    expect(currentRoute()).toBe('/keluar');
    expect(screen.getByText('Keluar dari akun ini?')).toBeTruthy();
    expect(screen.getByText('Riwayat tetap tersimpan, dan Anda bisa masuk lagi kapan saja.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Keluar' }));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => expect(currentRoute()).toBe('/mulai'));
    expect(currentStack()).toEqual(['/mulai']);
    expect(await api.session.get()).toBeNull();
  });

  test('sesi dihapus di HP lebih dulu, server menyusul di belakang layar; ketukan ganda sekali saja', async () => {
    const api = createTestApi({ token: 'token' });
    let finish: () => void = () => {};
    const logout = jest.spyOn(api.transport, 'logout').mockImplementation(async () => {
      await api.session.clear();
      await new Promise<void>((resolve) => (finish = resolve));
    });
    await showRoute('/', { api });
    await go('/akun');
    await fireEvent.press(screen.getByRole('button', { name: 'Keluar' }));
    const confirm = screen.getByRole('button', { name: 'Keluar' });
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(await api.session.get()).toBeNull();
    await act(async () => finish());
    await waitFor(() => expect(currentStack()).toEqual(['/mulai']));
  });

  test('Batal menutup tanpa keluar', async () => {
    const api = createTestApi({ token: 'token' });
    await showRoute('/', { api });
    await go('/akun');
    await fireEvent.press(screen.getByRole('button', { name: 'Keluar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Batal' }));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(currentStack()).toEqual(['/', '/akun']);
    expect(await api.session.get()).toBe('token');
  });
});

describe('mode data', () => {
  test('Akun menunjukkan mode sekarang dan membuka lembar pilihan', async () => {
    await renderWithProviders(<Akun />);
    await fireEvent.press(screen.getByRole('button', { name: 'Mode data. Contoh' }));
    expect(router.push).toHaveBeenCalledWith('/mode');
  });

  test('Server tidak bisa dipilih tanpa alamat server', async () => {
    await renderWithProviders(<Mode />);
    expect(screen.getByRole('radio', { name: 'Contoh' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Server' })).toBeDisabled();
    expect(screen.getByText('Alamat server belum diatur')).toBeTruthy();
  });
});

describe('nama dari server', () => {
  async function withMe() {
    const api = createTestApi({ token: 'token' });
    const me = await api.transport.me();
    jest.spyOn(api.transport, 'me').mockResolvedValue({ ...me, name: 'Budi', assistantName: 'Dewi' });
    jest.spyOn(api.transport, 'home').mockResolvedValue({ ...(await api.transport.home()), greetingName: 'Budi' });
    return api;
  }

  test('nama asisten tampil di header chat', async () => {
    await renderWithProviders(<Chat />, { api: await withMe() });
    expect(await screen.findByText('Dewi')).toBeTruthy();
    expect(screen.queryByText('Nadia')).toBeNull();
    expect(screen.getByLabelText('Tulis pesan untuk Dewi')).toBeTruthy();
  });

  test('nama asisten tampil di tab bar dan nama pengguna di Beranda', async () => {
    const api = await withMe();
    const props = {
      state: { index: 0, routes: ['index', 'agenda', 'perangkat', 'usaha'].map((name) => ({ key: name, name })) },
      descriptors: {},
      emitter: { emit: jest.fn(() => ({ defaultPrevented: false })) },
      navigateToTab: jest.fn(),
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    } as unknown as BottomTabBarProps;
    await renderWithProviders(
      <>
        <Beranda />
        <TabBar {...props} />
      </>,
      { api },
    );
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Bicara dengan Dewi' })).toHaveLength(2));
    expect(screen.getByText('Selamat pagi, Budi')).toBeTruthy();
    expect(screen.getAllByText('Dewi').length).toBeGreaterThan(0);
  });

  test('tanpa nama dari server: nama bawaan', async () => {
    await renderWithProviders(<Chat />);
    expect(await screen.findByText('Nadia')).toBeTruthy();
  });
});
