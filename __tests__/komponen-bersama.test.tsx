import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router, useIsFocused } from 'expo-router';
import { AccessibilityInfo, BackHandler, StyleSheet, Text } from 'react-native';
import Tempat from '../app/tempat';
import { type SampleState } from '@/sample/store';
import { FilterChips } from '@/ui/FilterChips';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Segmented } from '@/ui/Segmented';
import { Sheet, useSheet } from '@/ui/Sheet';
import { shouldDismiss } from '@/ui/sheetMath';
import { setTabBarShown } from '@/ui/tabBarShown';
import { Toast, ToastHost } from '@/ui/Toast';
import { renderWithProviders, testToasts, useSample } from './helpers';
import { Redraw, redraw } from './redraw';

beforeEach(() => jest.clearAllMocks());

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

test('Sheet: ketuk latar menutup dan memanggil onClose setelah animasi', async () => {
  const onClose = jest.fn();
  await renderWithProviders(
    <Sheet onClose={onClose}>
      <Text>Isi lembar</Text>
    </Sheet>,
  );
  expect(screen.getByText('Isi lembar')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Tutup' }));
  await advance(250);
  expect(onClose).toHaveBeenCalledTimes(1);
  // ketukan kedua tidak memanggil ulang
  await fireEvent.press(screen.getByRole('button', { name: 'Tutup' }));
  await advance(250);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('Sheet: tombol kembali Android menutup', async () => {
  const handlers: (() => boolean)[] = [];
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, h) => {
    handlers.push(h as () => boolean);
    return { remove: jest.fn() };
  });
  const onClose = jest.fn();
  await renderWithProviders(
    <Sheet onClose={onClose}>
      <Text>Isi</Text>
    </Sheet>,
  );
  await act(async () => {
    expect(handlers[0]!()).toBe(true);
  });
  await advance(250);
  expect(onClose).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});

test('Sheet: tombol kembali tidak dipegang saat layar lain menutupinya, dan dipasang lagi saat fokus kembali', async () => {
  const handlers: (() => boolean)[] = [];
  const remove = jest.fn();
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, h) => {
    handlers.push(h as () => boolean);
    return { remove };
  });
  jest.mocked(useIsFocused).mockReturnValue(false);
  try {
    await renderWithProviders(
      <Redraw>
        {() => (
          <Sheet onClose={jest.fn()}>
            <Text>Isi</Text>
          </Sheet>
        )}
      </Redraw>,
    );
    expect(handlers).toHaveLength(0);
    jest.mocked(useIsFocused).mockReturnValue(true);
    await redraw();
    expect(handlers).toHaveLength(1);
    jest.mocked(useIsFocused).mockReturnValue(false);
    await redraw();
    expect(remove).toHaveBeenCalledTimes(1);
  } finally {
    jest.mocked(useIsFocused).mockReturnValue(true);
    spy.mockRestore();
  }
});

test('Sheet: layar lain naik di tengah gerak menutup membatalkan penutupan (onClose tidak dipanggil)', async () => {
  const onClose = jest.fn();
  await renderWithProviders(
    <Redraw>
      {() => (
        <Sheet onClose={onClose}>
          <Text>Isi</Text>
        </Sheet>
      )}
    </Redraw>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Tutup' }));
  jest.mocked(useIsFocused).mockReturnValue(false);
  try {
    await redraw();
    await advance(300);
    expect(onClose).not.toHaveBeenCalled();
    // kembali fokus: bisa ditutup lagi
    jest.mocked(useIsFocused).mockReturnValue(true);
    await redraw();
    await fireEvent.press(screen.getByRole('button', { name: 'Tutup' }));
    await advance(300);
    expect(onClose).toHaveBeenCalledTimes(1);
  } finally {
    jest.mocked(useIsFocused).mockReturnValue(true);
  }
});

test('Toast: tampil dengan teks dan sebagai pesan yang dibacakan', async () => {
  await render(<Toast text="Tersimpan." />);
  expect(screen.getByText('Tersimpan.')).toBeOnTheScreen();
  expect(screen.getByTestId('toast')).toHaveProp('accessibilityRole', 'alert');
  // diumumkan hanya lewat ToastHost, bukan juga lewat live region
  expect(screen.getByTestId('toast')).not.toHaveProp('accessibilityLiveRegion');
});

test('ToastHost: tampil dari penyimpanan dan hilang sendiri setelah 2,6 detik', async () => {
  await renderWithProviders(
    <>
      <ToastHost />
    </>,
  );
  expect(screen.queryByText('Kiriman dibatalkan.')).not.toBeOnTheScreen();
  await act(async () => testToasts.show('Kiriman dibatalkan.'));
  expect(screen.getByText('Kiriman dibatalkan.')).toBeOnTheScreen();
  await advance(2500);
  expect(screen.getByText('Kiriman dibatalkan.')).toBeOnTheScreen();
  await advance(150);
  expect(screen.queryByText('Kiriman dibatalkan.')).not.toBeOnTheScreen();
});

test('ToastHost: teks yang sama dua kali memulai ulang 2,6 detik dan dibacakan lagi', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  await renderWithProviders(
    <>
      <ToastHost />
    </>,
  );
  await act(async () => testToasts.show('Tersimpan di agenda.'));
  expect(announce).toHaveBeenCalledTimes(1);
  expect(announce).toHaveBeenLastCalledWith('Tersimpan di agenda.');
  await advance(2000);
  await act(async () => testToasts.show('Tersimpan di agenda.'));
  expect(announce).toHaveBeenCalledTimes(2);
  // waktu toast pertama sudah lewat, tapi toast kedua masih tampil
  await advance(2500);
  expect(screen.getByText('Tersimpan di agenda.')).toBeOnTheScreen();
  await advance(150);
  expect(screen.queryByText('Tersimpan di agenda.')).not.toBeOnTheScreen();
  expect(announce).toHaveBeenCalledTimes(2);
  announce.mockRestore();
});

test('Segmented memanggil onChange dan menandai pilihan', async () => {
  const onChange = jest.fn();
  await render(<Segmented options={['Hari ini', 'Minggu ini', 'Kalender']} value="Hari ini" onChange={onChange} />);
  expect(screen.getByRole('tab', { name: 'Hari ini' })).toBeSelected();
  expect(screen.getByRole('tab', { name: 'Kalender' })).not.toBeSelected();
  await fireEvent.press(screen.getByRole('tab', { name: 'Minggu ini' }));
  expect(onChange).toHaveBeenCalledWith('Minggu ini');
});

test('FilterChips memanggil onChange dan menandai pilihan', async () => {
  const onChange = jest.fn();
  await render(<FilterChips options={['Semua', 'Pesan', 'Rumah']} value="Semua" onChange={onChange} />);
  expect(screen.getByRole('button', { name: 'Semua' })).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: 'Rumah' }));
  expect(onChange).toHaveBeenCalledWith('Rumah');
});

test('ListRow menampilkan judul dan keterangan, dan bisa ditekan', async () => {
  const onPress = jest.fn();
  await render(
    <ListGroup>
      <ListRow icon="mail" title="Gmail" subtitle="Aktif · terakhir dibaca 2 menit lalu" onPress={onPress} last />
    </ListGroup>,
  );
  expect(screen.getByText('Gmail')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: /Gmail/ }));
  expect(onPress).toHaveBeenCalled();
});

test('ListRow tanpa onPress tidak mengaku tombol', async () => {
  await render(
    <ListGroup>
      <ListRow icon="mail" title="Gmail" last />
    </ListGroup>,
  );
  expect(screen.queryByRole('button', { name: /Gmail/ })).toBeNull();
});

test('/tempat: daftar tempat dengan centang di tempat sekarang, memilih mengubah tempat dan menutup', async () => {
  let seen: SampleState | undefined;
  function Probe() {
    seen = useSample().state;
    return null;
  }
  await renderWithProviders(
    <>
      <Tempat />
      <Probe />
    </>,
  );
  for (const p of ['Semua', 'Rumah', 'Kedai Dago', 'Kedai Riau']) {
    expect(screen.getByRole('radio', { name: p })).toBeOnTheScreen();
  }
  expect(screen.getByRole('radio', { name: 'Semua' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Rumah' })).not.toBeChecked();
  await fireEvent.press(screen.getByRole('radio', { name: 'Kedai Dago' }));
  // tempat berganti dan lembar tertutup setelah geser keluar
  expect(router.back).not.toHaveBeenCalled();
  await advance(250);
  expect(seen!.place).toBe('Kedai Dago');
  expect(router.back).toHaveBeenCalled();
});

test('Sheet: close() dari isi menggeser keluar 200 ms, lalu onClose, lalu after', async () => {
  const calls: string[] = [];
  function Isi() {
    const { close } = useSheet();
    return <Text onPress={() => close(() => calls.push('after'))}>Simpan</Text>;
  }
  await renderWithProviders(
    <Sheet onClose={() => calls.push('onClose')}>
      <Isi />
    </Sheet>,
  );
  await fireEvent.press(screen.getByText('Simpan'));
  await advance(150);
  expect(calls).toEqual([]);
  await advance(60);
  expect(calls).toEqual(['onClose', 'after']);
  // dipanggil lagi saat sedang menutup: tidak berulang
  await fireEvent.press(screen.getByText('Simpan'));
  await advance(250);
  expect(calls).toEqual(['onClose', 'after']);
});

test('Sheet: ambang geser memakai tinggi panel yang terukur; sentakan cepat juga menutup', () => {
  // panel 400 dp: ambang 100 dp
  expect(shouldDismiss(99, 400, 0)).toBe(false);
  expect(shouldDismiss(101, 400, 0)).toBe(true);
  // panel 1000 dp: 101 dp belum cukup
  expect(shouldDismiss(101, 1000, 0)).toBe(false);
  expect(shouldDismiss(251, 1000, 0)).toBe(true);
  // belum terukur: cadangan 300 dp, ambang 75
  expect(shouldDismiss(76, 0, 0)).toBe(true);
  expect(shouldDismiss(74, 0, 0)).toBe(false);
  expect(shouldDismiss(5, 400, 1000)).toBe(true);
});

test('ToastHost: duduk 16 dp di atas tepi bawah, ditambah tinggi tab bar (dan setengah Inti Beranda) hanya saat tab bar terlihat', async () => {
  await renderWithProviders(
    <>
      <ToastHost />
    </>,
  );
  await act(async () => testToasts.show('Satu'));
  const bottom = () => StyleSheet.flatten(screen.getByTestId('toast').parent!.props.style).bottom as number;
  const base = bottom();
  await act(async () => setTabBarShown(true));
  // 68 tinggi bilah + 46 setengah Inti Beranda yang naik di atasnya.
  expect(bottom()).toBe(base + 68 + 46);
  await act(async () => setTabBarShown(false));
  expect(bottom()).toBe(base);
});
