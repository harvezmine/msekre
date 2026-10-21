import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import RemotePerangkat from '../app/perangkat/[id]';
import { createTestApi, renderWithProviders, stateAfter, toastNow, useSample } from './helpers';
import type { Device } from '@/api/contract';
import { DEBOUNCE_MS } from '@/api/devicesController';
import { DEVICE_NOT_SUPPORTED_TEXT } from '@/api/errors';
import { ApiFailure } from '@/api/transport';
import { deviceById, initialSampleState, type SampleState } from '@/sample/store';
import { dark } from '@/theme/tokens';
import { ASSUMED_TEXT } from '@/ui/remote';
import { capsOf, remoteKindOf } from '@/ui/remote/caps';
import { coverColors, hslHex } from '@/ui/remote/CoverArt';
import { kelvinColor, lightTint } from '@/ui/remote/light';

// Remote virtual per jenis (papan 12–15 dan §7): kontrol utama yang sesuai kemampuan, sisanya di Lainnya, aturan
// keamanan (PIN, "buka kunci?") tetap.

beforeEach(() => jest.clearAllMocks());
afterAll(() => jest.mocked(useLocalSearchParams).mockReturnValue({}));

let latest: SampleState;
function Probe() {
  const { state } = useSample();
  useEffect(() => {
    latest = state;
  });
  return null;
}
const dev = (id: string) => deviceById(latest, id)!;
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(DEBOUNCE_MS);
  });
const step = (name: 'increment' | 'decrement') => ({ nativeEvent: { actionName: name } });
const openMore = async () => {
  await fireEvent.press(screen.getByRole('button', { name: 'Lainnya' }));
  return screen.getByTestId('lembar-lainnya');
};
/** Lembar menutup (200 ms) lalu aksinya jalan. */
const afterSheet = () =>
  act(async () => {
    jest.advanceTimersByTime(300);
  });

async function show(id: string, options: Parameters<typeof renderWithProviders>[1] = {}) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id });
  return renderWithProviders(
    <>
      <RemotePerangkat />
      <Probe />
    </>,
    options,
  );
}

describe('TV', () => {
  test('layar utama: daya hijau, Sumber, D-pad dengan OK, kembali/beranda/menu, VOL, bisu, CH; angka hanya di Lainnya', async () => {
    await show('tv-ruang-tamu');
    expect(screen.getByRole('switch', { name: 'Daya' })).toBeChecked();
    for (const b of [
      'Sumber',
      'Atas',
      'Bawah',
      'Kiri',
      'Kanan',
      'OK',
      'Kembali di TV',
      'Beranda di TV',
      'Menu di TV',
    ]) {
      expect(screen.getByRole('button', { name: b })).toBeOnTheScreen();
    }
    for (const b of ['Volume naik', 'Volume turun', 'Channel naik', 'Channel turun', 'Bisukan']) {
      expect(screen.getByRole('button', { name: b })).toBeOnTheScreen();
    }
    expect(screen.queryByRole('button', { name: 'Angka 1' })).toBeNull();
    // TV lewat inframerah: tanda kecil "Perkiraan".
    expect(screen.getByLabelText('Keadaan perkiraan')).toBeOnTheScreen();
  });

  test('tombol remote dikirim sebagai control({ key }); volume naik terlihat di keadaan', async () => {
    const api = createTestApi();
    const spy = jest.spyOn(api.transport, 'controlDevice');
    await show('tv-ruang-tamu', { api });
    await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Atas' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Kembali di TV' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Volume naik' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Channel naik' }));
    expect(spy.mock.calls.map(([, req]) => req)).toEqual([
      { key: 'ok' },
      { key: 'up' },
      { key: 'back' },
      { key: 'vol_up' },
      { key: 'ch_up' },
    ]);
    expect(dev('tv-ruang-tamu').extra).toMatchObject({ volume: 19, channel: 13 });
    await fireEvent.press(screen.getByRole('button', { name: 'Bisukan' }));
    expect(spy).toHaveBeenLastCalledWith('tv-ruang-tamu', { muted: true });
    expect(screen.getByRole('button', { name: 'Bisukan' })).toBeSelected();
  });

  test('Lainnya: papan angka mengetik channel; Sumber memilih input lewat lembar pilihan', async () => {
    const api = createTestApi();
    const spy = jest.spyOn(api.transport, 'controlDevice');
    await show('tv-ruang-tamu', { api });
    const sheet = await openMore();
    expect(within(sheet).getByTestId('papan-angka')).toBeOnTheScreen();
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Angka 4' }));
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Angka 2' }));
    expect(spy.mock.calls.map(([, req]) => req)).toEqual([{ key: '4' }, { key: '2' }]);
    expect(dev('tv-ruang-tamu').extra?.channel).toBe(42);
    expect(within(sheet).getByRole('switch', { name: 'Favorit' })).toBeChecked();
    expect(within(sheet).getByText(ASSUMED_TEXT)).toBeOnTheScreen();
    await fireEvent(sheet, 'requestClose');
    await afterSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Sumber' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'HDMI 2' }));
    await afterSheet();
    expect(spy).toHaveBeenLastCalledWith('tv-ruang-tamu', { source: 'hdmi2' });
  });

  test('TV mati: tombol selain daya diredupkan dan tidak bisa ditekan', async () => {
    const api = createTestApi({ sample: stateAfter([{ type: 'toggleDevice', id: 'tv-ruang-tamu', on: false }]) });
    const spy = jest.spyOn(api.transport, 'controlDevice');
    await show('tv-ruang-tamu', { api });
    expect(screen.getByRole('switch', { name: 'Daya' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
    expect(spy).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('switch', { name: 'Daya' }));
    expect(spy).toHaveBeenCalledWith('tv-ruang-tamu', { on: true });
  });

  test('tombol yang tidak dimiliki perangkat: teks ramah tidak_didukung', async () => {
    const api = createTestApi();
    jest
      .spyOn(api.transport, 'controlDevice')
      .mockRejectedValue(new ApiFailure('not_supported', { status: 400, error: 'tidak_didukung' }));
    await show('tv-ruang-tamu', { api });
    await fireEvent.press(screen.getByRole('button', { name: 'Menu di TV' }));
    await act(async () => {});
    expect(toastNow()?.text).toBe(DEVICE_NOT_SUPPORTED_TEXT);
  });
});

describe('Speaker', () => {
  test('sampul, judul, penyanyi, sebelumnya / jeda / berikutnya, volume; sumber hanya di Lainnya', async () => {
    await show('speaker-dapur');
    expect(screen.getByTestId('sampul', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Bengawan Solo')).toBeOnTheScreen();
    expect(screen.getByText('Keroncong')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Jeda' })).toBeOnTheScreen();
    expect(screen.getByRole('adjustable', { name: 'Volume' }).props.accessibilityValue.now).toBe(40);
    expect(screen.queryByText('Sumber')).toBeNull();
    expect(screen.queryByLabelText('Keadaan perkiraan')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Jeda' }));
    expect(dev('speaker-dapur').extra?.playing).toBe(false);
    expect(screen.getByRole('button', { name: 'Putar' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Berikutnya' }));
    expect(screen.getByText('Rumah Kita')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sebelumnya' }));
    expect(screen.getByText('Bengawan Solo')).toBeOnTheScreen();
  });

  test('volume digeser: angka langsung, server menerima nilai akhir setelah jeda', async () => {
    const api = createTestApi();
    const spy = jest.spyOn(api.transport, 'controlDevice');
    await show('speaker-dapur', { api });
    const vol = () => screen.getByRole('adjustable', { name: 'Volume' });
    await fireEvent(vol(), 'accessibilityAction', step('increment'));
    await fireEvent(vol(), 'accessibilityAction', step('increment'));
    expect(vol().props.accessibilityValue.now).toBe(50);
    expect(spy).not.toHaveBeenCalled();
    await settle();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('speaker-dapur', { volume: 50 });
  });

  test('Lainnya: Sumber, Bisu, Daya, Favorit', async () => {
    await show('speaker-dapur');
    const sheet = await openMore();
    expect(within(sheet).getByRole('button', { name: 'Sumber, Bluetooth' })).toBeOnTheScreen();
    expect(within(sheet).getByRole('switch', { name: 'Bisu' })).not.toBeChecked();
    expect(within(sheet).getByRole('switch', { name: 'Daya' })).toBeChecked();
    expect(within(sheet).getByRole('switch', { name: 'Favorit' })).not.toBeChecked();
  });

  test('speaker mati: putar sekaligus menyalakan', async () => {
    const api = createTestApi({ sample: stateAfter([{ type: 'toggleDevice', id: 'speaker-dapur', on: false }]) });
    const spy = jest.spyOn(api.transport, 'controlDevice');
    await show('speaker-dapur', { api });
    expect(screen.getByText('Mati')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Putar' }));
    expect(spy).toHaveBeenCalledWith('speaker-dapur', { on: true, playback: 'play' });
    expect(dev('speaker-dapur').on).toBe(true);
  });

  test('warna sampul tetap per judul', () => {
    expect(coverColors('Bengawan Solo')).toEqual(coverColors('Bengawan Solo'));
    expect(coverColors('Bengawan Solo').top).not.toBe(coverColors('Rumah Kita').top);
    expect(hslHex(0, 100, 50)).toBe('#FF0000');
    expect(hslHex(120, 100, 25)).toBe('#008000');
  });
});

describe('Lampu', () => {
  test('bola lampu, 80%, penggeser tegak, daya; suhu warna dan warna tidak ada bila lampu tidak punya', async () => {
    await show('lampu-utama');
    expect(screen.getByTestId('bola-lampu', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('80%')).toBeOnTheScreen();
    expect(screen.getByRole('adjustable', { name: 'Terang' }).props.accessibilityValue).toMatchObject({ now: 80 });
    expect(screen.getByRole('switch', { name: 'Daya' })).toBeChecked();
    expect(screen.getByTestId('cahaya-lampu')).toBeOnTheScreen();
    const sheet = await openMore();
    expect(within(sheet).queryByText('Suhu')).toBeNull();
    expect(within(sheet).queryByTestId('pilihan-warna')).toBeNull();
    expect(within(sheet).getByRole('switch', { name: 'Favorit' })).not.toBeChecked();
  });

  test('terang digeser lalu dikirim sekali setelah jeda; mati: tanpa cahaya', async () => {
    const api = createTestApi();
    const spy = jest.spyOn(api.transport, 'controlDevice');
    await show('lampu-utama', { api });
    const slider = () => screen.getByRole('adjustable', { name: 'Terang' });
    await fireEvent(slider(), 'accessibilityAction', step('decrement'));
    await fireEvent(slider(), 'accessibilityAction', step('decrement'));
    expect(screen.getByLabelText('70%')).toBeOnTheScreen();
    await settle();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('lampu-utama', { brightness: 70 });
    expect(dev('lampu-utama').level).toBe(70);
    await fireEvent.press(screen.getByRole('switch', { name: 'Daya' }));
    expect(dev('lampu-utama').on).toBe(false);
    expect(screen.queryByTestId('cahaya-lampu')).toBeNull();
  });

  test('menggeser lampu yang mati menyalakannya sekali, lalu terangnya setelah jeda', async () => {
    const api = createTestApi();
    const spy = jest.spyOn(api.transport, 'controlDevice');
    await show('lampu-kamar', { api });
    await fireEvent(screen.getByRole('adjustable', { name: 'Terang' }), 'accessibilityAction', step('increment'));
    await settle();
    expect(spy.mock.calls.map(([, req]) => req)).toEqual([{ on: true }, { brightness: 65 }]);
    expect(dev('lampu-kamar').on).toBe(true);
  });

  test('suhu warna di Lainnya (lampu teras): Dingin mengirim 6500 K', async () => {
    const api = createTestApi();
    const spy = jest.spyOn(api.transport, 'controlDevice');
    await show('lampu-teras', { api });
    const sheet = await openMore();
    expect(within(sheet).getByRole('tab', { name: 'Hangat' })).toBeSelected();
    await fireEvent.press(within(sheet).getByRole('tab', { name: 'Dingin' }));
    expect(spy).toHaveBeenCalledWith('lampu-teras', { colorTemp: 6500 });
    expect(dev('lampu-teras').extra?.colorTemp).toBe(6500);
  });

  test('warna di Lainnya (lampu kamar): pilihan bulat, Biru dipilih', async () => {
    await show('lampu-kamar');
    const sheet = await openMore();
    expect(within(sheet).getByRole('radio', { name: 'Putih' })).toBeChecked();
    await fireEvent.press(within(sheet).getByRole('radio', { name: 'Biru' }));
    expect(dev('lampu-kamar').extra?.color).toBe('biru');
    expect(within(sheet).getByRole('radio', { name: 'Biru' })).toBeChecked();
  });

  test('warna cahaya: putih hangat bawaan, suhu warna, warna pilihan', () => {
    expect(lightTint({}, []).stops).toEqual(['#FFE0A6', '#FFC979', '#F5A04F']);
    expect(kelvinColor(2700)).toBe('#F5A04F');
    expect(kelvinColor(9000)).toBe('#BFD5F5');
    const blue = lightTint({ color: 'biru' }, [
      { type: 'color', presets: [{ id: 'biru', label: 'Biru', hex: '#4D8DFF' }] },
    ]);
    expect(blue.stops[2]).toBe('#4D8DFF');
  });
});

describe('Kipas, colokan, tirai', () => {
  test('kipas: kecepatan besar (yang aktif terpilih), ayun, daya; timer hanya di Lainnya', async () => {
    await show('kipas-kamar-anak');
    expect(screen.getByRole('button', { name: 'Kecepatan 2' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Ayun' })).toBeSelected();
    expect(screen.getByRole('switch', { name: 'Daya' })).toBeChecked();
    expect(screen.queryByText('Timer')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Kecepatan 3' }));
    expect(dev('kipas-kamar-anak').extra?.fan).toBe('3');
    await fireEvent.press(screen.getByRole('button', { name: 'Ayun' }));
    expect(dev('kipas-kamar-anak').extra?.swing).toBe(false);
    const sheet = await openMore();
    expect(within(sheet).getByRole('button', { name: 'Timer, Mati' })).toBeOnTheScreen();
  });

  test('colokan: satu tombol daya besar, watt sekarang dan kWh hari ini sebagai angka', async () => {
    await show('colokan-mesin-cuci');
    expect(screen.getByLabelText('450 watt')).toBeOnTheScreen();
    expect(screen.getByLabelText('Hari ini 1,2 kWh')).toBeOnTheScreen();
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('switch', { name: 'Daya' }));
    expect(dev('colokan-mesin-cuci').on).toBe(false);
    expect(screen.getByLabelText('0 watt')).toBeOnTheScreen();
  });

  test('tirai: posisi 60%, penggeser tegak, Tutup dan Buka', async () => {
    const api = createTestApi();
    const spy = jest.spyOn(api.transport, 'controlDevice');
    await show('tirai-ruang-tamu', { api });
    expect(screen.getByLabelText('60%')).toBeOnTheScreen();
    const slider = () => screen.getByRole('adjustable', { name: 'Bukaan tirai' });
    await fireEvent(slider(), 'accessibilityAction', step('increment'));
    await settle();
    expect(spy).toHaveBeenCalledWith('tirai-ruang-tamu', { position: 65 });
    await fireEvent.press(screen.getByRole('button', { name: 'Tutup' }));
    expect(spy).toHaveBeenLastCalledWith('tirai-ruang-tamu', { position: 0 });
    expect(dev('tirai-ruang-tamu').extra?.position).toBe(0);
    expect(screen.getByRole('button', { name: 'Tutup' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Buka' }));
    expect(dev('tirai-ruang-tamu').extra?.position).toBe(100);
  });
});

describe('Kunci dan kamera (aksi yang dijaga)', () => {
  test('kunci: gembok besar, Terkunci; Buka bertanya dulu saat PIN mati, tanpa mengirim apa pun', async () => {
    const api = createTestApi();
    const spy = jest.spyOn(api.transport, 'controlDevice');
    await show('pintu-depan', { api });
    expect(screen.getByTestId('gembok', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Terkunci')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Buka' }));
    await act(async () => {});
    expect(router.push).toHaveBeenCalledWith({ pathname: '/buka-kunci', params: { id: 'pintu-depan' } });
    expect(spy).not.toHaveBeenCalled();
    expect(dev('pintu-depan').on).toBe(true);
    const sheet = await openMore();
    expect(within(sheet).getByText('Baterai')).toBeOnTheScreen();
    expect(within(sheet).getByText('64%')).toBeOnTheScreen();
  });

  test('kunci dengan PIN aktif: Buka membuka lembar PIN; mengunci lagi tidak perlu PIN', async () => {
    const api = createTestApi({
      security: { pinEnabled: true, pin: '123456' },
      sample: stateAfter([{ type: 'toggleDevice', id: 'pintu-depan', on: false }]),
    });
    await show('pintu-depan', { api });
    expect(screen.getByText('Terbuka')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Kunci' }));
    expect(dev('pintu-depan').on).toBe(true);
    expect(router.push).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Buka' }));
    await act(async () => {});
    expect(router.push).toHaveBeenCalledWith({ pathname: '/pin', params: { id: 'pintu-depan' } });
    expect(dev('pintu-depan').on).toBe(true);
  });

  test('kamera: gambar terakhir dan titik rekam; privasi langsung saat PIN mati, rekam lagi tanpa PIN', async () => {
    const api = createTestApi();
    const spy = jest.spyOn(api.transport, 'controlDevice');
    await show('kamera-tamu', { api });
    expect(await screen.findByLabelText('Gambar terakhir Kamera ruang tamu')).toBeOnTheScreen();
    expect(screen.getByTestId('titik-rekam')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Rekam' })).toBeChecked();
    await fireEvent.press(screen.getByRole('switch', { name: 'Rekam' }));
    expect(spy).toHaveBeenCalledWith('kamera-tamu', { privacy: true });
    expect(dev('kamera-tamu').on).toBe(false);
    expect(screen.getByTestId('kamera-privasi')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('switch', { name: 'Rekam' }));
    expect(spy).toHaveBeenLastCalledWith('kamera-tamu', { privacy: false });
    expect(dev('kamera-tamu').on).toBe(true);
  });

  test('kamera dengan PIN aktif: privasi membuka lembar PIN, kamera tetap merekam', async () => {
    const api = createTestApi({ security: { pinEnabled: true, pin: '123456' } });
    const spy = jest.spyOn(api.transport, 'controlDevice');
    await show('kamera-tamu', { api });
    await fireEvent.press(screen.getByRole('switch', { name: 'Rekam' }));
    await act(async () => {});
    expect(router.push).toHaveBeenCalledWith({ pathname: '/pin', params: { id: 'kamera-tamu' } });
    expect(spy).not.toHaveBeenCalled();
    expect(dev('kamera-tamu').on).toBe(true);
  });

  test('server meminta PIN (428) walau aplikasi mengira tidak: lembar PIN, keadaan dikembalikan', async () => {
    const api = createTestApi({ security: { pinEnabled: false } });
    jest
      .spyOn(api.transport, 'controlDevice')
      .mockRejectedValue(new ApiFailure('pin_required', { status: 428, error: 'pin_diperlukan' }));
    await show('kamera-tamu', { api });
    await fireEvent.press(screen.getByRole('switch', { name: 'Rekam' }));
    await act(async () => {});
    expect(router.push).toHaveBeenCalledWith({ pathname: '/pin', params: { id: 'kamera-tamu' } });
    expect(screen.getByRole('switch', { name: 'Rekam' })).toBeChecked();
  });
});

describe('Sensor, Kotak, perangkat lain', () => {
  test('sensor: bacaan besar dan baterai, tanpa kontrol dan tanpa Lainnya', async () => {
    await show('sensor-dapur');
    expect(screen.getByLabelText('Suhu 27,5 derajat')).toBeOnTheScreen();
    expect(screen.getByLabelText('Kelembapan 64%')).toBeOnTheScreen();
    expect(screen.getByLabelText('Baterai 82%')).toBeOnTheScreen();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lainnya' })).toBeNull();
  });

  test('Kotak: Online, suhu dan kelembapan, mic besar bergantian; speaker di Lainnya', async () => {
    await show('kotak-ruang-tamu');
    expect(screen.getByText('Online')).toBeOnTheScreen();
    expect(screen.getByLabelText('Suhu 27 derajat')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Mic' })).toBeChecked();
    const before = latest.history.length;
    await fireEvent.press(screen.getByRole('switch', { name: 'Mic' }));
    expect(latest.boxMic).toBe(false);
    expect(latest.history[0]).toMatchObject({ title: 'Mematikan mic Kotak Sekretaris AI', kind: 'rumah' });
    expect(latest.history).toHaveLength(before + 1);
    expect(screen.getByText('Mic mati', { includeHiddenElements: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('switch', { name: 'Mic' }));
    expect(latest.boxMic).toBe(true);
    const sheet = await openMore();
    expect(within(sheet).getByText('JBL Ruang Tamu')).toBeOnTheScreen();
    expect(within(sheet).queryByRole('switch', { name: 'Favorit' })).toBeNull();
  });

  test('Kotak: mic gagal dikembalikan dengan toast', async () => {
    const api = createTestApi();
    jest.spyOn(api.transport, 'setBoxMic').mockRejectedValue(new ApiFailure('network'));
    await show('kotak-ruang-tamu', { api });
    await fireEvent.press(screen.getByRole('switch', { name: 'Mic' }));
    await act(async () => {});
    expect(screen.getByRole('switch', { name: 'Mic' })).toBeChecked();
    expect(toastNow()?.text).toBeTruthy();
  });

  test('perangkat jenis lain: ikon, keadaan, dan daya saja', async () => {
    const base = initialSampleState.devices.find((d) => d.id === 'lampu-dapur')!;
    const state = {
      ...initialSampleState,
      devices: [
        ...initialSampleState.devices,
        { ...base, id: 'pengharum', name: 'Pengharum', kind: 'lain' as const, icon: 'sparkle' as const, on: true },
      ],
    };
    await show('pengharum', { state });
    expect(screen.getByRole('header', { name: 'Pengharum' })).toBeOnTheScreen();
    expect(screen.getByText('Nyala')).toBeOnTheScreen();
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('switch', { name: 'Daya' }));
    expect(dev('pengharum').on).toBe(false);
  });
});

describe('keadaan umum', () => {
  test('tidak terjangkau: kontrol redup dan tersembunyi, satu baris dan Coba lagi memuat ulang', async () => {
    const api = createTestApi();
    const load = jest.spyOn(api.transport, 'devices');
    await show('lampu-sudut', { api });
    expect(screen.getByText('Tidak terjangkau')).toBeOnTheScreen();
    expect(screen.queryByRole('switch', { name: 'Daya' })).toBeNull();
    expect(screen.queryByRole('adjustable')).toBeNull();
    const calls = load.mock.calls.length;
    await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
    await act(async () => {});
    expect(load.mock.calls.length).toBe(calls + 1);
  });

  test('Favorit di Lainnya menyematkan lampu ke Beranda', async () => {
    const api = createTestApi();
    const spy = jest.spyOn(api.transport, 'setDeviceFavorite');
    await show('lampu-utama', { api });
    await openMore();
    await fireEvent.press(screen.getByRole('switch', { name: 'Favorit' }));
    await act(async () => {});
    expect(spy).toHaveBeenCalledWith('lampu-utama', true);
    expect(dev('lampu-utama').favorite).toBe(true);
  });

  test('Favorit gagal: dikembalikan dengan toast', async () => {
    const api = createTestApi();
    jest.spyOn(api.transport, 'setDeviceFavorite').mockRejectedValue(new ApiFailure('network'));
    await show('lampu-utama', { api });
    await openMore();
    await fireEvent.press(screen.getByRole('switch', { name: 'Favorit' }));
    await act(async () => {});
    expect(screen.getByRole('switch', { name: 'Favorit' })).not.toBeChecked();
    expect(toastNow()?.text).toBeTruthy();
  });

  test('mode gelap: judul memakai warna teks gelap, daya menyala hijau gelap', async () => {
    await show('lampu-utama', { scheme: 'dark' });
    expect(screen.getByRole('header', { name: 'Lampu utama' })).toHaveStyle({ color: dark.text });
    expect(screen.getByTestId('tombol-daya')).toHaveStyle({ backgroundColor: dark.brand });
  });
});

describe('pemilih tata letak dan kemampuan lama', () => {
  const d = (o: Partial<Device>): Device => ({
    id: 'x',
    place: 'Rumah',
    room: 'Kamar',
    name: 'X',
    icon: 'bulb',
    kind: 'other',
    on: true,
    reachable: true,
    capabilities: [],
    state: {},
    status: 'Nyala',
    ...o,
  });

  test('jenis menentukan tata letak; jenis lain menurut kemampuannya; tanpa petunjuk: daya saja', () => {
    expect(remoteKindOf(d({ kind: 'ac' }))).toBe('ac');
    expect(remoteKindOf(d({ kind: 'box' }))).toBe('box');
    expect(remoteKindOf(d({ capabilities: [{ type: 'keys', keys: ['ok'] }] }))).toBe('tv');
    expect(remoteKindOf(d({ capabilities: [{ type: 'playback' }] }))).toBe('speaker');
    expect(remoteKindOf(d({ capabilities: [{ type: 'brightness', min: 0, max: 100 }] }))).toBe('lamp');
    expect(remoteKindOf(d({ capabilities: [{ type: 'lock' }] }))).toBe('lock');
    expect(remoteKindOf(d({ capabilities: [{ type: 'power' }] }))).toBe('basic');
  });

  test('server lama tanpa capabilities: AC mendapat suhu, mode, kipas; lampu dengan level mendapat terang', () => {
    const types = (x: Device) => capsOf(x).map((c) => c.type);
    expect(types(d({ kind: 'ac', ac: { temp: 24, mode: 'Dingin', fan: 'Otomatis' } }))).toEqual([
      'power',
      'temperature',
      'mode',
      'fan',
    ]);
    expect(types(d({ kind: 'lamp', level: 40 }))).toEqual(['power', 'brightness']);
    expect(types(d({ kind: 'lamp' }))).toEqual(['power']);
    expect(types(d({ kind: 'lock' }))).toEqual(['lock']);
    expect(types(d({ kind: 'sensor' }))).toEqual([]);
  });
});
