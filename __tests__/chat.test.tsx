import { act, fireEvent, screen, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import Chat from '../app/chat';
import { createTestApi, renderWithProviders } from './helpers';
import { formatJam } from '@/api/format';
import { wibIso } from '@/api/fake/clock';
import { BUDI_DRAFT_ID as BUDI, supplierOrderDraft } from '@/sample/outgoing';
import { deviceById, historyRows, useSample, type SampleState } from '@/sample/store';
import { QR_SIZE, qrCells } from '@/ui/chat/qrPattern';

let latest: SampleState;
function Probe() {
  const { state } = useSample();
  useEffect(() => {
    latest = state;
  }, [state]);
  return null;
}

/** Layar chat; riwayat dari server tiruan sudah dimuat. */
async function renderChat(options?: Parameters<typeof renderWithProviders>[1]) {
  const view = await renderWithProviders(
    <>
      <Chat />
      <Probe />
    </>,
    options,
  );
  for (let i = 0; i < 3; i++) await advance(0);
  return view;
}

/** Isi tiap elemen Text pada pohon yang tampil, menurut urutan pohon (anak-anaknya digabung). */
function textsInOrder(): string[] {
  const out: string[] = [];
  const flat = (n: unknown): string =>
    typeof n === 'string'
      ? n
      : n && typeof n === 'object'
        ? ((n as { children?: unknown[] }).children ?? []).map(flat).join('')
        : '';
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const node = n as { type?: string; children?: unknown[] };
    if (node.type === 'Text') out.push(flat(node));
    else node.children?.forEach(walk);
  };
  const tree = screen.toJSON();
  (Array.isArray(tree) ? tree : [tree]).forEach(walk);
  // Daftar chat terbalik: yang terbaru lebih dulu di pohon.
  return out;
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

/** Jam "HH.MM" WIB 20 Okt pada jam HP, seperti yang tampil di kartu. */
const jam = (hhmm: string) => formatJam(wibIso(10, 20, hhmm));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

test('utas contoh menampilkan semua pesan dan kartu, terbaru di bawah', async () => {
  await renderChat();
  // Satu teks per baris, dari yang terlama; daftar terbalik jadi urutan di pohon menurun.
  const order = [
    'Nyalakan AC kamar 24 derajat',
    'Sudah. AC kamar nyala di 24°.',
    'Perintah terakhir: 24° Dingin · suhu ruangan sekarang 27°',
    'Balas Pak Budi, harga sewa bisa Rp15 juta',
    'Ini draf balasannya. Saya kirim setelah Anda setuju.',
    'Selamat siang, Pak Budi. Untuk sewa tempatnya, kami bisa di harga Rp15 juta. Terima kasih.',
    'Rapat dengan supplier susu sudah saya catat.',
    'Harga susu UHT tetap sampai Desember.',
    'Laporan yang Anda minta sudah jadi.',
    'Laporan penjualan Oktober.xlsx',
    'Beli token listrik 100 ribu',
    'Token listrik PLN',
    'Bayar dengan QRIS',
    'Cek stok kedai',
  ];
  for (const t of order) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
  const shown = textsInOrder();
  const at = order.map((t) => shown.indexOf(t));
  expect(at.every((i) => i >= 0)).toBe(true);
  expect(at).toEqual([...at].sort((a, b) => b - a));
  for (const t of [
    '48 KB · Excel',
    'Sudah benar?',
    `Pindai dari aplikasi bank atau dompet digital. Berlaku sampai ${jam('10.15')}.`,
  ]) {
    expect(screen.getByText(t)).toBeTruthy();
  }
  expect(screen.getByText('Nadia ingat semua obrolan Anda, di aplikasi maupun di WhatsApp.')).toBeTruthy();
  expect(screen.getByText('Nyala · Dingin')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Buka' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Bagikan' })).toBeTruthy();
  expect(screen.queryByText(/Anda menjawab/)).toBeNull();
  expect(screen.getByTestId('qris-kode')).toBeTruthy();
  // "Ya, benar" sudah diambil: hanya pilihan itu yang tampil, terkunci
  expect(screen.queryByRole('button', { name: 'Batal' })).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Ya, benar' })[0]!.props.accessibilityState.disabled).toBe(true);
  expect(screen.queryByTestId('berpikir')).toBeNull();
  expect(screen.queryByText('Mau saya bantu urus apa?')).toBeNull();
  // dua pesan semalam lewat WhatsApp
  expect(screen.getAllByText('lewat WhatsApp').length).toBeGreaterThanOrEqual(2);
});

test('Kirim menahan kiriman dan mencatat Riwayat; Batalkan membatalkannya', async () => {
  await renderChat();
  expect(latest.outgoing[BUDI]!.status).toBe('draft');
  const before = latest.history.length;
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
  await advance(1);
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  expect(screen.getByText(`Dikirim ${jam('10.47')}`)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Kirim' })).toBeNull();
  expect(latest.outgoing[BUDI]!.status).toBe('held');
  expect(latest.history.length).toBe(before + 1);
  expect(historyRows(latest)[0]).toMatchObject({ title: 'Mengirim balasan ke Pak Budi', undoable: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
  await advance(1);
  expect(screen.getByText('Dibatalkan · tidak jadi terkirim')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Batalkan' })).toBeNull();
  expect(latest.outgoing[BUDI]!.status).toBe('cancelled');
  expect(latest.toast?.text).toBe('Kiriman ke Pak Budi dibatalkan.');
  expect(historyRows(latest)[0]).toMatchObject({ struck: true, undoable: false });
});

test('Buang draf membatalkan draf yang belum disetujui; Beranda tidak menanyakannya lagi', async () => {
  await renderChat();
  await fireEvent.press(screen.getByRole('button', { name: 'Buang draf' }));
  await advance(1);
  expect(screen.getByText('Dibatalkan · tidak jadi terkirim')).toBeTruthy();
  expect(latest.outgoing[BUDI]!.status).toBe('cancelled');
  expect(latest.history.length).toBe(6);
});

test('Ubah membuka kolom teks dan Simpan menyimpan isi baru', async () => {
  await renderChat();
  await fireEvent.press(screen.getByRole('button', { name: 'Ubah' }));
  const box = screen.getByLabelText('Isi pesan');
  await fireEvent.changeText(box, 'Baik Pak, Rp15 juta ya.');
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
  await advance(1);
  expect(latest.outgoing[BUDI]!.text).toBe('Baik Pak, Rp15 juta ya.');
  expect(screen.getByText('Baik Pak, Rp15 juta ya.')).toBeTruthy();
  expect(screen.queryByLabelText('Isi pesan')).toBeNull();
  expect(screen.getByRole('button', { name: 'Kirim' })).toBeTruthy();
});

test('tombol suhu dibatasi 16 sampai 30 dan sakelar mematikan AC', async () => {
  await renderChat();
  for (let i = 0; i < 12; i++) await fireEvent.press(screen.getByRole('button', { name: 'Turunkan suhu' }));
  expect(deviceById(latest, 'ac-kamar')!.ac!.temp).toBe(16);
  expect(screen.getByText('16°')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Turunkan suhu' }).props.accessibilityState.disabled).toBe(true);
  for (let i = 0; i < 20; i++) await fireEvent.press(screen.getByRole('button', { name: 'Naikkan suhu' }));
  expect(deviceById(latest, 'ac-kamar')!.ac!.temp).toBe(30);
  expect(screen.getByText('Perintah terakhir: 30° Dingin · suhu ruangan sekarang 27°')).toBeTruthy();
  await fireEvent.press(screen.getByRole('switch', { name: 'AC kamar' }));
  expect(deviceById(latest, 'ac-kamar')!.on).toBe(false);
  expect(screen.getByText('Mati')).toBeTruthy();
});

test('mengetik lalu kirim menambah gelembung, tanda berpikir, dan jawaban setelah 1,2 detik', async () => {
  await renderChat();
  expect(screen.getByRole('button', { name: 'Bicara' })).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Tulis pesan untuk Nadia'), 'Halo Nadia');
  expect(screen.queryByRole('button', { name: 'Bicara' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim pesan' }));
  expect(screen.getByText('Halo Nadia')).toBeTruthy();
  expect(screen.getByLabelText('Tulis pesan untuk Nadia').props.value).toBe('');
  await advance(1);
  expect(screen.getAllByTestId('berpikir')).toHaveLength(1);
  await advance(1100);
  expect(screen.queryByText(/Ini jawaban contoh/)).toBeNull();
  await advance(100);
  expect(screen.getByText('Ini jawaban contoh. Begitu tersambung ke server, saya menjawab sungguhan.')).toBeTruthy();
  expect(screen.queryByTestId('berpikir')).toBeNull();
});

test('kartu perangkat membaca AC yang ditunjuk pesannya', async () => {
  const api = createTestApi({
    history: [
      {
        id: 'x1',
        seq: 1,
        rev: 1,
        at: wibIso(10, 20, '10.00'),
        from: 'assistant',
        via: 'app',
        parts: [{ type: 'card', card: { kind: 'device', deviceId: 'dago-ac', name: 'AC kedai', on: true, temp: 23 } }],
      },
    ],
  });
  await renderChat({ api });
  expect(screen.getByText('AC kedai')).toBeOnTheScreen();
  expect(screen.getByText('23°')).toBeOnTheScreen();
  expect(screen.getByText('Perintah terakhir: 23° Dingin · suhu ruangan sekarang 28°')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Naikkan suhu' }));
  expect(deviceById(latest, 'dago-ac')!.ac!.temp).toBe(24);
  expect(deviceById(latest, 'ac-kamar')!.ac!.temp).toBe(24);
  await fireEvent.press(screen.getByRole('switch', { name: 'AC kedai' }));
  expect(deviceById(latest, 'dago-ac')!.on).toBe(false);
  expect(deviceById(latest, 'ac-kamar')!.on).toBe(true);
});

test('permintaan AC lewat chat mengatur AC yang sama di penyimpanan contoh', async () => {
  await renderChat();
  await fireEvent.changeText(screen.getByLabelText('Tulis pesan untuk Nadia'), 'AC kamar 22 derajat');
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim pesan' }));
  await advance(1300);
  await advance(1);
  expect(screen.getByText('Sudah. AC kamar nyala di 22°.')).toBeTruthy();
  expect(deviceById(latest, 'ac-kamar')!.ac!.temp).toBe(22);
  expect(screen.getAllByText('22°').length).toBeGreaterThan(0);
});

test('draf kedua dari layar lain tampil sebagai kartu sendiri; Kirim hanya mengubah draf itu', async () => {
  await renderChat({ actions: [{ type: 'addDraft', draft: supplierOrderDraft }] });
  expect(screen.getByText('PT Sumber Susu')).toBeOnTheScreen();
  expect(screen.getByText('Ini draf pesanannya. Saya kirim setelah Anda setuju.')).toBeOnTheScreen();
  expect(screen.getByText(supplierOrderDraft.text)).toBeOnTheScreen();
  expect(screen.queryByTestId('berpikir')).toBeNull();
  const kirim = screen.getAllByRole('button', { name: 'Kirim' });
  expect(kirim).toHaveLength(2);
  // yang terbaru lebih dulu di pohon
  await fireEvent.press(kirim[0]!);
  await advance(1);
  expect(screen.getByText(`Dikirim ${jam('10.47')}`)).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: 'Kirim' })).toHaveLength(1);
  const supplier = Object.values(latest.outgoing).find((o) => o.to === 'PT Sumber Susu')!;
  expect(supplier.status).toBe('held');
  expect(latest.outgoing[BUDI]!.status).toBe('draft');
});

test('kolom ketik kosong: tombol mic membuka Mode Suara', async () => {
  await renderChat();
  await fireEvent.press(screen.getByRole('button', { name: 'Bicara' }));
  expect(router.replace).toHaveBeenCalledWith('/suara');
});

test('kosong=1 menampilkan keadaan kosong tanpa kartu', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ kosong: '1' });
  await renderChat();
  expect(screen.getByText('Mau saya bantu urus apa?')).toBeTruthy();
  expect(screen.queryByText('Token listrik PLN')).toBeNull();
  expect(screen.queryByTestId('berpikir')).toBeNull();
});

test('mengetuk saran mengisi kolom ketik; mengirimnya keluar dari keadaan kosong', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ kosong: '1' });
  await renderChat();
  await fireEvent.press(screen.getByRole('button', { name: 'Cek stok kedai' }));
  expect(screen.getByLabelText('Tulis pesan untuk Nadia').props.value).toBe('Cek stok kedai');
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim pesan' }));
  expect(screen.queryByText('Mau saya bantu urus apa?')).toBeNull();
  expect(within(screen.getByTestId('utas')).getByText('Cek stok kedai')).toBeTruthy();
});

test('pola QR contoh selalu sama dan punya tiga mata penjuru', () => {
  const a = qrCells();
  expect(qrCells()).toEqual(a);
  const has = (x: number, y: number) => a.some((c) => c.x === x && c.y === y);
  const N = QR_SIZE;
  for (const [ox, oy] of [
    [0, 0],
    [N - 7, 0],
    [0, N - 7],
  ]) {
    expect(has(ox, oy)).toBe(true); // sudut bingkai
    expect(has(ox + 6, oy + 6)).toBe(true);
    expect(has(ox + 3, oy + 3)).toBe(true); // inti
    expect(has(ox + 1, oy + 1)).toBe(false); // cincin kosong
  }
  // jalur kosong di sekeliling mata penjuru
  expect(has(7, 0)).toBe(false);
  expect(has(0, 7)).toBe(false);
  expect(has(N - 8, 0)).toBe(false);
  expect(has(0, N - 8)).toBe(false);
  expect(a.length).toBeGreaterThan(150);
});

test('tidak ada tombol mati: Baca notulen, Buka, Bagikan, dan Lampiran memunculkan toast', async () => {
  await renderChat();
  await fireEvent.press(screen.getByRole('link', { name: 'Baca notulen' }));
  expect(latest.toast?.text).toBe('Notulen lengkap tampil di Fase 1.');
  await fireEvent.press(screen.getByRole('button', { name: 'Buka' }));
  await advance(0);
  expect(latest.toast?.text).toBe('Membuka berkas contoh.');
  await fireEvent.press(screen.getByRole('button', { name: 'Bagikan' }));
  expect(latest.toast?.text).toBe('Berbagi berkas dibangun di Fase 1.');
  await fireEvent.press(screen.getByRole('button', { name: 'Lampiran' }));
  expect(latest.toast?.text).toBe('Lampiran dibangun di Fase 1.');
});

test('mic: mint dengan ikon hijau di utas, hijau penuh dengan ikon putih di keadaan kosong', async () => {
  const { light } = jest.requireActual('@/theme/tokens');
  await renderChat();
  expect(screen.getByRole('button', { name: 'Bicara' })).toHaveStyle({ backgroundColor: light.mint });
  expect(within(screen.getByRole('button', { name: 'Bicara' })).getByTestId('ikon-mic').props.stroke).toBe(light.green);
});

test('mic di keadaan kosong: latar hijau, ikon putih', async () => {
  const { light } = jest.requireActual('@/theme/tokens');
  jest.mocked(useLocalSearchParams).mockReturnValue({ kosong: '1' });
  await renderChat();
  expect(screen.getByRole('button', { name: 'Bicara' })).toHaveStyle({ backgroundColor: light.green });
  expect(within(screen.getByRole('button', { name: 'Bicara' })).getByTestId('ikon-mic').props.stroke).toBe(
    light.onGreen,
  );
});

test('Kirim diumumkan ke pembaca layar; pengatur suhu bisa disetel dengan aksi naik dan turun', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  await renderChat();
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
  await advance(1);
  expect(announce).toHaveBeenCalledWith(`Dikirim ${jam('10.47')}, bisa dibatalkan`);
  announce.mockRestore();
  const stepper = screen.getByRole('adjustable');
  expect(stepper.props.accessibilityValue).toEqual({ text: '24 derajat' });
  await fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  expect(deviceById(latest, 'ac-kamar')!.ac!.temp).toBe(25);
  await fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(deviceById(latest, 'ac-kamar')!.ac!.temp).toBe(24);
});

test('gelembung pengguna yang membuka tukar-pesan baru diberi jarak atas 8', async () => {
  await renderChat();
  const margin = (text: string) =>
    screen
      .getAllByText(text)
      .map((n) => Object.assign({}, ...[n.parent?.props.style].flat(5)).marginTop)
      .find((m) => m !== undefined);
  expect(margin('Nyalakan AC kamar 24 derajat')).toBe(8);
  expect(margin('Balas Pak Budi, harga sewa bisa Rp15 juta')).toBe(8);
  // jawaban atas tombol pilihan masih tukar-pesan yang sama
  expect(margin('Ya, benar')).toBe(0);
});

test('bertanya keadaan AC dijawab dari Beranda tanpa mengubahnya dan tanpa catatan Riwayat', async () => {
  await renderChat({ actions: [{ type: 'setAc', deviceId: 'ac-kamar', on: false }] });
  expect(deviceById(latest, 'ac-kamar')!.on).toBe(false);
  const before = latest;
  await fireEvent.changeText(screen.getByLabelText('Tulis pesan untuk Nadia'), 'AC kamar gimana?');
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim pesan' }));
  await advance(1300);
  await advance(1);
  expect(screen.getByText('AC kamar sedang mati.')).toBeOnTheScreen();
  expect(deviceById(latest, 'ac-kamar')).toEqual(deviceById(before, 'ac-kamar'));
  expect(latest.history).toEqual(before.history);
});

test('meminta AC menyala mengubah Beranda sekali; meminta hal yang sama lagi tidak menambah catatan', async () => {
  await renderChat({ actions: [{ type: 'setAc', deviceId: 'ac-kamar', on: false }] });
  const ask = async (text: string) => {
    await fireEvent.changeText(screen.getByLabelText('Tulis pesan untuk Nadia'), text);
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim pesan' }));
    await advance(1300);
    await advance(1);
  };
  await ask('Nyalakan AC kamar 23 derajat');
  expect(deviceById(latest, 'ac-kamar')).toMatchObject({ on: true, ac: { temp: 23 } });
  const count = latest.history.length;
  await ask('Nyalakan AC kamar 23 derajat');
  expect(latest.history.length).toBe(count);
});

test('masa tahan lima menit habis: Riwayat berhenti menawarkan Batalkan dan menandai terkirim', async () => {
  jest.mocked(useIsFocused).mockReturnValue(false);
  await renderChat();
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
  await advance(1);
  expect(historyRows(latest)[0]).toMatchObject({ undoable: true, sent: false });
  await advance(5 * 60_000);
  expect(latest.outgoing[BUDI]!.status).toBe('sent');
  expect(historyRows(latest)[0]).toMatchObject({ undoable: false, struck: false, sent: true });
  expect(screen.getByText(/^Terkirim \d\d\.\d\d$/)).toBeOnTheScreen();
  jest.mocked(useIsFocused).mockReturnValue(true);
});
