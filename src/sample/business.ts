import type { BusinessPeriod } from '@/api/contract';

/**
 * Data usaha contoh yang dipegang server tiruan (`FakeTransport`). Angka dalam Rupiah utuh; server tiruan menyusunnya
 * menjadi jawaban `GET /business` per tempat dan rentang (lihat `src/api/fake/business.ts`).
 */
export interface SampleMoneyIn {
  id: string;
  source: string;
  amount: number;
  /** Jam "HH.MM" WIB hari ini. */
  time: string;
  note?: string;
}
export interface SampleOrder {
  id: string;
  channel: string;
  summary: string;
  amount: number;
  status: string;
  time: string;
}
/** Barang yang dipantau. `supplier` dipakai "Pesan lagi". */
export interface StockDef {
  id: string;
  name: string;
  unit: string;
  supplier: { name: string; phone: string };
}
export interface PlaceBusiness {
  /** Penjualan tujuh hari sampai hari ini (Rupiah). */
  daily: number[];
  /** Perubahan dari pembandingnya per rentang, persen. */
  change: Record<BusinessPeriod, { pct: number; down: boolean }>;
  moneyIn: SampleMoneyIn[];
  lowStock: { stockId: string; left: number }[];
  orders: SampleOrder[];
}

/** Hari pada sumbu grafik harian; hari ini (Senin 20 Okt) paling kanan. */
export const SPARK_DAYS = ['Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min', 'Sen'] as const;

/** Tempat yang punya usaha. Rumah tidak. */
export const BUSINESS_PLACES = ['Kedai Dago', 'Kedai Riau'] as const;

export const STOCK: Record<string, StockDef> = {
  'stok-susu-uht': {
    id: 'stok-susu-uht',
    name: 'Susu UHT',
    unit: 'karton',
    supplier: { name: 'PT Sumber Susu', phone: '6281234500011' },
  },
  'stok-kopi-gayo': {
    id: 'stok-kopi-gayo',
    name: 'Biji kopi Gayo',
    unit: 'kg',
    supplier: { name: 'CV Gayo Mountain', phone: '6281234500022' },
  },
};

export const REPORT = {
  name: 'Laporan penjualan 14–20 Okt.xlsx',
  size: 36 * 1024,
  period: '14–20 Okt',
} as const;

const DAGO_DAILY = [1_800_000, 2_100_000, 1_700_000, 2_200_000, 2_600_000, 2_900_000, 2_610_000];
const RIAU_DAILY = [1_300_000, 1_500_000, 1_200_000, 1_600_000, 1_800_000, 2_000_000, 1_640_000];

const DAGO_ORDERS: SampleOrder[] = [
  {
    id: 'tt-101',
    channel: 'tiktok_shop',
    summary: 'Biji kopi Gayo 250 g × 2',
    amount: 178_000,
    status: 'perlu_dikirim',
    time: '09.12',
  },
  {
    id: 'tt-102',
    channel: 'tiktok_shop',
    summary: 'Paket kopi hitam 1 kg',
    amount: 245_000,
    status: 'perlu_dikirim',
    time: '10.05',
  },
];
const RIAU_ORDERS: SampleOrder[] = [
  {
    id: 'tt-103',
    channel: 'tiktok_shop',
    summary: 'Susu UHT 1 karton',
    amount: 132_000,
    status: 'perlu_dikirim',
    time: '08.47',
  },
];

/** Usaha per tempat. `Semua` = jumlah dua kedai (grafik, uang masuk, stok, dan pesanan digabung). */
export const businessData: Record<'Semua' | (typeof BUSINESS_PLACES)[number], PlaceBusiness> = {
  Semua: {
    daily: DAGO_DAILY.map((v, i) => v + RIAU_DAILY[i]!),
    change: {
      hari: { pct: 12, down: false },
      minggu: { pct: 8, down: false },
      bulan: { pct: 5, down: false },
    },
    moneyIn: [
      { id: 'mi-1', source: 'Transfer dari PT Sumber Susu', amount: 2_400_000, time: '10.12' },
      { id: 'mi-2', source: 'QRIS Kedai Dago', amount: 1_185_000, time: '09.58' },
    ],
    lowStock: [
      { stockId: 'stok-susu-uht', left: 6 },
      { stockId: 'stok-kopi-gayo', left: 2 },
    ],
    orders: [...DAGO_ORDERS, ...RIAU_ORDERS],
  },
  'Kedai Dago': {
    daily: DAGO_DAILY,
    change: {
      hari: { pct: 9, down: false },
      minggu: { pct: 6, down: false },
      bulan: { pct: 4, down: false },
    },
    moneyIn: [
      { id: 'mi-2', source: 'QRIS Kedai Dago', amount: 1_185_000, time: '09.58' },
      { id: 'mi-3', source: 'QRIS Kedai Dago', amount: 620_000, time: '08.40' },
    ],
    lowStock: [
      { stockId: 'stok-susu-uht', left: 4 },
      { stockId: 'stok-kopi-gayo', left: 2 },
    ],
    orders: DAGO_ORDERS,
  },
  'Kedai Riau': {
    daily: RIAU_DAILY,
    change: {
      hari: { pct: 4, down: true },
      minggu: { pct: 2, down: true },
      bulan: { pct: 1, down: false },
    },
    moneyIn: [
      { id: 'mi-4', source: 'QRIS Kedai Riau', amount: 860_000, time: '09.31' },
      { id: 'mi-5', source: 'Transfer dari Bu Sari', amount: 450_000, time: '08.15' },
    ],
    lowStock: [{ stockId: 'stok-susu-uht', left: 2 }],
    orders: RIAU_ORDERS,
  },
};
