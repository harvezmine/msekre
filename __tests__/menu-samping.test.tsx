/**
 * Menu samping (bukan sapaan besar ala web): dibuka dari tombol Menu di bilah atas Beranda, berisi profil dan layar-layar
 * pendukung, ditutup dengan ketukan di luar, tombol Kembali, atau memilih isinya.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { BackHandler } from 'react-native';
import Beranda from '../app/(tabs)/index';
import { createTestApi, openMenu, renderWithProviders } from './helpers';
import { SideMenu, sideMenu } from '@/ui/SideMenu';

const settle = async () => {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
  }
};

async function show(options: Parameters<typeof renderWithProviders>[1] = {}) {
  await renderWithProviders(
    <>
      <Beranda />
      <SideMenu />
    </>,
    options,
  );
  await settle();
}

beforeEach(() => jest.clearAllMocks());

test('tertutup: tidak ada isi menu di layar (tidak dibaca pembaca layar)', async () => {
  await show();
  expect(screen.queryByTestId('menu-samping')).toBeNull();
});

test('isi menu berkelompok: utama, Kelola, Akun; lalu Bantuan dan Keluar', async () => {
  await show();
  await openMenu();
  const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
  const order = ['Chat', 'Mode Suara', 'Agenda', 'Integrasi', 'Perangkat', 'Usaha', 'Riwayat'];
  const after = ['Pengaturan', 'Pemberitahuan', 'Asisten', 'Keamanan', 'Bantuan', 'Keluar'];
  const shown = labels.filter((l) => [...order, ...after].includes(l));
  expect(shown).toEqual([...order, ...after]);
  expect(screen.getByText('Kelola')).toBeOnTheScreen();
  expect(screen.getByText('Akun')).toBeOnTheScreen();
});

test('memilih isi menu: pindah layar dan menu tertutup', async () => {
  await show();
  await openMenu();
  await fireEvent.press(screen.getByRole('button', { name: 'Integrasi' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung');
  expect(sideMenu.isOpen()).toBe(false);
  await settle();
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(screen.queryByTestId('menu-samping')).toBeNull();
});

test('ketuk di luar panel dan tombol Kembali menutup menu', async () => {
  const handlers: (() => boolean)[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_: string, cb: () => boolean) => {
    handlers.push(cb);
    return { remove: jest.fn() };
  }) as never);
  await show();
  await openMenu();
  // Panel menu modal untuk pembaca layar (ditutup dengan Kembali); latar gelap di luarnya tetap bisa diketuk.
  await fireEvent.press(screen.getByTestId('menu-samping-tutup', { includeHiddenElements: true }));
  expect(sideMenu.isOpen()).toBe(false);

  await openMenu();
  let handled = false;
  await act(async () => {
    handled = handlers.at(-1)!();
  });
  expect(handled).toBe(true);
  expect(sideMenu.isOpen()).toBe(false);
});

test('mode akun: Perangkat, Usaha, dan Asisten (masih contoh atau diatur lewat WhatsApp) tidak tampil', async () => {
  await show({ api: createTestApi({ mode: 'akun', token: 'tok' }) });
  await openMenu();
  for (const label of ['Perangkat', 'Usaha', 'Asisten']) {
    expect(screen.queryByRole('button', { name: label })).toBeNull();
  }
  for (const label of ['Chat', 'Integrasi', 'Riwayat', 'Pengaturan', 'Keluar']) {
    expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
  }
});
