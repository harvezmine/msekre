import { useEffect, useSyncExternalStore } from 'react';
import { hasBusinessData } from './business';
import { businessKey, type BusinessController, type BusinessState, type BusinessStatus } from './businessController';
import { useBusinessControllerOptional } from './BusinessProvider';
import type { Business, BusinessPeriod } from './contract';

export interface BusinessApi {
  /** Jawaban terakhir untuk tempat dan rentang ini, atau `null` sebelum yang pertama. */
  data: Business | null;
  /** Ada yang bisa ditampilkan? `false` untuk pengguna tanpa data usaha (layar menampilkan keadaan kosong). */
  hasData: boolean;
  status: BusinessStatus;
  /** Teks ramah, kalau `status` `error`. */
  error: string | null;
  /** Muat ulang ("Coba lagi"). */
  retry: () => Promise<void>;
  /** Buat draf pesanan ke pemasok; tidak ada yang terkirim tanpa persetujuan. */
  reorder: BusinessController['reorder'];
  /** Cara mengunduh berkas laporan. */
  mediaUrl: BusinessController['mediaUrl'];
  /** Pesanan barang ini sedang dibuat. */
  isReordering: (stockId: string) => boolean;
}

const EMPTY: BusinessState = { entries: {}, busy: new Set() };
const noSubscribe = () => () => {};
const noState = () => EMPTY;

/**
 * Usaha satu tempat dan rentang untuk layar: dari pengendali bersama di {@link BusinessProvider} (`GET /business`, event
 * `business`), sama di mode `contoh` dan `server`. `place` kosong (belum diketahui) tidak memuat apa-apa. Di luar
 * provider hasilnya kosong.
 */
export function useBusiness(place: string | null | undefined, period: BusinessPeriod = 'hari'): BusinessApi {
  const controller = useBusinessControllerOptional();
  const state = useSyncExternalStore(controller?.subscribe ?? noSubscribe, controller?.getState ?? noState);
  useEffect(() => {
    if (place && controller) void controller.load(place, period);
  }, [place, period, controller]);
  const entry = place ? state.entries[businessKey(place, period)] : undefined;
  const data = entry?.data ?? null;
  return {
    data,
    hasData: data !== null && hasBusinessData(data),
    status: entry?.status ?? 'loading',
    error: entry?.error ?? null,
    retry: place && controller ? () => controller.load(place, period) : async () => {},
    reorder: controller?.reorder ?? (async () => ({ ok: false, message: '' })),
    mediaUrl: controller?.mediaUrl ?? (async () => ({ kind: 'sampleFile' })),
    isReordering: (stockId) => state.busy.has(stockId),
  };
}
