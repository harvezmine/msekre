import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useEffect } from 'react';
import Tambah from '../app/perangkat/tambah';
import Perangkat from '../app/(tabs)/perangkat';
import Beranda from '../app/(tabs)/index';
import { ERROR_TEXT } from '@/api/errors';
import type { Device } from '@/api/contract';
import { ApiFailure } from '@/api/transport';
import { createTestApi, renderWithProviders, stateAfter, toastNow, useSample } from './helpers';
import { dark, light } from '@/theme/tokens';
import { deviceById, deviceStatus, houseCard, type SampleState } from '@/sample/store';
import { gridRows } from '@/ui/device/grid';
import { tileToggles, tileWord } from '@/ui/device/present';

// Perangkat (papan 16): segmen ruangan, ubin besar bervariasi; ketuk ubin sakelar = nyala/mati, ubin lain dan tahan =
// remote.

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
const remoteOf = (id: string) => ({ pathname: '/perangkat/[id]', params: { id } });

test('Rumah: segmen Semua terpilih, ubin AC lebar dengan 24°, Kotak, lampu, kamera bergambar, kunci', async () => {
  await show();
  expect(screen.getByRole('tab', { name: 'Semua' })).toBeSelected();
  for (const r of ['Ruang tamu', 'Kamar', 'Dapur', 'Teras'])
    expect(screen.getByRole('tab', { name: r })).toBeOnTheScreen();
  const ac = screen.getByRole('switch', { name: 'AC kamar' });
  expect(ac).toBeChecked();
  expect(ac.props.accessibilityValue).toEqual({ text: 'Dingin' });
  expect(screen.getByLabelText('24 derajat')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Kotak Sekretaris AI, Mic nyala' })).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: 'Lampu utama' }).props.accessibilityValue).toEqual({ text: '80%' });
  expect(screen.getByRole('switch', { name: 'TV ruang tamu' }).props.accessibilityValue).toEqual({ text: 'Vol 18' });
  expect(screen.getByRole('switch', { name: 'Speaker dapur' }).props.accessibilityValue).toEqual({ text: 'Memutar' });
  expect(screen.getByTestId('batang-putar', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Kamera ruang tamu, Merekam' })).toBeOnTheScreen();
  expect(await screen.findByLabelText('Gambar terakhir Kamera ruang tamu')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Pintu depan, Terkunci' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Tirai ruang tamu, 60%' })).toBeOnTheScreen();
  // Satu atau dua kata keadaan, tanpa kalimat keterangan.
  expect(screen.queryByText(/lewat|Tidak terjangkau sejak/)).toBeNull();
  // Ubin menyala hijau lembut, mati netral.
  expect(StyleSheet.flatten(screen.getByTestId('ubin-lampu-utama').props.style).backgroundColor).toBe(light.brandSoft);
  expect(StyleSheet.flatten(screen.getByTestId('ubin-lampu-kamar').props.style).backgroundColor).toBe(light.surface);
});

test('pindah ruangan: Kamar menampilkan AC tanpa Kotak; Ruang tamu memuat Kotak', async () => {
  await show();
  await fireEvent.press(screen.getByRole('tab', { name: 'Kamar' }));
  expect(screen.getByRole('tab', { name: 'Kamar' })).toBeSelected();
  expect(screen.getByRole('switch', { name: 'AC kamar' })).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: 'Kipas kamar anak' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /^Kotak Sekretaris AI/ })).toBeNull();
  expect(screen.queryByRole('switch', { name: 'Lampu utama' })).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Ruang tamu' }));
  expect(screen.getByRole('button', { name: 'Kotak Sekretaris AI, Mic nyala' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('tab', { name: 'Teras' }));
  expect(screen.getByRole('switch', { name: 'Lampu teras' })).toBeOnTheScreen();
});

test('ketuk ubin sakelar mengubah keadaan, dan baris rumah Beranda mengikuti', async () => {
  await show();
  expect(status('lampu-utama')).toBe('Nyala · 80%');
  await fireEvent.press(screen.getByRole('switch', { name: 'Lampu utama' }));
  expect(status('lampu-utama')).toBe('Mati');
  expect(screen.getByRole('switch', { name: 'Lampu utama' })).not.toBeChecked();
  expect(router.push).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('switch', { name: 'AC kamar' }));
  expect(status('ac-kamar')).toBe('Mati');
  expect(houseCard(latest)[0]!.text).toBe('AC kamar mati');
});

test('tahan ubin (atau aksi pembaca layar) membuka remote; ketuk ubin yang bukan sakelar juga', async () => {
  await show();
  await fireEvent(screen.getByRole('switch', { name: 'AC kamar' }), 'longPress');
  expect(router.push).toHaveBeenLastCalledWith(remoteOf('ac-kamar'));
  await fireEvent(screen.getByRole('switch', { name: 'Lampu utama' }), 'accessibilityAction', {
    nativeEvent: { actionName: 'longpress' },
  });
  expect(router.push).toHaveBeenLastCalledWith(remoteOf('lampu-utama'));
  // Kunci, kamera, tirai, dan Kotak: ketuk membuka remote, tidak pernah mengubah keadaan.
  await fireEvent.press(screen.getByRole('button', { name: 'Pintu depan, Terkunci' }));
  expect(router.push).toHaveBeenLastCalledWith(remoteOf('pintu-depan'));
  await fireEvent.press(screen.getByRole('button', { name: 'Kamera ruang tamu, Merekam' }));
  expect(router.push).toHaveBeenLastCalledWith(remoteOf('kamera-tamu'));
  await fireEvent.press(screen.getByRole('button', { name: 'Kotak Sekretaris AI, Mic nyala' }));
  expect(router.push).toHaveBeenLastCalledWith(remoteOf('kotak-ruang-tamu'));
  expect(status('pintu-depan')).toBe('Terkunci');
  expect(status('kamera-tamu')).toBe('Merekam');
});

test('perangkat tidak terjangkau: "Terputus", titik koral, bukan sakelar, ketuk membuka remote', async () => {
  await show();
  const tile = screen.getByRole('button', { name: 'Lampu sudut, Terputus' });
  expect(screen.getByTestId('titik-tak-terjangkau')).toBeOnTheScreen();
  expect(screen.queryByRole('switch', { name: 'Lampu sudut' })).toBeNull();
  await fireEvent.press(tile);
  expect(router.push).toHaveBeenCalledWith(remoteOf('lampu-sudut'));
});

test('tombol tambah ke Tambah perangkat; tempat kecil di kepala membuka pemilih tempat', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Tambah perangkat' }));
  expect(router.push).toHaveBeenCalledWith('/perangkat/tambah');
  await fireEvent.press(screen.getByRole('button', { name: 'Tempat: Rumah' }));
  expect(router.push).toHaveBeenCalledWith('/tempat');
  // Akun hanya di Beranda.
  expect(screen.queryByRole('button', { name: 'Akun' })).toBeNull();
});

test('rutinitas Saya pulang: satu ketukan, lampu teras nyala, AC kamar 25°, riwayat, toast', async () => {
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

test('Kedai Dago: ruangan kedai, tanpa Kotak', async () => {
  await show({ actions: [{ type: 'setPlace', place: 'Kedai Dago' }] });
  expect(screen.getByRole('tab', { name: 'Semua' })).toBeSelected();
  expect(screen.getByRole('switch', { name: 'Lampu kedai' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /^Kotak Sekretaris AI/ })).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Kasir' }));
  expect(screen.getByRole('button', { name: /^CCTV kasir, / })).toBeOnTheScreen();
  expect(screen.queryByRole('switch', { name: 'Lampu kedai' })).toBeNull();
});

test('Semua tempat: segmen per tempat; di Semua, nama tempat sebagai pemisah', async () => {
  await show({ actions: [] });
  expect(screen.getByRole('button', { name: 'Tempat: Semua' })).toBeOnTheScreen();
  for (const p of ['Rumah', 'Kedai Dago', 'Kedai Riau']) {
    expect(screen.getByRole('header', { name: p })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: p })).toBeOnTheScreen();
  }
  expect(screen.getByRole('switch', { name: 'Lampu teras' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('tab', { name: 'Kedai Riau' }));
  expect(screen.getByRole('switch', { name: 'Lampu gudang' })).toBeOnTheScreen();
  expect(screen.queryByRole('switch', { name: 'Lampu teras' })).toBeNull();
  expect(screen.queryByRole('header', { name: 'Kedai Riau' })).toBeNull();
});

test('mode gelap: judul dan ubin menyala memakai palet gelap (arang dengan cahaya hijau)', async () => {
  await show({ actions: rumah }, 'dark');
  expect(screen.getByRole('header', { name: 'Perangkat' })).toHaveStyle({ color: dark.text });
  expect(StyleSheet.flatten(screen.getByTestId('ubin-lampu-utama').props.style).backgroundColor).toBe(dark.surface);
  expect(screen.getAllByTestId('cahaya-nyala').length).toBeGreaterThan(0);
});

test('kisi: AC menyala selebar layar di atas, Kotak di depan, tidak terjangkau paling akhir', () => {
  const base = { place: 'Rumah', room: 'Kamar', icon: 'bulb', on: true, reachable: true, capabilities: [], state: {} };
  const d = (o: Partial<Device>) => ({ ...base, id: 'x', name: 'X', kind: 'lamp', status: 'Nyala', ...o }) as Device;
  const rows = gridRows(
    [
      d({ id: 'a' }),
      d({ id: 'mati', reachable: false }),
      d({ id: 'ac', kind: 'ac', state: { temp: 24 } }),
      d({ id: 'b' }),
      d({ id: 'c' }),
    ],
    { deviceId: 'k', online: true, micOn: true, speaker: 'S', roomTemp: 27, humidity: 60 },
  );
  const ids = rows.map((r) =>
    r.type === 'wide'
      ? `lebar:${r.item.type === 'device' ? r.item.device.id : 'kotak'}`
      : r.items.map((i) => (i.type === 'device' ? i.device.id : 'kotak')).join('+'),
  );
  expect(ids).toEqual(['lebar:ac', 'kotak+a', 'b+c', 'mati']);
});

test('kata ubin dan siapa yang langsung bersakelar', () => {
  const base = { place: 'Rumah', room: 'Kamar', icon: 'bulb', on: true, reachable: true, status: 'Nyala' };
  const d = (o: Partial<Device>) =>
    ({ ...base, id: 'x', name: 'X', kind: 'lamp', capabilities: [{ type: 'power' }], state: {}, ...o }) as Device;
  expect(tileWord(d({ state: { brightness: 60 } }))).toBe('60%');
  expect(tileWord(d({ kind: 'tv', state: { volume: 18 } }))).toBe('Vol 18');
  expect(tileWord(d({ kind: 'tv', state: { volume: 18, muted: true } }))).toBe('Bisu');
  expect(tileWord(d({ kind: 'speaker', state: { playing: false } }))).toBe('Jeda');
  expect(tileWord(d({ kind: 'plug', state: { powerW: 12.5 } }))).toBe('12,5 W');
  expect(tileWord(d({ kind: 'curtain', state: { position: 0 } }))).toBe('Tertutup');
  expect(tileWord(d({ on: false }))).toBe('Mati');
  expect(tileWord(d({ reachable: false }))).toBe('Terputus');
  expect(tileToggles(d({}))).toBe(true);
  expect(tileToggles(d({ sensitive: true }))).toBe(false);
  expect(tileToggles(d({ kind: 'lock', capabilities: [{ type: 'lock' }] }))).toBe(false);
  expect(tileToggles(d({ kind: 'camera' }))).toBe(false);
  expect(tileToggles(d({ kind: 'curtain', capabilities: [{ type: 'position' }] }))).toBe(false);
  expect(tileToggles(d({ reachable: false }))).toBe(false);
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

test('kendali gagal: ubin dikembalikan dan toast ramah muncul', async () => {
  const api = createTestApi({ sample: stateAfter(rumah) });
  await show({ actions: rumah, api });
  jest.spyOn(api.transport, 'controlDevice').mockRejectedValue(new ApiFailure('network'));
  await fireEvent.press(screen.getByRole('switch', { name: 'Lampu utama' }));
  await act(async () => {});
  expect(status('lampu-utama')).toBe('Nyala · 80%');
  expect(screen.getByRole('switch', { name: 'Lampu utama' })).toBeChecked();
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

test('pengguna tanpa rutinitas: baris rutinitas tidak ada', async () => {
  const api = createTestApi({ sample: stateAfter(rumah) });
  jest.spyOn(api.transport, 'devices').mockImplementation(async (place) => {
    const res = await (Object.getPrototypeOf(api.transport) as typeof api.transport).devices.call(api.transport, place);
    return { ...res, routines: [] };
  });
  await show({ actions: rumah, api });
  expect(screen.getByRole('switch', { name: 'Lampu utama' })).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: 'Rutinitas' })).toBeNull();
});

test('sakelar AC Beranda dan kartu chat lewat controlDevice di mode contoh', async () => {
  const api = createTestApi();
  const spy = jest.spyOn(api.transport, 'controlDevice');
  await renderWithProviders(<Beranda />, { api });
  await fireEvent.press(await screen.findByRole('switch', { name: 'AC kamar' }));
  expect(spy).toHaveBeenCalledWith('ac-kamar', { on: false });
  expect(screen.getByRole('switch', { name: 'AC kamar' })).not.toBeChecked();
});
