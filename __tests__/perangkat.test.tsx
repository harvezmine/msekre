import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import Tambah from '../app/perangkat/tambah';
import Perangkat from '../app/(tabs)/perangkat';
import Beranda from '../app/(tabs)/index';
import { ERROR_TEXT } from '@/api/errors';
import { ApiFailure } from '@/api/transport';
import { createTestApi, renderWithProviders, stateAfter, toastNow, useSample } from './helpers';
import { dark } from '@/theme/tokens';
import { deviceById, deviceStatus, houseCard, type SampleState } from '@/sample/store';

beforeEach(() => jest.clearAllMocks());

let latest: SampleState;
function Probe() {
  const { state } = useSample();
  useEffect(() => {
    latest = state;
  });
  return null;
}
const rumah = [{ type: 'setPlace', place: 'Rumah' } as const];

async function show(actions: Parameters<typeof renderWithProviders>[1] = { actions: rumah }, scheme?: 'dark') {
  await renderWithProviders(
    <>
      <Perangkat />
      <Probe />
    </>,
    { ...actions, scheme },
  );
}
const status = (id: string) => deviceStatus(deviceById(latest, id)!);

test('Rumah: tab Ruang tamu, kartu Kotak, dan ubin ruang tamu', async () => {
  await show();
  expect(screen.getByRole('tab', { name: 'Ruang tamu' })).toBeSelected();
  expect(screen.getByText('Kotak Sekretaris AI')).toBeOnTheScreen();
  expect(screen.getByText('Mic menyala')).toBeOnTheScreen();
  expect(screen.getByText('JBL Ruang Tamu')).toBeOnTheScreen();
  expect(screen.getByText('27°')).toBeOnTheScreen();
  expect(screen.getByText('68%')).toBeOnTheScreen();
  for (const n of ['Lampu utama', 'Lampu sudut', 'Kamera ruang tamu', 'Pintu depan']) {
    expect(screen.getByText(n)).toBeOnTheScreen();
  }
  expect(screen.queryByText('Lampu teras')).toBeNull();
});

test('pindah ruangan: Kamar menampilkan AC dan tanpa kartu Kotak', async () => {
  await show();
  await fireEvent.press(screen.getByRole('tab', { name: 'Kamar' }));
  expect(screen.getByRole('tab', { name: 'Kamar' })).toBeSelected();
  // Teks ubin AC disembunyikan dari pembaca layar; tombol bukanya yang membacakan nama dan keadaan.
  expect(screen.getByRole('button', { name: 'AC kamar, Nyala · 24°' })).toBeOnTheScreen();
  expect(screen.getByText('AC kamar', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.queryByText('Kotak Sekretaris AI')).toBeNull();
  expect(screen.queryByText('Lampu utama')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Teras' }));
  expect(screen.getByText('Lampu teras')).toBeOnTheScreen();
});

test('Matikan mic bergantian dengan Nyalakan', async () => {
  await show();
  const before = latest.history.length;
  await fireEvent.press(screen.getByRole('button', { name: 'Matikan mic' }));
  expect(latest.boxMic).toBe(false);
  expect(latest.history[0]).toMatchObject({ title: 'Mematikan mic Kotak Sekretaris AI', kind: 'rumah' });
  expect(latest.history).toHaveLength(before + 1);
  expect(screen.getByText('Mic mati')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Nyalakan mic' }));
  expect(latest.boxMic).toBe(true);
  expect(latest.history[0]).toMatchObject({ title: 'Menyalakan mic Kotak Sekretaris AI', kind: 'rumah' });
  expect(screen.getByText('Mic menyala')).toBeOnTheScreen();
});

test('sakelar ubin mengubah keadaan, dan baris rumah Beranda mengikuti', async () => {
  await show();
  expect(status('lampu-utama')).toBe('Nyala · 80%');
  await fireEvent.press(screen.getByRole('switch', { name: 'Lampu utama, Nyala · 80%' }));
  expect(status('lampu-utama')).toBe('Mati');
  expect(screen.getByText('Mati')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('tab', { name: 'Kamar' }));
  await fireEvent.press(screen.getByRole('switch', { name: 'AC kamar, Nyala · 24°' }));
  expect(status('ac-kamar')).toBe('Mati');
  expect(houseCard(latest)[0]!.text).toBe('AC kamar mati');
});

test('perangkat tidak terjangkau: abu-abu dengan titik clay dan tanpa sakelar', async () => {
  await show();
  expect(screen.getByText('Tidak terjangkau sejak 10.12')).toBeOnTheScreen();
  expect(screen.getByTestId('titik-tak-terjangkau')).toBeOnTheScreen();
  expect(screen.queryByRole('switch', { name: 'Lampu sudut' })).toBeNull();
  expect(screen.getAllByRole('switch')).toHaveLength(4);
});

test('PIN mati (bawaan): kamera, alarm, dan pintu langsung dijalankan tanpa lembar PIN', async () => {
  await show();
  await fireEvent.press(screen.getByRole('switch', { name: /^Kamera ruang tamu, / }));
  expect(router.push).not.toHaveBeenCalled();
  expect(status('kamera-tamu')).toBe('Mati');
  // Membuka kunci tetap bertanya dulu (bukan PIN): lembar "Buka kunci Pintu depan?" dan kuncinya belum berubah.
  await fireEvent.press(screen.getByRole('switch', { name: /^Pintu depan, / }));
  await act(async () => {});
  expect(router.push).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith({ pathname: '/buka-kunci', params: { id: 'pintu-depan' } });
  expect(deviceById(latest, 'pintu-depan')!.on).toBe(true);
});

test('PIN dihidupkan: mematikan kamera membuka lembar PIN, bukan langsung mati', async () => {
  const api = createTestApi({ security: { pinEnabled: true, pin: '123456' } });
  await show({ actions: rumah, api });
  await fireEvent.press(screen.getByRole('switch', { name: /^Kamera ruang tamu, / }));
  await act(async () => {});
  expect(router.push).toHaveBeenCalledWith({ pathname: '/pin', params: { id: 'kamera-tamu' } });
  expect(status('kamera-tamu')).toBe('Merekam');
  // Perangkat yang tidak dijaga tetap langsung.
  await fireEvent.press(screen.getByRole('switch', { name: 'Lampu utama, Nyala · 80%' }));
  expect(status('lampu-utama')).toBe('Mati');
});

test('PIN dihidupkan tapi keadaannya tak terbaca (tanpa sinyal): tetap minta PIN', async () => {
  const api = createTestApi({ security: { pinEnabled: false } });
  jest.spyOn(api.transport, 'security').mockRejectedValue(new Error('network'));
  await show({ actions: rumah, api });
  await fireEvent.press(screen.getByRole('switch', { name: /^Kamera ruang tamu, / }));
  await act(async () => {});
  expect(router.push).toHaveBeenCalledWith({ pathname: '/pin', params: { id: 'kamera-tamu' } });
  expect(status('kamera-tamu')).toBe('Merekam');
});

test('menyalakan kembali kamera yang mati tidak minta PIN', async () => {
  await show({ actions: [...rumah, { type: 'toggleDevice', id: 'kamera-tamu', on: false }] });
  await fireEvent.press(screen.getByRole('switch', { name: /^Kamera ruang tamu, / }));
  expect(router.push).not.toHaveBeenCalled();
  expect(status('kamera-tamu')).toBe('Merekam');
});

test('mengetuk ubin AC membuka detailnya', async () => {
  await show();
  await fireEvent.press(screen.getByRole('tab', { name: 'Kamar' }));
  await fireEvent.press(screen.getByRole('button', { name: 'AC kamar, Nyala · 24°' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/perangkat/[id]', params: { id: 'ac-kamar' } });
});

test('tombol tambah ke Tambah perangkat; avatar membuka Akun', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Tambah perangkat' }));
  expect(router.push).toHaveBeenCalledWith('/perangkat/tambah');
  await fireEvent.press(screen.getByRole('button', { name: 'Akun' }));
  expect(router.push).toHaveBeenCalledWith('/akun');
});

test('rutinitas Saya pulang: lampu teras nyala, AC kamar 25°, riwayat, toast', async () => {
  await show({ actions: [...rumah, { type: 'toggleDevice', id: 'lampu-teras', on: false }] });
  const before = latest.history.length;
  await fireEvent.press(screen.getByRole('button', { name: 'Jalankan Saya pulang' }));
  expect(status('lampu-teras')).toBe('Nyala · 70%');
  expect(status('ac-kamar')).toBe('Nyala · 25°');
  expect(latest.history.length).toBeGreaterThan(before);
  expect(toastNow()?.text).toBe('Rutinitas Saya pulang dijalankan.');
});

test('rutinitas Tidur: lampu rumah mati, AC 26°, pintu terkunci', async () => {
  await show({ actions: [...rumah, { type: 'toggleDevice', id: 'pintu-depan', on: false }] });
  await fireEvent.press(screen.getByRole('button', { name: 'Jalankan Tidur' }));
  expect(status('lampu-utama')).toBe('Mati');
  expect(status('lampu-teras')).toBe('Mati');
  expect(status('ac-kamar')).toBe('Nyala · 26°');
  expect(status('pintu-depan')).toBe('Terkunci');
  expect(status('lampu-sudut')).toBe('Tidak terjangkau sejak 10.12');
});

test('rutinitas Tutup kedai: lampu dan AC kedai mati, CCTV merekam', async () => {
  await show({
    actions: [
      { type: 'setPlace', place: 'Kedai Dago' },
      { type: 'toggleDevice', id: 'dago-cctv', on: false },
      { type: 'toggleDevice', id: 'riau-lampu', on: true },
    ],
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Jalankan Tutup kedai' }));
  expect(status('dago-lampu')).toBe('Mati');
  expect(status('dago-ac')).toBe('Mati');
  expect(status('dago-cctv')).toBe('Merekam');
  expect(toastNow()?.text).toBe('Rutinitas Tutup kedai dijalankan di Kedai Dago.');
  // Kedai Riau tidak tersentuh saat Kedai Dago dipilih.
  expect(status('riau-lampu')).toBe('Nyala');
});

test('rutinitas Tutup kedai di Semua: kedua kedai, rumah tidak', async () => {
  await show({ actions: [{ type: 'toggleDevice', id: 'riau-lampu', on: true }] });
  await fireEvent.press(screen.getByRole('button', { name: 'Jalankan Tutup kedai' }));
  expect(status('dago-lampu')).toBe('Mati');
  expect(status('riau-lampu')).toBe('Mati');
  expect(status('lampu-teras')).toBe('Nyala · 70%');
  expect(toastNow()?.text).toBe('Rutinitas Tutup kedai dijalankan di semua kedai.');
});

test('Kedai Dago menampilkan perangkat kedai, tanpa kartu Kotak', async () => {
  await show({ actions: [{ type: 'setPlace', place: 'Kedai Dago' }] });
  expect(screen.getByRole('tab', { name: 'Dalam kedai' })).toBeSelected();
  expect(screen.getByText('Lampu kedai')).toBeOnTheScreen();
  expect(screen.getByText('AC kedai', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.queryByText('Kotak Sekretaris AI')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Kasir' }));
  expect(screen.getByText('CCTV kasir')).toBeOnTheScreen();
});

test('Semua: judul tempat sebagai pemisah dan tanpa tab ruangan', async () => {
  await show({ actions: [] });
  expect(screen.queryByRole('tab')).toBeNull();
  for (const p of ['Rumah', 'Kedai Dago', 'Kedai Riau']) {
    expect(screen.getByRole('header', { name: p })).toBeOnTheScreen();
  }
  expect(screen.getByText('Lampu teras')).toBeOnTheScreen();
  expect(screen.getByText('Lampu gudang')).toBeOnTheScreen();
});

test('mode gelap: judul memakai warna teks palet gelap', async () => {
  await show({ actions: rumah }, 'dark');
  expect(screen.getByText('Perangkat')).toHaveStyle({ color: dark.text });
});

test('Tambah perangkat: kartu Kotak dan sembilan merek dengan toast', async () => {
  await renderWithProviders(
    <>
      <Tambah />
      <Probe />
    </>,
  );
  expect(screen.getByText('Atau pilih merek perangkat')).toBeOnTheScreen();
  expect(screen.getByText('Home Assistant')).toBeOnTheScreen();
  expect(screen.getByText('eW')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Philips Hue' }));
  expect(toastNow()?.text).toBe('Masuk ke akun Philips Hue segera hadir.');
  await fireEvent.press(screen.getByRole('button', { name: 'Pasang Kotak' }));
  expect(toastNow()?.text).toBe('Pemasangan lewat Bluetooth segera hadir.');
  await act(async () => {});
});

test('Tambah perangkat di mode server: toast netral, tanpa menyebut fase', async () => {
  await renderWithProviders(
    <>
      <Tambah />
      <Probe />
    </>,
    { api: createTestApi({ mode: 'server', token: 'tok' }) },
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Philips Hue' }));
  expect(toastNow()?.text).toBe('Masuk ke akun Philips Hue segera hadir.');
  await fireEvent.press(screen.getByRole('button', { name: 'Pasang Kotak' }));
  expect(toastNow()?.text).toBe('Pemasangan lewat Bluetooth segera hadir.');
  await act(async () => {});
});

test('kendali gagal: sakelar dikembalikan dan toast ramah muncul', async () => {
  const api = createTestApi({ sample: stateAfter(rumah) });
  await show({ actions: rumah, api });
  jest.spyOn(api.transport, 'controlDevice').mockRejectedValue(new ApiFailure('network'));
  await fireEvent.press(screen.getByRole('switch', { name: 'Lampu utama, Nyala · 80%' }));
  await act(async () => {});
  expect(status('lampu-utama')).toBe('Nyala · 80%');
  expect(screen.getByRole('switch', { name: 'Lampu utama, Nyala · 80%' })).toBeOnTheScreen();
  expect(toastNow()?.text).toBe(ERROR_TEXT);
});

test('mic Kotak gagal: kembali seperti semula dan toast', async () => {
  const api = createTestApi({ sample: stateAfter(rumah) });
  await show({ actions: rumah, api });
  jest.spyOn(api.transport, 'setBoxMic').mockRejectedValue(new ApiFailure('network'));
  await fireEvent.press(screen.getByRole('button', { name: 'Matikan mic' }));
  await act(async () => {});
  expect(screen.getByText('Mic menyala')).toBeOnTheScreen();
  expect(toastNow()?.text).toBe(ERROR_TEXT);
});

test('rutinitas gagal: toast ramah, perangkat tidak berubah', async () => {
  const api = createTestApi({ sample: stateAfter(rumah) });
  await show({ actions: rumah, api });
  jest.spyOn(api.transport, 'runRoutine').mockRejectedValue(new ApiFailure('network'));
  await fireEvent.press(screen.getByRole('button', { name: 'Jalankan Tidur' }));
  await act(async () => {});
  expect(toastNow()?.text).toBe(ERROR_TEXT);
  expect(status('lampu-utama')).toBe('Nyala · 80%');
});

test('server menjawab pin_diperlukan walau aplikasi mengira tidak: lembar PIN dibuka dan kamera dikembalikan', async () => {
  const api = createTestApi({ sample: stateAfter(rumah), security: { pinEnabled: false } });
  await show({ actions: rumah, api });
  jest
    .spyOn(api.transport, 'controlDevice')
    .mockRejectedValue(new ApiFailure('pin_required', { status: 428, error: 'pin_diperlukan' }));
  await fireEvent.press(screen.getByRole('switch', { name: /^Kamera ruang tamu, / }));
  await act(async () => {});
  expect(router.push).toHaveBeenCalledWith({ pathname: '/pin', params: { id: 'kamera-tamu' } });
  expect(status('kamera-tamu')).toBe('Merekam');
});

test('sakelar AC Beranda dan kartu chat lewat controlDevice di mode contoh', async () => {
  const api = createTestApi();
  const spy = jest.spyOn(api.transport, 'controlDevice');
  await renderWithProviders(<Beranda />, { api });
  await fireEvent.press(await screen.findByRole('switch', { name: 'AC kamar' }));
  expect(spy).toHaveBeenCalledWith('ac-kamar', { on: false });
  expect(screen.getByRole('switch', { name: 'AC kamar' })).not.toBeChecked();
});
