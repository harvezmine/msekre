import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import Usaha from '../app/(tabs)/usaha';
import { renderWithProviders } from './helpers';
import { useSample, type SampleState } from '@/sample/store';
import { dark } from '@/theme/tokens';

beforeEach(() => jest.clearAllMocks());

let latest: SampleState;
function Probe() {
  const { state } = useSample();
  useEffect(() => {
    latest = state;
  });
  return null;
}
const show = () =>
  renderWithProviders(
    <>
      <Usaha />
      <Probe />
    </>,
    { actions: [] },
  );
const at = (place: SampleState['place']) => ({ type: 'setPlace', place }) as const;

test('Semua cabang: angka, cabang, uang masuk, stok, pesanan, laporan', async () => {
  await show();
  expect(screen.getByText('Rp4.250.000')).toBeOnTheScreen();
  expect(screen.getByText('naik 12% dari Senin lalu')).toBeOnTheScreen();
  expect(screen.getByText('Rp2.610.000')).toBeOnTheScreen();
  expect(screen.getByText('Rp1.640.000')).toBeOnTheScreen();
  expect(screen.getAllByText('dari Moka')).toHaveLength(2);
  expect(screen.getByText('dari BCA')).toBeOnTheScreen();
  expect(screen.getByText('Transfer dari PT Sumber Susu')).toBeOnTheScreen();
  expect(screen.getByText('Susu UHT')).toBeOnTheScreen();
  expect(screen.getByText('TikTok Shop: 3 pesanan perlu dikirim')).toBeOnTheScreen();
  expect(screen.getByText('Laporan penjualan 14–20 Okt.xlsx')).toBeOnTheScreen();
  expect(screen.getByText('Sen')).toBeOnTheScreen();
});

test('angka berganti sesuai tempat', async () => {
  await renderWithProviders(<Usaha />, { actions: [at('Kedai Dago')] });
  expect(screen.getByText('Rp2.610.000')).toBeOnTheScreen();
  expect(screen.getByText('naik 9% dari Senin lalu')).toBeOnTheScreen();
  expect(screen.getByText('TikTok Shop: 2 pesanan perlu dikirim')).toBeOnTheScreen();
  expect(screen.queryByText('Rp4.250.000')).toBeNull();
  expect(screen.queryByText('Rp1.640.000')).toBeNull();
});

test('Kedai Riau: turun, satu barang menipis', async () => {
  await renderWithProviders(<Usaha />, { actions: [at('Kedai Riau')] });
  expect(screen.getByText('Rp1.640.000')).toBeOnTheScreen();
  expect(screen.getByText('turun 4% dari Senin lalu')).toBeOnTheScreen();
  expect(screen.getByText('2 karton')).toBeOnTheScreen();
  expect(screen.queryByText('Biji kopi Gayo')).toBeNull();
});

test('Rumah: keterangan ramah dan tombol membuka pemilih tempat', async () => {
  await renderWithProviders(<Usaha />, { actions: [at('Rumah')] });
  expect(screen.getByText('Pilih tempat usaha untuk melihat penjualan.')).toBeOnTheScreen();
  expect(screen.queryByText('Penjualan hari ini')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Pilih tempat' }));
  expect(router.push).toHaveBeenCalledWith('/tempat');
});

test('Pesan lagi menambah kartu konfirmasi di chat dan membuka chat, sekali saja', async () => {
  await show();
  const confirms = () => latest.chat.filter((e) => e.kind === 'confirm').length;
  const before = confirms();
  await fireEvent.press(screen.getByRole('button', { name: 'Pesan lagi' }));
  expect(router.push).toHaveBeenCalledWith('/chat');
  expect(confirms()).toBe(before + 1);
  expect(latest.chat.at(-2)).toMatchObject({ kind: 'assistant' });
  const confirm = latest.chat.at(-1)!;
  expect(confirm.kind).toBe('confirm');
  const o = latest.outgoing[(confirm as { outgoingId: string }).outgoingId]!;
  expect(o).toMatchObject({ to: 'PT Sumber Susu', status: 'draft' });

  await fireEvent.press(screen.getByRole('button', { name: 'Pesan lagi' }));
  expect(router.push).toHaveBeenCalledTimes(2);
  expect(confirms()).toBe(before + 1);
  expect(Object.values(latest.outgoing).filter((x) => x.to === 'PT Sumber Susu')).toHaveLength(1);
});

test('baris pesanan dan Buka laporan memunculkan toast', async () => {
  await show();
  await fireEvent.press(screen.getByText('TikTok Shop: 3 pesanan perlu dikirim'));
  expect(latest.toast?.text).toBe('Daftar pesanan dibangun di Fase 4.');
  await fireEvent.press(screen.getByRole('button', { name: /^Buka/ }));
  expect(latest.toast?.text).toBe('Membuka berkas contoh.');
  await act(async () => {});
});

test('mode gelap memakai warna palet gelap', async () => {
  await renderWithProviders(<Usaha />, { scheme: 'dark' });
  const flat = (n: ReturnType<typeof screen.getByText>) => Object.assign({}, ...[n.props.style].flat(5));
  expect(flat(screen.getByText('naik 12% dari Senin lalu')).color).toBe(dark.leafText);
  expect(flat(screen.getByText('Rp4.250.000')).color).toBe(dark.ink);
});

test('tombol tempat menyebut Semua cabang, dan kedai tetap namanya', async () => {
  await renderWithProviders(<Usaha />);
  expect(screen.getByRole('button', { name: 'Tempat: Semua cabang' })).toBeOnTheScreen();
});

test('tombol tempat di Kedai Dago memakai nama kedai', async () => {
  await renderWithProviders(<Usaha />, { actions: [at('Kedai Dago')] });
  expect(screen.getByRole('button', { name: 'Tempat: Kedai Dago' })).toBeOnTheScreen();
});
