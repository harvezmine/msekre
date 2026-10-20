import type { Business, HistoryEntry } from './types';

/** Riwayat contoh, desain 2m. Yang terbaru di atas. Kiriman ke Pak Budi baru masuk setelah disetujui. */
export const initialHistory: HistoryEntry[] = [
  {
    id: 'h1',
    day: 'Hari ini',
    time: '10.05',
    kind: 'pembelian',
    icon: 'bolt',
    title: 'Membeli token listrik',
    sub: 'Rp100.000 lunas · 10.05',
  },
  {
    id: 'h2',
    day: 'Hari ini',
    time: '09.40',
    kind: 'pesan',
    icon: 'note',
    title: 'Mencatat rapat supplier',
    sub: '09.40 · notulen siap',
  },
  {
    id: 'h3',
    day: 'Hari ini',
    time: '08.45',
    kind: 'pesan',
    icon: 'bell',
    title: 'Mengingatkan rapat dengan supplier susu',
    sub: '08.45',
  },
  { id: 'h4', day: 'Kemarin', time: '23.10', kind: 'rumah', icon: 'snow', title: 'Mematikan AC kamar', sub: '23.10' },
  {
    id: 'h5',
    day: 'Kemarin',
    time: '22.30',
    kind: 'rumah',
    icon: 'lock',
    title: 'Mengunci pintu depan',
    sub: '22.30 · rutinitas Tidur',
  },
  {
    id: 'h6',
    day: 'Kemarin',
    time: '21.00',
    kind: 'usaha',
    icon: 'file',
    title: 'Mengirim laporan penjualan harian',
    sub: '21.00 · dari Moka',
  },
];

export const initialBusiness: Business = {
  source: 'dari Moka',
  sales: 'Rp4.250.000',
  change: 'naik 12% dari Senin lalu',
  alert: 'Susu UHT tinggal 6 karton',
};
