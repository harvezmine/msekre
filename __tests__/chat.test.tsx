import { act, fireEvent, screen, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import Chat from '../app/chat';
import { renderWithProviders } from './helpers';
import { BUDI_DRAFT_ID as BUDI, supplierOrderDraft } from '@/sample/outgoing';
import { deviceById, historyRows, initialSampleState, useSample, type SampleState } from '@/sample/store';
import { QR_SIZE, qrCells } from '@/ui/chat/qrPattern';

let latest: SampleState;
function Probe() {
  const { state } = useSample();
  useEffect(() => {
    latest = state;
  }, [state]);
  return null;
}

async function renderChat(options?: Parameters<typeof renderWithProviders>[1]) {
  return renderWithProviders(
    <>
      <Chat />
      <Probe />
    </>,
    options,
  );
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

test('utas contoh menampilkan semua pesan dan kartu berurutan', async () => {
  await renderChat();
  const order = [
    'Nyalakan AC kamar 24 derajat',
    'Sudah. AC kamar nyala di 24°.',
    'Perintah terakhir: 24° Dingin · suhu ruangan sekarang 27°',
    'Balas Pak Budi, harga sewa bisa Rp15 juta',
    'Ini draf balasannya. Saya kirim setelah Anda setuju.',
    'lewat WhatsApp',
    'Selamat siang, Pak Budi. Untuk sewa tempatnya, kami bisa di harga Rp15 juta. Terima kasih.',
    'Rapat dengan supplier susu sudah saya catat.',
    'Harga susu UHT tetap sampai Desember.',
    'Baca notulen',
    'Laporan yang Anda minta sudah jadi.',
    'Laporan penjualan Oktober.xlsx',
    '48 KB · Excel',
    'Beli token listrik 100 ribu',
    'Token listrik PLN',
    'Sudah benar?',
    'Ya, benar',
    'Bayar dengan QRIS',
    'Pindai dari aplikasi bank atau dompet digital. Berlaku sampai 10.15.',
    'Cek stok kedai',
  ];
  for (const t of order) expect(screen.getByText(t)).toBeTruthy();
  expect(screen.getByText('Nadia ingat semua obrolan Anda, di aplikasi maupun di WhatsApp.')).toBeTruthy();
  expect(screen.getByText('Nyala · Dingin')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Buka' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Bagikan' })).toBeTruthy();
  expect(screen.queryByText(/Anda menjawab/)).toBeNull();
  expect(screen.getByTestId('qris-kode')).toBeTruthy();
  expect(screen.getByTestId('berpikir')).toBeTruthy();
  expect(screen.queryByText('Mau saya bantu urus apa?')).toBeNull();
});

test('Kirim menahan kiriman dan mencatat Riwayat; Batalkan membatalkannya', async () => {
  await renderChat();
  expect(latest.outgoing[BUDI]!.status).toBe('draft');
  const before = latest.history.length;
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  expect(screen.getByText('Dikirim 10.47')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Kirim' })).toBeNull();
  expect(latest.outgoing[BUDI]!.status).toBe('held');
  expect(latest.history.length).toBe(before + 1);
  expect(historyRows(latest)[0]).toMatchObject({ title: 'Mengirim balasan ke Pak Budi', undoable: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Batalkan' }));
  expect(screen.getByText('Dibatalkan · tidak jadi terkirim')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Batalkan' })).toBeNull();
  expect(latest.outgoing[BUDI]!.status).toBe('cancelled');
  expect(latest.toast).toBe('Kiriman ke Pak Budi dibatalkan.');
  expect(historyRows(latest)[0]).toMatchObject({ struck: true, undoable: false });
});

test('Ubah membuka kolom teks dan Simpan menyimpan isi baru', async () => {
  await renderChat();
  await fireEvent.press(screen.getByRole('button', { name: 'Ubah' }));
  const box = screen.getByLabelText('Isi pesan');
  await fireEvent.changeText(box, 'Baik Pak, Rp15 juta ya.');
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
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
  expect(screen.getAllByTestId('berpikir')).toHaveLength(1);
  await advance(1100);
  expect(screen.queryByText(/Ini masih contoh/)).toBeNull();
  await advance(100);
  expect(screen.getByText('Ini masih contoh. Mulai Fase 1 saya menjawab sungguhan.')).toBeTruthy();
  expect(screen.queryByTestId('berpikir')).toBeNull();
});

test('kartu perangkat membaca AC yang ditunjuk barisnya', async () => {
  await renderChat({
    state: { ...initialSampleState, chat: [{ id: 'x1', kind: 'device', deviceId: 'dago-ac' }] },
  });
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

test('pesan yang diketik dan jawabannya tersimpan di penyimpanan, tanda berpikir contoh hilang', async () => {
  await renderChat();
  await fireEvent.changeText(screen.getByLabelText('Tulis pesan untuk Nadia'), 'Halo Nadia');
  await fireEvent.press(screen.getByRole('button', { name: 'Kirim pesan' }));
  expect(latest.chat.at(-1)).toMatchObject({ kind: 'user', text: 'Halo Nadia' });
  expect(latest.chat.some((e) => e.kind === 'thinking')).toBe(false);
  await advance(1200);
  expect(latest.chat.at(-1)).toMatchObject({
    kind: 'assistant',
    text: 'Ini masih contoh. Mulai Fase 1 saya menjawab sungguhan.',
  });
});

test('draf kedua dari layar lain tampil sebagai kartu sendiri; Kirim hanya mengubah draf itu', async () => {
  await renderChat({ actions: [{ type: 'addDraft', draft: supplierOrderDraft }] });
  expect(screen.getByText('PT Sumber Susu')).toBeOnTheScreen();
  expect(screen.getByText('Ini draf pesanannya. Saya kirim setelah Anda setuju.')).toBeOnTheScreen();
  expect(screen.getByText(supplierOrderDraft.text)).toBeOnTheScreen();
  expect(screen.queryByTestId('berpikir')).toBeNull();
  const kirim = screen.getAllByRole('button', { name: 'Kirim' });
  expect(kirim).toHaveLength(2);
  await fireEvent.press(kirim[1]!);
  expect(screen.getByText('Dikirim 10.48')).toBeOnTheScreen();
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
  expect(has(N - 7, N - 7)).toBe(a.some((c) => c.x === N - 7 && c.y === N - 7)); // sudut kanan bawah bebas
  expect(a.length).toBeGreaterThan(150);
});
