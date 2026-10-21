import * as Haptics from 'expo-haptics';
import { StyleSheet } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { createTestApi, renderWithProviders } from './helpers';
import Tempat from '../app/tempat';
import { ERROR_TEXT } from '@/api/errors';
import { ApiFailure } from '@/api/transport';
import Beranda from '../app/(tabs)/index';
import { TODAY } from '@/sample/agenda';
import { BUDI_DRAFT_ID, supplierOrderDraft } from '@/sample/outgoing';

beforeEach(() => jest.clearAllMocks());

test('Beranda menampilkan isi desain 1a', async () => {
  await renderWithProviders(<Beranda />);
  expect(screen.getByText('Selamat pagi, Rina')).toBeTruthy();
  expect(screen.getByText('7 terhubung · CCTV tidak terjangkau')).toBeTruthy();
  expect(screen.getByText('Butuh persetujuan Anda')).toBeTruthy();
  expect(screen.getByText('Balasan untuk Pak Budi soal harga sewa sudah siap. Kirim?')).toBeTruthy();
  expect(screen.getByText('Bayar listrik Kedai Dago')).toBeTruthy();
  expect(screen.getByText('Rp4.250.000')).toBeTruthy();
  expect(screen.getByText('Susu UHT tinggal 6 karton')).toBeTruthy();
});

test('sakelar AC mengubah tulisannya', async () => {
  await renderWithProviders(<Beranda />);
  await fireEvent.press(screen.getByRole('switch', { name: 'AC kamar' }));
  expect(screen.getByText('AC kamar mati')).toBeTruthy();
});

test('Lihat di kartu persetujuan membuka chat', async () => {
  await renderWithProviders(<Beranda />);
  await fireEvent.press(screen.getByRole('button', { name: 'Lihat' }));
  expect(router.navigate).toHaveBeenCalledWith('/chat');
});

test('mode gelap tetap menampilkan isi yang sama', async () => {
  await renderWithProviders(<Beranda />, { scheme: 'dark' });
  expect(screen.getByText('Selamat pagi, Rina')).toBeTruthy();
  expect(StyleSheet.flatten(screen.getByText('Selamat pagi, Rina').props.style).color).toBe('#ECF2EA');
});

test('ketuk Inti membuka chat, tahan Inti membuka Mode Suara dengan getar', async () => {
  await renderWithProviders(<Beranda />);
  const inti = screen.getByRole('button', { name: 'Bicara dengan Nadia' });
  await fireEvent.press(inti);
  expect(router.navigate).toHaveBeenCalledWith('/chat');
  await fireEvent(inti, 'longPress');
  expect(Haptics.impactAsync).toHaveBeenCalled();
  expect(router.navigate).toHaveBeenCalledWith('/suara');
});

test('Lihat semua membuka Agenda', async () => {
  await renderWithProviders(<Beranda />);
  await fireEvent.press(screen.getByRole('link', { name: 'Lihat semua' }));
  expect(router.navigate).toHaveBeenCalledWith('/agenda');
});

test('AC dimatikan di penyimpanan: Beranda menulis AC kamar mati', async () => {
  await renderWithProviders(<Beranda />, { actions: [{ type: 'setAc', on: false }] });
  expect(screen.getByText('AC kamar mati')).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: 'AC kamar' })).toBeOnTheScreen();
});

test('suhu AC datang dari penyimpanan', async () => {
  await renderWithProviders(<Beranda />, { actions: [{ type: 'setAc', temp: 22 }] });
  expect(screen.getByText('AC kamar nyala · 22°')).toBeOnTheScreen();
});

test('kartu Rumah ikut keadaan perangkat yang diubah di layar lain', async () => {
  await renderWithProviders(<Beranda />);
  expect(screen.getByText('AC kamar nyala · 24°')).toBeOnTheScreen();
  expect(screen.getByText('Pintu depan terkunci')).toBeOnTheScreen();
  expect(screen.getByText('Kamera aktif')).toBeOnTheScreen();
});

test('pintu dibuka dan kamera dimatikan di Perangkat: Beranda ikut', async () => {
  await renderWithProviders(<Beranda />, {
    actions: [
      { type: 'toggleDevice', id: 'pintu-depan', on: false },
      { type: 'toggleDevice', id: 'kamera-tamu', on: false },
      { type: 'toggleDevice', id: 'ac-kamar', on: false },
    ],
  });
  expect(screen.getByText('Pintu depan terbuka')).toBeOnTheScreen();
  expect(screen.getByText('Kamera mati')).toBeOnTheScreen();
  expect(screen.getByText('AC kamar mati')).toBeOnTheScreen();
});

test('kartu persetujuan hilang setelah kiriman disetujui', async () => {
  await renderWithProviders(<Beranda />, { actions: [{ type: 'sendDraft', id: BUDI_DRAFT_ID }] });
  expect(screen.queryByText('Butuh persetujuan Anda')).not.toBeOnTheScreen();
});

test('kartu persetujuan menanyakan draf berikutnya yang belum disetujui', async () => {
  await renderWithProviders(<Beranda />, {
    actions: [
      { type: 'addDraft', draft: supplierOrderDraft },
      { type: 'sendDraft', id: BUDI_DRAFT_ID },
    ],
  });
  expect(screen.getByText('Butuh persetujuan Anda')).toBeOnTheScreen();
  expect(screen.getByText('Pesanan untuk PT Sumber Susu sudah siap. Kirim?')).toBeOnTheScreen();
});

test('cincin dan agenda membaca penyimpanan: layanan baru jadi simpul kedelapan', async () => {
  await renderWithProviders(<Beranda />, { actions: [{ type: 'connect', id: 'tiktok' }] });
  expect(screen.getByText('8 terhubung · CCTV tidak terjangkau')).toBeOnTheScreen();
});

test('cincin mengikuti layanan: memutus Imou menghapus simpul CCTV', async () => {
  await renderWithProviders(<Beranda />, { actions: [{ type: 'disconnect', id: 'imou' }] });
  expect(screen.getByText('6 terhubung')).toBeOnTheScreen();
  expect(screen.queryByTestId('simpul-offline-cctv')).not.toBeOnTheScreen();
});

test('agenda hari ini yang ditambah tampil di Beranda', async () => {
  await renderWithProviders(<Beranda />, {
    actions: [
      { type: 'addAgenda', item: { date: '2025-10-20', time: '08.00', title: 'Telepon Ibu', kind: 'reminder' } },
    ],
  });
  expect(screen.getByText('Telepon Ibu')).toBeOnTheScreen();
});

test('Agenda hari ini memuat item hari ini urut jam, dan item jam yang sama tidak bertabrakan', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  await renderWithProviders(<Beranda />, {
    actions: [
      { type: 'addAgenda', item: { date: TODAY, time: '09.00', title: 'Sarapan dengan Ibu', kind: 'reminder' } },
      { type: 'finishLeftover', choice: 'today' },
    ],
  });
  for (const t of ['Rapat dengan supplier susu', 'Sarapan dengan Ibu', 'Bayar listrik Kedai Dago']) {
    expect(screen.getByText(t)).toBeOnTheScreen();
  }
  // paling banyak tiga baris, tanpa tugas
  expect(screen.queryByText('Jemput Kayla les')).toBeNull();
  expect(screen.queryByText('Kirim penawaran katering ke Bu Sari')).toBeNull();
  expect(screen.getAllByText('09.00')).toHaveLength(2);
  expect(spy.mock.calls.some((c) => String(c[0]).includes('same key'))).toBe(false);
  spy.mockRestore();
});

test('tombol tempat membuka pemilih tempat', async () => {
  await renderWithProviders(<Beranda />);
  await fireEvent.press(screen.getByRole('button', { name: 'Tempat: Semua' }));
  expect(router.push).toHaveBeenCalledWith('/tempat');
});

test('kartu Agenda hari ini persis tiga baris desain 1a, tanpa tugas', async () => {
  await renderWithProviders(<Beranda />);
  for (const t of ['Rapat dengan supplier susu', 'Bayar listrik Kedai Dago', 'Jemput Kayla les']) {
    expect(screen.getByText(t)).toBeOnTheScreen();
  }
  expect(screen.queryByText('Cek stok Kedai Riau')).toBeNull();
  expect(screen.queryByText('Rapat manajer kedai')).toBeNull();
  expect(screen.getAllByText(/^\d\d\.\d\d$/).map((t) => t.props.children)).toEqual(['09.00', '13.00', '16.00']);
});

test('kartu Usaha mengikuti tempat: Kedai Dago dan Kedai Riau memakai angka kedai', async () => {
  await renderWithProviders(<Beranda />, { actions: [{ type: 'setPlace', place: 'Kedai Dago' }] });
  expect(screen.getByText('Rp2.610.000')).toBeTruthy();
  expect(screen.getByText('naik 9% dari Senin lalu')).toBeTruthy();
  expect(screen.getByText('Susu UHT tinggal 4 karton')).toBeTruthy();
  expect(screen.queryByText('Rp4.250.000')).toBeNull();
});

test('kartu Usaha di Kedai Riau menyebut yang menipis di kedai itu', async () => {
  await renderWithProviders(<Beranda />, { actions: [{ type: 'setPlace', place: 'Kedai Riau' }] });
  expect(screen.getByText('Rp1.640.000')).toBeTruthy();
  expect(screen.getByText('turun 4% dari Senin lalu')).toBeTruthy();
  expect(screen.getByText('Susu UHT tinggal 2 karton')).toBeTruthy();
});

test('kartu Usaha di Rumah memakai angka Semua', async () => {
  await renderWithProviders(<Beranda />, { actions: [{ type: 'setPlace', place: 'Rumah' }] });
  expect(screen.getByText('Rp4.250.000')).toBeTruthy();
  expect(screen.getByText('Susu UHT tinggal 6 karton')).toBeTruthy();
});

describe('Beranda lewat kontrak (server tiruan memegang data)', () => {
  const store = (api: ReturnType<typeof createTestApi>) => api.transport.sample;

  test('perubahan di data bersama (Perangkat, Agenda) sampai ke Beranda lewat event home', async () => {
    const api = createTestApi();
    await renderWithProviders(<Beranda />, { api });
    expect(screen.getByText('AC kamar nyala · 24°')).toBeOnTheScreen();
    await act(async () => {
      store(api).dispatch({ type: 'toggleDevice', id: 'ac-kamar', on: false });
      store(api).dispatch({
        type: 'addAgenda',
        item: { date: TODAY, time: '08.00', title: 'Telepon Ibu', kind: 'reminder' },
      });
    });
    expect(screen.getByText('AC kamar mati')).toBeOnTheScreen();
    expect(screen.getByText('Telepon Ibu')).toBeOnTheScreen();
    // tiga baris saja: yang terakhir (16.00) tergeser keluar
    expect(screen.queryByText('Jemput Kayla les')).toBeNull();
  });

  test('ganti tempat lewat server mengubah kartu Usaha dan tombol tempat', async () => {
    const api = createTestApi();
    await renderWithProviders(<Beranda />, { api });
    await act(async () => {
      const h = await api.transport.setPlace('Kedai Riau');
      expect(h.place).toBe('Kedai Riau');
    });
    expect(await screen.findByRole('button', { name: 'Tempat: Kedai Riau' })).toBeOnTheScreen();
    expect(screen.getByText('Rp1.640.000')).toBeOnTheScreen();
    expect(screen.getByText('turun 4% dari Senin lalu')).toBeOnTheScreen();
  });

  test('memilih tempat di /tempat mengganti Beranda', async () => {
    const api = createTestApi();
    await renderWithProviders(
      <>
        <Beranda />
        <Tempat />
      </>,
      { api },
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Kedai Dago' }));
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(screen.getByRole('button', { name: 'Tempat: Kedai Dago' })).toBeOnTheScreen();
    expect(screen.getByText('Rp2.610.000')).toBeOnTheScreen();
    expect((await api.transport.home()).place).toBe('Kedai Dago');
  });

  test('persetujuan muncul dan hilang mengikuti status draf', async () => {
    const api = createTestApi();
    await renderWithProviders(<Beranda />, { api });
    expect(screen.getByText('Butuh persetujuan Anda')).toBeOnTheScreen();
    await act(async () => {
      await api.transport.draftAction(BUDI_DRAFT_ID, { action: 'send' });
    });
    expect(screen.queryByText('Butuh persetujuan Anda')).not.toBeOnTheScreen();
    await act(async () => {
      store(api).dispatch({ type: 'addDraft', draft: supplierOrderDraft });
    });
    expect(screen.getByText('Pesanan untuk PT Sumber Susu sudah siap. Kirim?')).toBeOnTheScreen();
  });

  test('tanpa nama: sapaan netral', async () => {
    const api = createTestApi();
    jest.spyOn(api.transport, 'home').mockResolvedValue({ ...(await api.transport.home()), greetingName: null });
    await renderWithProviders(<Beranda />, { api });
    expect(await screen.findByText('Selamat pagi')).toBeOnTheScreen();
    expect(screen.queryByText(/Rina/)).toBeNull();
  });

  test('gagal memuat: kalimat ramah dan Coba lagi, lalu isi muncul', async () => {
    const api = createTestApi();
    jest.spyOn(api.transport, 'home').mockRejectedValueOnce(new ApiFailure('network'));
    await renderWithProviders(<Beranda />, { api });
    expect(await screen.findByText(ERROR_TEXT)).toBeOnTheScreen();
    expect(screen.queryByText('Agenda hari ini')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText('Selamat pagi, Rina')).toBeOnTheScreen();
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
  });

  test('tempat gagal diganti: toast ramah, tempat lama bertahan', async () => {
    const api = createTestApi();
    await renderWithProviders(<Tempat />, { api });
    jest.spyOn(api.transport, 'setPlace').mockRejectedValue(new ApiFailure('network'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Rumah' }));
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(store(api).getState().toast?.text).toBe(ERROR_TEXT);
  });

  test('mode gelap: kartu dari server tampil sama', async () => {
    const api = createTestApi();
    await renderWithProviders(<Beranda />, { api, scheme: 'dark' });
    await act(async () => {
      await api.transport.setPlace('Kedai Dago');
    });
    expect(StyleSheet.flatten(screen.getByText('Rp2.610.000').props.style).color).toBe('#ECF2EA');
  });
});

test('memilih tempat yang gagal di server mengembalikan pilihan semula dan memberi tahu', async () => {
  const api = createTestApi();
  await renderWithProviders(
    <>
      <Beranda />
      <Tempat />
    </>,
    { api },
  );
  api.transport.failNext('network');
  await fireEvent.press(screen.getByRole('radio', { name: 'Rumah' }));
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  // Pilihan sementara (penyimpanan contoh) dikembalikan; Beranda tetap di Semua.
  expect(api.transport.sample.getState().place).toBe('Semua');
  expect(api.transport.sample.getState().toast?.text).toBe(ERROR_TEXT);
});
