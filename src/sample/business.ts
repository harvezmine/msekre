import type { Place } from './types';
import { initialBusiness } from './history';

export interface MoneyIn {
  title: string;
  time: string;
  amount: string;
}
export interface LowStock {
  item: string;
  left: string;
}
/** Hasil penjualan satu tempat. `series`: tujuh hari sampai hari ini, dalam juta rupiah. */
export interface PlaceSales {
  /** Nama di tombol tempat dan keterangan, misalnya "Semua cabang". */
  label: string;
  sales: string;
  change: string;
  /** Penjualan turun dari Senin lalu: keterangan memakai warna clay, bukan hijau. */
  down?: boolean;
  series: number[];
  /** Batas bawah dan rentang sumbu grafik (juta), supaya garis tiap tempat memenuhi tinggi grafik. */
  min: number;
  span: number;
  /** Penjualan per cabang; hanya untuk Semua cabang. */
  split?: { name: string; sales: string }[];
  moneyIn: MoneyIn[];
  lowStock: LowStock[];
  orders: number;
}

export const REPORT_FILE = { name: 'Laporan penjualan 14–20 Okt.xlsx', meta: '36 KB · baru saja' };
export const REPORT_REQUEST = 'Buat laporan penjualan minggu ini';

/** Hari pada sumbu grafik; hari ini (Senin 20 Okt) paling kanan. */
export const SPARK_DAYS = ['Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min', 'Sen'] as const;

/** Penjualan per tempat. Semua cabang memakai angka yang sama dengan kartu Usaha di Beranda. */
export const businessByPlace: Partial<Record<Place, PlaceSales>> = {
  Semua: {
    label: 'Semua cabang',
    sales: initialBusiness.sales,
    change: initialBusiness.change,
    series: [3.1, 3.6, 2.9, 3.8, 4.4, 4.9, 4.25],
    min: 2.6,
    span: 2.5,
    split: [
      { name: 'Kedai Dago', sales: 'Rp2.610.000' },
      { name: 'Kedai Riau', sales: 'Rp1.640.000' },
    ],
    moneyIn: [
      { title: 'Transfer dari PT Sumber Susu', time: '10.12', amount: 'Rp2.400.000' },
      { title: 'QRIS Kedai Dago', time: '09.58', amount: 'Rp1.185.000' },
    ],
    lowStock: [
      { item: 'Susu UHT', left: '6 karton' },
      { item: 'Biji kopi Gayo', left: '2 kg' },
    ],
    orders: 3,
  },
  'Kedai Dago': {
    label: 'Kedai Dago',
    sales: 'Rp2.610.000',
    change: 'naik 9% dari Senin lalu',
    series: [1.8, 2.1, 1.7, 2.2, 2.6, 2.9, 2.61],
    min: 1.5,
    span: 1.6,
    moneyIn: [
      { title: 'QRIS Kedai Dago', time: '09.58', amount: 'Rp1.185.000' },
      { title: 'QRIS Kedai Dago', time: '08.40', amount: 'Rp620.000' },
    ],
    lowStock: [
      { item: 'Susu UHT', left: '4 karton' },
      { item: 'Biji kopi Gayo', left: '2 kg' },
    ],
    orders: 2,
  },
  'Kedai Riau': {
    label: 'Kedai Riau',
    sales: 'Rp1.640.000',
    change: 'turun 4% dari Senin lalu',
    down: true,
    series: [1.3, 1.5, 1.2, 1.6, 1.8, 2.0, 1.64],
    min: 1.0,
    span: 1.2,
    moneyIn: [
      { title: 'QRIS Kedai Riau', time: '09.31', amount: 'Rp860.000' },
      { title: 'Transfer dari Bu Sari', time: '08.15', amount: 'Rp450.000' },
    ],
    lowStock: [{ item: 'Susu UHT', left: '2 karton' }],
    orders: 1,
  },
};
