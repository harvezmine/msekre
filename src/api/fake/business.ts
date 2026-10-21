import { businessData, BUSINESS_PLACES, REPORT, SPARK_DAYS, STOCK } from '@/sample/business';
import type { Business, BusinessPeriod, BusinessPoint } from '../contract';
import { FAKE_TZ_MINUTES } from './agenda';
import { wibIso } from './clock';
import { SAMPLE_FILE_MEDIA_ID } from './history';

const roundK = (n: number) => Math.round(n / 1000) * 1000;

const COMPARE: Record<BusinessPeriod, string> = { hari: 'Senin lalu', minggu: 'pekan lalu', bulan: 'bulan lalu' };

/** Asal data di contoh: kasir, rekening, marketplace yang tersambung, dan satu yang belum. */
export const SAMPLE_SOURCES = [
  { key: 'moka', label: 'Moka', connected: true, service: 'moka', provides: ['sales', 'stock'] },
  { key: 'moota', label: 'rekening BCA', connected: true, service: 'bca', provides: ['moneyIn'] },
  { key: 'tiktok_shop', label: 'TikTok Shop', connected: true, service: 'tiktok', provides: ['orders'] },
  { key: 'shopee', label: 'Shopee', connected: false, service: 'shopee', provides: ['orders'] },
];

/**
 * Total dan grafik satu rentang dari penjualan tujuh hari terakhir:
 * - `hari`: total hari ini, grafik tujuh hari;
 * - `minggu`: total tujuh hari, grafik empat pekan;
 * - `bulan`: total bulan ini (3,1 kali tujuh hari), grafik enam bulan.
 */
export function periodView(daily: number[], period: BusinessPeriod): { total: number; series: BusinessPoint[] } {
  const week = daily.reduce((a, b) => a + b, 0);
  if (period === 'hari') {
    return { total: daily[daily.length - 1]!, series: daily.map((value, i) => ({ label: SPARK_DAYS[i]!, value })) };
  }
  if (period === 'minggu') {
    const values = [0.93, 0.99, 0.95, 1].map((f) => roundK(week * f));
    return { total: week, series: values.map((value, i) => ({ label: `Mgg ${i + 1}`, value })) };
  }
  const month = roundK(week * 3.1);
  const labels = ['Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt'];
  const values = [0.84, 0.9, 0.95, 0.92, 0.97, 1].map((f) => roundK(month * f));
  return { total: month, series: values.map((value, i) => ({ label: labels[i]!, value })) };
}

/**
 * `GET /business` dari data usaha contoh. `reorderOf(stockId)`: id draf pesanan yang masih menunggu persetujuan untuk
 * barang itu. Tempat tanpa usaha (Rumah) menjawab kosong dan tanpa sumber yang tersambung.
 */
export function businessFrom(
  place: string,
  period: BusinessPeriod,
  reorderOf: (stockId: string) => string | undefined,
): Omit<Business, 'rev'> {
  const known = place === 'Semua' || (BUSINESS_PLACES as readonly string[]).includes(place);
  const data = known ? businessData[place as 'Semua'] : null;
  if (!data) {
    return {
      place,
      period,
      sales: { total: 0, change: 0, down: false, compareLabel: COMPARE[period] },
      series: [],
      branches: [],
      moneyIn: [],
      lowStock: [],
      orders: [],
      report: null,
      sources: SAMPLE_SOURCES.map((s) => ({ ...s, provides: [...s.provides], connected: false })),
      tzOffsetMinutes: FAKE_TZ_MINUTES,
    };
  }
  const view = periodView(data.daily, period);
  const change = data.change[period];
  return {
    place,
    period,
    sales: { total: view.total, change: change.pct, down: change.down, compareLabel: COMPARE[period] },
    series: view.series,
    branches:
      place === 'Semua'
        ? BUSINESS_PLACES.map((name) => {
            const branch = businessData[name];
            const c = branch.change[period];
            return {
              place: name,
              name,
              total: periodView(branch.daily, period).total,
              change: c.pct,
              down: c.down,
            };
          })
        : [],
    moneyIn: data.moneyIn.map((m) => ({
      id: m.id,
      source: m.source,
      amount: m.amount,
      at: wibIso(10, 20, m.time),
      ...(m.note ? { note: m.note } : {}),
    })),
    lowStock: data.lowStock.map(({ stockId, left }) => {
      const stock = STOCK[stockId]!;
      const draftId = reorderOf(stockId);
      return {
        id: stock.id,
        name: stock.name,
        left,
        unit: stock.unit,
        supplier: { ...stock.supplier },
        ...(draftId ? { reorderDraftId: draftId } : {}),
      };
    }),
    orders: data.orders.map((o) => ({
      id: o.id,
      channel: o.channel,
      summary: o.summary,
      amount: o.amount,
      status: o.status,
      at: wibIso(10, 20, o.time),
    })),
    report: { mediaId: SAMPLE_FILE_MEDIA_ID, name: REPORT.name, size: REPORT.size, period: REPORT.period },
    sources: SAMPLE_SOURCES.map((s) => ({ ...s, provides: [...s.provides] })),
    tzOffsetMinutes: FAKE_TZ_MINUTES,
  };
}
