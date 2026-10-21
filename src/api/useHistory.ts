import { useIsFocused } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { HistoryEntry, HistoryKind } from './contract';
import type { CancelResult, HistoryState, LoadStatus } from './historyController';
import { useHistoryControllerOptional } from './HistoryProvider';

export interface HistoryApi {
  /** Entri yang sudah dimuat, dari yang terbaru. */
  items: HistoryEntry[];
  status: LoadStatus;
  /** Teks ramah, kalau `status` `error`. */
  error: string | null;
  /** Masih ada halaman yang lebih lama. */
  hasMore: boolean;
  loadingMore: boolean;
  moreError: string | null;
  /** Muat ulang ("Coba lagi"). */
  retry: () => Promise<void>;
  /** Muat halaman yang lebih lama (ujung daftar tercapai). */
  loadMore: () => Promise<void>;
  /** Batalkan kiriman yang masih ditahan. */
  cancel: (entry: HistoryEntry) => Promise<CancelResult>;
  /** `draftId` yang sedang dibatalkan. */
  cancelling: ReadonlySet<string>;
  /** Jam server sekarang (ms); diperbarui tiap detik selama ada kiriman yang bisa dibatalkan. */
  now: number;
}

const EMPTY: HistoryState = { lists: {}, cancelling: new Set(), skewMs: 0 };
const noSubscribe = () => () => {};
const noState = () => EMPTY;
const nothing = async () => {};

/**
 * Riwayat untuk layar: daftar satu saringan (`kind`, kosong = semua) dari `GET /history`, halaman demi halaman, dengan
 * event `history` dan Batalkan. Sama di mode `contoh` dan `server`. Di luar provider hasilnya kosong.
 */
export function useHistory(kind?: HistoryKind): HistoryApi {
  const controller = useHistoryControllerOptional();
  const state = useSyncExternalStore(controller?.subscribe ?? noSubscribe, controller?.getState ?? noState);
  // Dimuat saat layar dibuka dan setiap kali kembali ke layar ini (dari layar lain di atasnya).
  const focused = useIsFocused();
  useEffect(() => {
    if (focused) void controller?.load(kind);
  }, [controller, kind, focused]);
  const list = state.lists[kind ?? 'semua'];
  const items = list?.items ?? [];
  // Jam HP, diperbarui tiap detik selama ada kiriman yang masih bisa dibatalkan; jam server = jam HP + selisih dari server.
  const [clock, setClock] = useState(() => Date.now());
  // Hanya kiriman yang `until`-nya belum lewat: yang sudah lewat tidak perlu detak tiap detik.
  const counting = items.some((e) => e.undoable && Date.parse(e.undoable.until) > clock + state.skewMs);
  useEffect(() => {
    if (!counting) return;
    const tick = () => setClock(Date.now());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [counting]);
  return {
    items,
    status: list?.status ?? 'loading',
    error: list?.error ?? null,
    hasMore: !!list && list.before !== null,
    loadingMore: list?.loadingMore ?? false,
    moreError: list?.moreError ?? null,
    retry: controller ? () => controller.load(kind) : nothing,
    loadMore: controller ? () => controller.loadMore(kind) : nothing,
    cancel: controller?.cancel ?? (async () => ({ ok: false, message: '' })),
    cancelling: state.cancelling,
    now: clock + state.skewMs,
  };
}
