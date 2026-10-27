import { act, fireEvent, screen, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import Beranda from '../app/(tabs)/index';
import { createTestApi, renderWithProviders, toastNow } from './helpers';
import { ERROR_TEXT } from '@/api/errors';
import { ApiFailure } from '@/api/transport';
import { BUDI_DRAFT_ID, supplierOrderDraft } from '@/sample/outgoing';
import { newUserSampleState } from '@/sample/fresh';
import { deviceById, MAIN_AC_ID } from '@/sample/store';
import { SUGGESTIONS } from '@/ui/beranda/blocks';
import { TIP_TEXT } from '@/ui/tips';

beforeEach(() => jest.clearAllMocks());

const settle = () =>
  act(async () => {
    for (let i = 0; i < 3; i++) await Promise.resolve();
  });

/** Urutan blok di layar (testID dari atas ke bawah). */
function blockOrder(): string[] {
  const ids: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const node = n as { props?: { testID?: string }; children?: unknown[] };
    const id = node.props?.testID;
    if (id && id.startsWith('blok-')) ids.push(id);
    node.children?.forEach(walk);
  };
  [screen.toJSON()].flat().forEach(walk);
  return ids;
}

describe('pengguna yang sudah terbiasa (data contoh)', () => {
  test('sapaan pendek, lalu tiga blok berurutan: persetujuan, agenda berikutnya, perangkat favorit', async () => {
    await renderWithProviders(<Beranda />);
    await settle();
    expect(screen.getByText('Pagi, Rina')).toBeOnTheScreen();
    expect(blockOrder()).toEqual(['blok-persetujuan', 'blok-agenda', 'blok-favorit']);

    const approval = within(screen.getByTestId('blok-persetujuan'));
    expect(approval.getByText('Pak Budi')).toBeOnTheScreen();
    expect(approval.getByText('B', { includeHiddenElements: true })).toBeTruthy();
    expect(approval.getByText(/^Selamat siang, Pak Budi\. Untuk sewa/)).toBeOnTheScreen();

    const next = within(screen.getByTestId('blok-agenda'));
    expect(next.getByText('13.00')).toBeOnTheScreen();
    expect(next.getByText('Bayar listrik Kedai Dago')).toBeOnTheScreen();

    const favs = within(screen.getByTestId('blok-favorit'));
    expect(favs.getAllByRole('switch').map((s) => s.props.accessibilityLabel)).toEqual(['AC kamar', 'Teras', 'TV']);
    expect(favs.getByText('24°')).toBeOnTheScreen();

    // Tidak ada ringkasan, tempat, kartu Usaha, Rumah, atau penanda contoh; layanan hanya sebagai jaring logo di sekitar
    // Inti besar (tanpa tulisan).
    expect(screen.queryByText('Data contoh')).toBeNull();
    expect(screen.queryByText(/terhubung/)).toBeNull();
    expect(screen.queryByText('Rp4.250.000')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Tempat/ })).toBeNull();
    expect(screen.queryByText('Coba bilang')).toBeNull();
    // Kata di Beranda sedikit (≤ 15 kata di luar cuplikan pesan).
  });

  test('blok hanya muncul bila ada isinya: tanpa persetujuan dan tanpa agenda dekat, widget dan favorit', async () => {
    await renderWithProviders(<Beranda />, {
      actions: [
        { type: 'sendDraft', id: BUDI_DRAFT_ID },
        { type: 'setDone', id: 'a2', done: true },
        { type: 'setDone', id: 'jemput:2025-10-20', done: true },
        { type: 'setDone', id: 'rapat-manajer:2025-10-20', done: true },
      ],
    });
    await settle();
    expect(blockOrder()).toEqual(['blok-agenda', 'blok-favorit']);
    expect(within(screen.getByTestId('blok-agenda')).getByText('Hari ini masih lega')).toBeOnTheScreen();
    expect(screen.getByText('Pagi, Rina')).toBeOnTheScreen();
  });

  test('persetujuan: Kirim menahan kiriman (5 menit), bloknya pergi, dan getar sukses', async () => {
    const api = createTestApi();
    await renderWithProviders(<Beranda />, { api });
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim ke Pak Budi' }));
    await settle();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(api.transport.sample.getState().outgoing[BUDI_DRAFT_ID]!.status).toBe('held');
    expect(screen.queryByTestId('blok-persetujuan')).toBeNull();
    expect(blockOrder()).toEqual(['blok-agenda', 'blok-favorit']);
  });

  test('persetujuan berikutnya menggantikan yang sudah dikirim', async () => {
    const api = createTestApi();
    await renderWithProviders(<Beranda />, { api });
    await settle();
    await act(async () => {
      api.transport.sample.dispatch({ type: 'addDraft', draft: supplierOrderDraft });
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim ke Pak Budi' }));
    await settle();
    expect(within(screen.getByTestId('blok-persetujuan')).getByText('PT Sumber Susu')).toBeOnTheScreen();
    expect(within(screen.getByTestId('blok-persetujuan')).getByText('S', { includeHiddenElements: true })).toBeTruthy();
  });

  test('Ubah membuka chat di draf itu', async () => {
    await renderWithProviders(<Beranda />);
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Ubah pesan untuk Pak Budi' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/chat', params: { draf: BUDI_DRAFT_ID } });
  });

  test('Kirim yang gagal: toast ramah, kartunya tetap', async () => {
    const api = createTestApi();
    await renderWithProviders(<Beranda />, { api });
    await settle();
    api.transport.failNext('network');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim ke Pak Budi' }));
    await settle();
    expect(toastNow()?.text).toBe(ERROR_TEXT);
    expect(screen.getByTestId('blok-persetujuan')).toBeOnTheScreen();
  });

  test('agenda berikutnya membuka Agenda', async () => {
    await renderWithProviders(<Beranda />);
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Agenda berikutnya, 13.00, Bayar listrik Kedai Dago' }));
    expect(router.navigate).toHaveBeenCalledWith('/agenda');
  });

  test('sakelar favorit: ketuk mematikan lalu menyalakan lagi (hijau = nyala)', async () => {
    const api = createTestApi();
    await renderWithProviders(<Beranda />, { api });
    await settle();
    const ac = () => screen.getByRole('switch', { name: 'AC kamar' });
    expect(ac()).toBeChecked();
    await fireEvent.press(ac());
    await settle();
    expect(deviceById(api.transport.sample.getState(), MAIN_AC_ID)!.on).toBe(false);
    expect(ac()).not.toBeChecked();
    expect(within(screen.getByTestId(`favorit-${MAIN_AC_ID}`)).getByText('Mati')).toBeOnTheScreen();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    await fireEvent.press(ac());
    await settle();
    expect(deviceById(api.transport.sample.getState(), MAIN_AC_ID)!.on).toBe(true);
    expect(within(screen.getByTestId(`favorit-${MAIN_AC_ID}`)).getByText('24°')).toBeOnTheScreen();
  });

  test('tahan sakelar favorit membuka halaman perangkatnya', async () => {
    await renderWithProviders(<Beranda />);
    await settle();
    await fireEvent(screen.getByRole('switch', { name: 'Teras' }), 'longPress');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/perangkat/[id]', params: { id: 'lampu-teras' } });
  });

  test('favorit yang dijaga memakai aturan yang sama: kamera dengan PIN membuka lembar PIN', async () => {
    const api = createTestApi({ security: { pinEnabled: true, pin: '123456' } });
    api.transport.sample.dispatch({ type: 'setFavorite', id: 'kamera-tamu', favorite: true });
    await renderWithProviders(<Beranda />, { api });
    await settle();
    await fireEvent.press(screen.getByRole('switch', { name: 'Kamera' }));
    await settle();
    expect(router.push).toHaveBeenCalledWith({ pathname: '/pin', params: { id: 'kamera-tamu' } });
    expect(deviceById(api.transport.sample.getState(), 'kamera-tamu')!.on).toBe(true);
  });

  test('favorit kunci tanpa PIN bertanya dulu sebelum membuka', async () => {
    const api = createTestApi();
    api.transport.sample.dispatch({ type: 'setFavorite', id: 'pintu-depan', favorite: true });
    await renderWithProviders(<Beranda />, { api });
    await settle();
    expect(within(screen.getByTestId('favorit-pintu-depan')).getByText('Terkunci')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('switch', { name: 'Pintu depan' }));
    await settle();
    expect(router.push).toHaveBeenCalledWith({ pathname: '/buka-kunci', params: { id: 'pintu-depan' } });
    expect(deviceById(api.transport.sample.getState(), 'pintu-depan')!.on).toBe(true);
  });

  test('perangkat dari layar lain sampai ke Beranda lewat event', async () => {
    const api = createTestApi();
    await renderWithProviders(<Beranda />, { api });
    await settle();
    await act(async () => {
      api.transport.sample.dispatch({ type: 'toggleDevice', id: 'lampu-teras', on: false });
    });
    expect(screen.getByRole('switch', { name: 'Teras' })).not.toBeChecked();
  });

  test('mode gelap: isi sama, teks terang', async () => {
    await renderWithProviders(<Beranda />, { scheme: 'dark' });
    await settle();
    expect(StyleSheet.flatten(screen.getByText('Pagi, Rina').props.style).color).toBe('#F2F3F5');
    expect(blockOrder()).toEqual(['blok-persetujuan', 'blok-agenda', 'blok-favorit']);
  });
});

describe('pengguna baru', () => {
  test('sapaan dengan tanggal, Inti besar, widget cuaca dan agenda, dan satu kartu Coba bilang', async () => {
    await renderWithProviders(<Beranda />, { state: newUserSampleState });
    await settle();
    expect(screen.getByText('Halo, Rina')).toBeOnTheScreen();
    expect(screen.getByTestId('beranda-hari-ini')).toHaveTextContent(
      /^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu), \d+ \w+ · \d{2}\.\d{2}$/,
    );
    expect(blockOrder()).toEqual(['blok-agenda', 'blok-saran']);
    // Cuaca dimuat dari pengatur waktu sesudah Beranda tampil.
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    await settle();
    expect(within(screen.getByTestId('widget-cuaca')).getByText('27°')).toBeOnTheScreen();
    expect(within(screen.getByTestId('widget-cuaca')).getByText('Berawan')).toBeOnTheScreen();
    expect(screen.getByText('Coba bilang')).toBeOnTheScreen();
    const quote = screen.getByText(/^“.+”$/);
    expect(SUGGESTIONS.map((s) => `“${s}”`)).toContain(quote.props.children);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  test('kartu Coba bilang membuka chat dengan kalimatnya di kolom ketik', async () => {
    await renderWithProviders(<Beranda />, { state: newUserSampleState });
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: /^Coba bilang: / }));
    const call = jest.mocked(router.push).mock.calls[0]![0] as { pathname: string; params: { isi: string } };
    expect(call.pathname).toBe('/chat');
    expect(SUGGESTIONS).toContain(call.params.isi);
  });

  test('petunjuk pertama: tampil sekali di atas Inti, menyembunyikan kartu contoh, hilang saat disentuh', async () => {
    await renderWithProviders(<Beranda />, { state: newUserSampleState, tips: 'fresh' });
    await settle();
    expect(screen.getByText(TIP_TEXT.inti)).toBeOnTheScreen();
    expect(screen.queryByText('Coba bilang')).toBeNull();
    await fireEvent.press(screen.getByTestId('petunjuk'));
    expect(screen.queryByText(TIP_TEXT.inti)).toBeNull();
    expect(screen.getByText('Coba bilang')).toBeOnTheScreen();
  });
});

describe('gagal memuat', () => {
  test('kalimat ramah dan Coba lagi, lalu isi muncul', async () => {
    const api = createTestApi();
    jest.spyOn(api.transport, 'home').mockRejectedValueOnce(new ApiFailure('network'));
    await renderWithProviders(<Beranda />, { api });
    expect(await screen.findByText(ERROR_TEXT)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText('Pagi, Rina')).toBeOnTheScreen();
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
  });

  test('tanpa nama: sapaan lengkap tanpa nama', async () => {
    const api = createTestApi();
    jest.spyOn(api.transport, 'home').mockResolvedValue({ ...(await api.transport.home()), greetingName: null });
    await renderWithProviders(<Beranda />, { api });
    expect(await screen.findByText('Selamat pagi')).toBeOnTheScreen();
    expect(screen.queryByText(/Rina/)).toBeNull();
  });
});

test('avatar di kanan atas membuka Akun', async () => {
  await renderWithProviders(<Beranda />);
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: 'Akun' }));
  expect(router.push).toHaveBeenCalledWith('/akun');
  expect(screen.getByText('RW')).toBeOnTheScreen();
});
