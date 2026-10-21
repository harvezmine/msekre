import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Keamanan from '../app/akun/keamanan';
import { createTestApi, renderWithProviders, toastNow } from './helpers';
import type { Api } from '@/api/ApiProvider';

beforeEach(() => jest.clearAllMocks());

const LABEL = 'Minta PIN untuk kamera, alarm rumah, dan kunci pintu';

async function settle() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
  }
}
async function show(options: Parameters<typeof createTestApi>[0] = {}) {
  const api = createTestApi(options);
  await renderWithProviders(
    <>
      <Keamanan />
    </>,
    { api },
  );
  await settle();
  return api;
}
async function type(digits: string) {
  for (const d of digits) await fireEvent.press(screen.getByRole('button', { name: d }));
  await settle();
}
const security = (api: Api) => (api.transport as unknown as { security(): Promise<unknown> }).security();
const toggle = () => screen.getByRole('switch', { name: LABEL });

test('bawaan: PIN mati, tanpa PIN, dan pembayaran tidak memakai PIN', async () => {
  const api = await show();
  expect(toggle()).not.toBeChecked();
  expect(screen.getByText('Mati')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /Ganti PIN/ })).toBeNull();
  expect(screen.getByText(/Pembayaran tidak pernah memakai PIN/)).toBeOnTheScreen();
  expect(await security(api)).toEqual({ pinEnabled: false, hasPin: false });
});

test('menghidupkan tanpa PIN: Buat PIN, ulangi, lalu PIN aktif', async () => {
  const api = await show();
  await fireEvent.press(toggle());
  expect(screen.getByText('Buat PIN')).toBeOnTheScreen();
  await type('135790');
  expect(screen.getByText('Ulangi PIN')).toBeOnTheScreen();
  await type('135790');
  expect(await security(api)).toEqual({ pinEnabled: true, hasPin: true });
  expect(toastNow()?.text).toBe('PIN dibuat. Kamera, alarm rumah, dan kunci pintu sekarang minta PIN.');
  expect(toggle()).toBeChecked();
  expect(await api.transport.verifyPin('135790')).toBe(true);
  expect(screen.getByRole('button', { name: 'Ganti PIN' })).toBeOnTheScreen();
});

test('membuat PIN: satu langkah atomik di server (PIN dan permintaan PIN bersama), bukan dua panggilan terpisah', async () => {
  const api = await show();
  const setPin = jest.spyOn(api.transport, 'setPin');
  const setSecurity = jest.spyOn(api.transport, 'setSecurity');
  await fireEvent.press(toggle());
  await type('135790');
  await type('135790');
  expect(setPin).toHaveBeenCalledTimes(1);
  expect(setPin).toHaveBeenCalledWith({ pin: '135790', enable: true });
  expect(setSecurity).not.toHaveBeenCalled();
});

test('mematikan permintaan PIN mengirim PIN yang baru dibuktikan', async () => {
  const api = await show({ security: { pinEnabled: true, pin: '123456' } });
  const setSecurity = jest.spyOn(api.transport, 'setSecurity');
  await fireEvent.press(toggle());
  await type('123456');
  expect(setSecurity).toHaveBeenCalledWith({ pinEnabled: false, pin: '123456' });
});

test('PIN yang diulang berbeda: "PIN belum sama, ulangi ya." dan belum ada PIN', async () => {
  const api = await show();
  await fireEvent.press(toggle());
  await type('135790');
  await type('135791');
  expect(screen.getByText('PIN belum sama, ulangi ya.')).toBeOnTheScreen();
  expect(screen.getByText('Ulangi PIN')).toBeOnTheScreen();
  expect(await security(api)).toEqual({ pinEnabled: false, hasPin: false });
  // Mengulang dengan benar menyelesaikannya.
  await type('135790');
  expect(await security(api)).toEqual({ pinEnabled: true, hasPin: true });
});

test('Batal saat membuat PIN kembali ke pengaturan tanpa mengubah apa pun', async () => {
  const api = await show();
  await fireEvent.press(toggle());
  await fireEvent.press(screen.getByRole('button', { name: 'Batal' }));
  expect(toggle()).not.toBeChecked();
  expect(await security(api)).toEqual({ pinEnabled: false, hasPin: false });
});

test('sudah punya PIN tapi mati: menghidupkan langsung, tanpa meminta PIN', async () => {
  const api = await show({ security: { pin: '123456' } });
  expect(toggle()).not.toBeChecked();
  await fireEvent.press(toggle());
  await settle();
  expect(toggle()).toBeChecked();
  expect(await security(api)).toEqual({ pinEnabled: true, hasPin: true });
});

test('mematikan permintaan PIN meminta PIN: salah ditolak, benar mematikan', async () => {
  const api = await show({ security: { pinEnabled: true, pin: '123456' } });
  expect(toggle()).toBeChecked();
  await fireEvent.press(toggle());
  expect(screen.getByText('Matikan PIN')).toBeOnTheScreen();
  await type('111111');
  expect(screen.getByText('PIN belum cocok, coba lagi.')).toBeOnTheScreen();
  expect(await security(api)).toEqual({ pinEnabled: true, hasPin: true });
  await type('123456');
  expect(await security(api)).toEqual({ pinEnabled: false, hasPin: true });
  expect(toastNow()?.text).toBe('Permintaan PIN dimatikan.');
  expect(toggle()).not.toBeChecked();
});

test('Ganti PIN: PIN sekarang, PIN baru, ulangi; PIN lama tidak berlaku lagi', async () => {
  const api = await show({ security: { pinEnabled: true, pin: '123456' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Ganti PIN' }));
  expect(screen.getByText('Masukkan PIN')).toBeOnTheScreen();
  // PIN sekarang yang salah tidak lanjut.
  await type('000111');
  expect(screen.getByText('PIN belum cocok, coba lagi.')).toBeOnTheScreen();
  await type('123456');
  expect(screen.getByText('Buat PIN')).toBeOnTheScreen();
  await type('654321');
  expect(screen.getByText('Ulangi PIN')).toBeOnTheScreen();
  await type('654321');
  expect(toastNow()?.text).toBe('PIN diganti.');
  expect(await api.transport.verifyPin('654321')).toBe(true);
  expect(await api.transport.verifyPin('123456')).toBe(false);
  expect(await security(api)).toEqual({ pinEnabled: true, hasPin: true });
});

test('kendala sinyal saat menyimpan: pesan ramah di bawah titik, PIN tidak berubah', async () => {
  const api = await show();
  await fireEvent.press(toggle());
  await type('135790');
  jest.spyOn(api.transport, 'setPin').mockRejectedValue(new Error('network'));
  await type('135790');
  expect(screen.getByText('Lagi ada kendala, sudah dilaporkan ke tim. Coba lagi sebentar ya.')).toBeOnTheScreen();
  expect(await security(api)).toEqual({ pinEnabled: false, hasPin: false });
});

test('keadaan tidak terbaca: pesan dan sakelar belum bisa dipakai', async () => {
  const api = createTestApi();
  jest.spyOn(api.transport, 'security').mockRejectedValue(new Error('network'));
  await renderWithProviders(<Keamanan />, { api });
  await settle();
  expect(screen.getByText('Pengaturan keamanan belum bisa dimuat. Coba lagi sebentar ya.')).toBeOnTheScreen();
  expect(screen.queryByRole('switch')).toBeNull();
  expect(router.push).not.toHaveBeenCalled();
});
