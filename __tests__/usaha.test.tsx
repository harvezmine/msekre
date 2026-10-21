import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import Beranda from '../app/(tabs)/index';
import Usaha from '../app/(tabs)/usaha';
import { ERROR_TEXT, FILE_DOWNLOAD_TEXT } from '@/api/errors';
import { ApiFailure } from '@/api/transport';
import { dark } from '@/theme/tokens';
import { ToastHost } from '@/ui/Toast';
import { createTestApi, renderWithProviders } from './helpers';
import type { SampleState } from '@/sample/store';

beforeEach(() => jest.clearAllMocks());

const at = (place: SampleState['place']) => ({ type: 'setPlace', place }) as const;
const show = () => renderWithProviders(<Usaha />);

test('Semua cabang: angka, cabang, uang masuk, stok, pesanan, laporan, sumber data', async () => {
  await show();
  expect(await screen.findByText('Rp4.250.000')).toBeOnTheScreen();
  expect(screen.getByText('naik 12% dari Senin lalu')).toBeOnTheScreen();
  expect(screen.getByText('Rp2.610.000')).toBeOnTheScreen();
  expect(screen.getByText('Rp1.640.000')).toBeOnTheScreen();
  expect(screen.getAllByText('dari Moka')).toHaveLength(2);
  expect(screen.getByText('dari rekening BCA')).toBeOnTheScreen();
  expect(screen.getByText('Transfer dari PT Sumber Susu')).toBeOnTheScreen();
  expect(screen.getByText('Susu UHT')).toBeOnTheScreen();
  expect(screen.getByText('6 karton')).toBeOnTheScreen();
  expect(screen.getByText('TikTok Shop: 3 pesanan perlu dikirim')).toBeOnTheScreen();
  expect(screen.getByText('Biji kopi Gayo 250 g × 2')).toBeOnTheScreen();
  expect(screen.getByText('Laporan penjualan 14–20 Okt.xlsx')).toBeOnTheScreen();
  expect(screen.getByText('Sen')).toBeOnTheScreen();
  expect(screen.getByText('Data dari Moka, rekening BCA dan TikTok Shop.')).toBeOnTheScreen();
});

test('sumber yang belum tersambung mengarah ke Terhubung', async () => {
  await show();
  await fireEvent.press(await screen.findByRole('button', { name: 'Sambungkan Shopee' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung');
});

test('angka berganti sesuai tempat', async () => {
  await renderWithProviders(<Usaha />, { actions: [at('Kedai Dago')] });
  expect(await screen.findByText('naik 9% dari Senin lalu')).toBeOnTheScreen();
  expect(screen.getByText('Rp2.610.000')).toBeOnTheScreen();
  expect(screen.getByText('TikTok Shop: 2 pesanan perlu dikirim')).toBeOnTheScreen();
  expect(screen.queryByText('Rp4.250.000')).toBeNull();
  expect(screen.queryByText('Rp1.640.000')).toBeNull();
});

test('Kedai Riau: turun, satu barang menipis', async () => {
  await renderWithProviders(<Usaha />, { actions: [at('Kedai Riau')] });
  expect(await screen.findByText('turun 4% dari Senin lalu')).toBeOnTheScreen();
  expect(screen.getByText('2 karton')).toBeOnTheScreen();
  expect(screen.queryByText('Biji kopi Gayo')).toBeNull();
});

test('Rumah tidak punya data usaha: keadaan kosong dengan jalan ke Terhubung dan ke pemilih tempat', async () => {
  await renderWithProviders(<Usaha />, { actions: [at('Rumah')] });
  expect(
    await screen.findByText('Belum ada data usaha. Sambungkan kasir atau rekening di Terhubung.'),
  ).toBeOnTheScreen();
  expect(screen.queryByText('Penjualan hari ini')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Buka Terhubung' }));
  expect(router.push).toHaveBeenCalledWith('/terhubung');
  await fireEvent.press(screen.getByRole('button', { name: 'Pilih tempat' }));
  expect(router.push).toHaveBeenCalledWith('/tempat');
});

test('gagal memuat: kalimat ramah dan Coba lagi', async () => {
  const api = createTestApi();
  jest.spyOn(api.transport, 'business').mockRejectedValueOnce(new ApiFailure('network'));
  await renderWithProviders(<Usaha />, { api });
  await fireEvent.press(await screen.findByRole('button', { name: 'Coba lagi' }));
  expect(await screen.findByText('Rp4.250.000')).toBeOnTheScreen();
});

describe('Pesan lagi', () => {
  const supplierDrafts = async (api: ReturnType<typeof createTestApi>) => {
    const page = await api.transport.messages();
    return page.items.flatMap((m) =>
      m.parts.flatMap((p) =>
        p.type === 'card' && p.card.kind === 'draft' && p.card.draft.to === 'PT Sumber Susu' ? [p.card.draft] : [],
      ),
    );
  };

  test('membuat draf di chat, tombol berganti Lihat draf yang membuka chat di draf itu, tanpa draf kembar', async () => {
    const api = createTestApi();
    await renderWithProviders(<Usaha />, { api });
    await fireEvent.press(await screen.findByRole('button', { name: 'Pesan lagi Susu UHT' }));
    const [draft, ...rest] = await supplierDrafts(api);
    expect(rest).toHaveLength(0);
    expect(draft).toMatchObject({ status: 'draft', what: 'pesanan' });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/chat', params: { draf: draft!.id } });
    expect(api.transport.sample.getState().outgoing[draft!.id]).toMatchObject({
      to: 'PT Sumber Susu',
      status: 'draft',
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Lihat draf Susu UHT' }));
    expect(router.push).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/chat', params: { draf: draft!.id } });
    expect(await supplierDrafts(api)).toHaveLength(1);
    // barang lain tetap bisa dipesan
    expect(screen.getByRole('button', { name: 'Pesan lagi Biji kopi Gayo' })).toBeOnTheScreen();
  });

  test('server tiruan idempoten per barang selagi drafnya terbuka, dan membuat yang baru setelah dikirim', async () => {
    const api = createTestApi();
    const first = await api.transport.businessReorder('stok-susu-uht');
    const again = await api.transport.businessReorder('stok-susu-uht');
    expect(again).toEqual(first);
    expect((await supplierDrafts(api)).filter((d) => d.status === 'draft')).toHaveLength(1);
    await api.transport.draftAction(first.draftId, { action: 'send' });
    const next = await api.transport.businessReorder('stok-susu-uht');
    expect(next.draftId).not.toBe(first.draftId);
    await expect(api.transport.businessReorder('tidak-ada')).rejects.toMatchObject({ status: 404 });
  });

  test('draf dikirim atau dibuang: tombol kembali ke Pesan lagi', async () => {
    const api = createTestApi();
    await renderWithProviders(<Usaha />, { api });
    await fireEvent.press(await screen.findByRole('button', { name: 'Pesan lagi Susu UHT' }));
    const [draft] = await supplierDrafts(api);
    expect(await screen.findByRole('button', { name: 'Lihat draf Susu UHT' })).toBeOnTheScreen();
    await act(async () => {
      await api.transport.draftAction(draft!.id, { action: 'discard' });
    });
    expect(await screen.findByRole('button', { name: 'Pesan lagi Susu UHT' })).toBeOnTheScreen();
  });

  test('gagal membuat draf: toast ramah dan tombol tetap Pesan lagi', async () => {
    const api = createTestApi();
    await renderWithProviders(
      <>
        <Usaha />
        <ToastHost />
      </>,
      { api },
    );
    const button = await screen.findByRole('button', { name: 'Pesan lagi Susu UHT' });
    api.transport.failNext('network');
    await fireEvent.press(button);
    expect(await screen.findByText(ERROR_TEXT)).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pesan lagi Susu UHT' })).toBeOnTheScreen();
  });
});

test('Buka dan Bagikan laporan memakai alur unduh dokumen', async () => {
  await show();
  await fireEvent.press(await screen.findByRole('button', { name: 'Buka' }));
  for (let i = 0; i < 6; i++) await act(async () => void jest.advanceTimersByTime(300));
  // iOS (bawaan tes): berkas contoh dibuka lewat lembar bagikan.
  expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Bagikan' }));
  for (let i = 0; i < 6; i++) await act(async () => void jest.advanceTimersByTime(300));
  expect(Sharing.shareAsync).toHaveBeenCalledTimes(2);
});

test('laporan gagal diunduh: toast ramah', async () => {
  const api = createTestApi();
  await renderWithProviders(
    <>
      <Usaha />
      <ToastHost />
    </>,
    { api },
  );
  const button = await screen.findByRole('button', { name: 'Buka' });
  jest.spyOn(api.transport, 'mediaUrl').mockRejectedValue(new ApiFailure('network'));
  await fireEvent.press(button);
  expect(await screen.findByText(FILE_DOWNLOAD_TEXT)).toBeOnTheScreen();
});

test('mode gelap memakai warna palet gelap', async () => {
  await renderWithProviders(<Usaha />, { scheme: 'dark' });
  const flat = (n: ReturnType<typeof screen.getByText>) => Object.assign({}, ...[n.props.style].flat(5));
  expect(flat(await screen.findByText('naik 12% dari Senin lalu')).color).toBe(dark.leafText);
  expect(flat(screen.getByText('Rp4.250.000')).color).toBe(dark.ink);
});

test('tombol tempat menyebut Semua cabang, dan kedai tetap namanya', async () => {
  await renderWithProviders(<Usaha />);
  expect(await screen.findByRole('button', { name: 'Tempat: Semua cabang' })).toBeOnTheScreen();
});

test('tombol tempat di Kedai Dago memakai nama kedai', async () => {
  await renderWithProviders(<Usaha />, { actions: [at('Kedai Dago')] });
  expect(await screen.findByRole('button', { name: 'Tempat: Kedai Dago' })).toBeOnTheScreen();
});

describe('rentang dan konsistensi', () => {
  test('GET /business menjawab hari, minggu, dan bulan dari data yang sama', async () => {
    const { transport } = createTestApi();
    const day = await transport.business('Semua', 'hari');
    const week = await transport.business('Semua', 'minggu');
    const month = await transport.business('Semua');
    expect(month.period).toBe('hari');
    expect(day.sales).toEqual({ total: 4_250_000, change: 12, down: false, compareLabel: 'Senin lalu' });
    expect(day.series).toHaveLength(7);
    expect(day.series[6]).toEqual({ label: 'Sen', value: 4_250_000 });
    expect(week.sales.total).toBe(day.series.reduce((a, p) => a + p.value, 0));
    expect(week.sales.compareLabel).toBe('pekan lalu');
    expect(week.series).toHaveLength(4);
    const bulan = await transport.business('Kedai Riau', 'bulan');
    expect(bulan.sales.compareLabel).toBe('bulan lalu');
    expect(bulan.series.map((p) => p.label)).toEqual(['Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt']);
    expect(bulan.branches).toEqual([]);
    expect(day.branches.map((b) => b.name)).toEqual(['Kedai Dago', 'Kedai Riau']);
    expect(day.branches.reduce((a, b) => a + b.total, 0)).toBe(day.sales.total);
    expect(day.sources.find((s) => s.key === 'shopee')?.connected).toBe(false);
    await expect(transport.business('Bulan', 'hari')).rejects.toMatchObject({ error: 'tidak_valid' });
  });

  test('Beranda dan Usaha memakai angka yang sama setelah data bersama berubah', async () => {
    const api = createTestApi();
    await renderWithProviders(
      <>
        <Beranda />
        <Usaha />
      </>,
      { api },
    );
    expect(await screen.findAllByText('Rp4.250.000')).toHaveLength(2);
    await act(async () => {
      api.transport.sample.dispatch({ type: 'setPlace', place: 'Kedai Dago' });
    });
    expect(await screen.findAllByText('Rp2.610.000')).toHaveLength(2);
    expect(screen.getAllByText('naik 9% dari Senin lalu')).toHaveLength(2);
    expect(screen.getByText('Susu UHT tinggal 4 karton')).toBeOnTheScreen();
    expect(screen.getByText('4 karton')).toBeOnTheScreen();
  });
});
