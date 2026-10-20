import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, usePathname } from 'expo-router';
import { Text } from 'react-native';
import { AuthGate } from '@/api/AuthGate';
import { ERROR_TEXT, WRONG_CODE_TEXT } from '@/api/errors';
import { useAuth } from '@/api/useAuth';
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

describe('gerbang masuk', () => {
  const server = (token: string | null = null) => createTestApi({ mode: 'server', token, requireSession: true });

  test('mode server tanpa sesi membuka /mulai dengan tumpukan bersih', async () => {
    await renderWithProviders(<AuthGate />, { api: server() });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/mulai'));
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });

  test('layar masuk sendiri tidak dialihkan lagi', async () => {
    jest.mocked(usePathname).mockReturnValue('/mulai/masuk');
    try {
      await renderWithProviders(<AuthGate />, { api: server() });
      await act(async () => {});
      expect(router.replace).not.toHaveBeenCalled();
    } finally {
      jest.mocked(usePathname).mockReturnValue('/');
    }
  });

  test('pilih tanpa sesi dialihkan ke /mulai', async () => {
    jest.mocked(usePathname).mockReturnValue('/mulai/pilih');
    try {
      await renderWithProviders(<AuthGate />, { api: server() });
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/mulai'));
    } finally {
      jest.mocked(usePathname).mockReturnValue('/');
    }
  });

  test('mode server dengan sesi: aplikasi biasa', async () => {
    const api = server('token');
    await renderWithProviders(
      <>
        <AuthGate />
        <AuthProbe />
      </>,
      { api },
    );
    expect(await screen.findByText('status signedIn')).toBeTruthy();
    expect(screen.getByText('me Rina')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  test('mode contoh tidak memaksa masuk', async () => {
    await renderWithProviders(
      <>
        <AuthGate />
        <AuthProbe />
      </>,
    );
    expect(await screen.findByText('status signedOut')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  test('sesi dicabut: panggilan berikutnya ditolak dan status menjadi signedOut', async () => {
    const api = server('token');
    await renderWithProviders(
      <>
        <AuthGate />
        <AuthProbe />
      </>,
      { api },
    );
    expect(await screen.findByText('status signedIn')).toBeTruthy();
    api.transport.revokeSession();
    await fireEvent.press(screen.getByText('muat ulang'));
    expect(await screen.findByText('status signedOut')).toBeTruthy();
    expect(screen.getByText('me -')).toBeTruthy();
    expect(await api.session.get()).toBeNull();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/mulai'));
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
