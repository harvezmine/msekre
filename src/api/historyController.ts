import type { HistoryEntry, HistoryKind, StreamEvent } from './contract';
import { DRAFT_SENT_TEXT, friendlyError } from './errors';
import { isApiFailure, type Transport, type Unsubscribe } from './transport';

export type LoadStatus = 'loading' | 'ready' | 'error';

/** Satu daftar Riwayat (satu saringan): halaman yang sudah dimuat, dari yang terbaru. */
export interface HistoryList {
  items: HistoryEntry[];
  /** Penanda halaman yang lebih lama, atau `null` bila sudah habis. */
  before: string | null;
  status: LoadStatus;
  /** Teks ramah, kalau `status` `error`. */
  error: string | null;
  loadingMore: boolean;
  /** Teks ramah bila memuat halaman berikutnya gagal. */
  moreError: string | null;
}

export interface HistoryState {
  /** Per saringan: `semua` atau `kind`. */
  lists: Record<string, HistoryList>;
  /** `draftId` yang sedang dibatalkan. */
  cancelling: ReadonlySet<string>;
  /** Jam server dikurangi jam HP (ms), dari `now` jawaban terakhir; 0 bila server tidak menyebutnya. */
  skewMs: number;
}

export type CancelResult = { ok: true } | { ok: false; message: string };

const ALL = 'semua';
const keyOf = (kind?: HistoryKind) => kind ?? ALL;
const EMPTY_LIST: HistoryList = {
  items: [],
  before: null,
  status: 'loading',
  error: null,
  loadingMore: false,
  moreError: null,
};
const INITIAL: HistoryState = { lists: {}, cancelling: new Set(), skewMs: 0 };

const timeOf = (iso: string) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Pemilik data Riwayat: tiap saringan punya daftar sendiri dari `GET /history` (halaman demi halaman), event stream
 * `history` menambah atau mengubah entri di semua daftar yang cocok (upsert menurut `id`; `rev` yang lebih lama dibuang),
 * dan Batalkan memakai `POST /drafts/:id` `cancel`. Jam server (`now` di jawaban) dipakai untuk hitung mundur Batalkan.
 * Hidup selama aplikasi terbuka (lihat `HistoryProvider`).
 */
export class HistoryController {
  private state: HistoryState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private unsubscribe: Unsubscribe | null = null;
  private readonly loading = new Map<string, Promise<void>>();
  /** Naik tiap daftar diganti, supaya "muat lagi" yang terlambat tidak menempel di daftar yang sudah baru. */
  private readonly generation = new Map<string, number>();
  private readonly requested = new Set<string>();
  private rev = 0;
  private alive = true;

  constructor(private readonly transport: Transport) {}

  getState = (): HistoryState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Jam server sekarang (ms): jam HP digeser selisih yang terbaca dari `now` jawaban terakhir. */
  now = (): number => Date.now() + this.state.skewMs;

  start() {
    this.alive = true;
    if (this.unsubscribe) return;
    this.unsubscribe = this.transport.subscribe(
      (event) => this.onEvent(event),
      () => {},
      () => void this.reloadAll(),
    );
  }

  stop() {
    this.alive = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  // ---- Memuat ----

  /** Muat halaman pertama satu saringan. Yang sudah tampil tetap tampil selagi dimuat ulang. */
  load = (kind?: HistoryKind): Promise<void> => {
    const key = keyOf(kind);
    this.requested.add(key);
    const running = this.loading.get(key);
    if (running) return running;
    if (!this.state.lists[key]) this.setList(key, EMPTY_LIST);
    const job = (async () => {
      try {
        // `rev` tidak pernah turun: jawaban yang lebih lama dari yang sudah dilihat dibuang dan dimuat sekali lagi.
        for (let attempt = 0; attempt < 2; attempt++) {
          const page = await this.transport.history({ kind });
          if (page.rev < this.rev) continue;
          this.rev = page.rev;
          this.generation.set(key, (this.generation.get(key) ?? 0) + 1);
          this.setList(
            key,
            {
              items: page.items,
              before: page.before,
              status: 'ready',
              error: null,
              loadingMore: false,
              moreError: null,
            },
            this.skewOf(page.now),
          );
          return;
        }
      } catch (e) {
        const have = this.state.lists[key];
        if (this.alive && (!have || have.status !== 'ready')) {
          this.setList(key, { ...EMPTY_LIST, status: 'error', error: friendlyError(e) });
        }
      } finally {
        this.loading.delete(key);
      }
    })();
    this.loading.set(key, job);
    return job;
  };

  /** Muat halaman yang lebih lama dan taruh di ujung daftar. */
  loadMore = async (kind?: HistoryKind): Promise<void> => {
    const key = keyOf(kind);
    const list = this.state.lists[key];
    if (!list || list.status !== 'ready' || list.before === null || list.loadingMore) return;
    const gen = this.generation.get(key) ?? 0;
    this.setList(key, { ...list, loadingMore: true, moreError: null });
    try {
      const page = await this.transport.history({ kind, before: list.before });
      const now = this.state.lists[key];
      if (!now || (this.generation.get(key) ?? 0) !== gen) return;
      const known = new Set(now.items.map((e) => e.id));
      this.setList(
        key,
        {
          ...now,
          items: [...now.items, ...page.items.filter((e) => !known.has(e.id))],
          before: page.before,
          loadingMore: false,
          moreError: null,
        },
        this.skewOf(page.now),
      );
    } catch (e) {
      const now = this.state.lists[key];
      if (now && (this.generation.get(key) ?? 0) === gen) {
        this.setList(key, { ...now, loadingMore: false, moreError: friendlyError(e) });
      }
    }
  };

  /** Muat ulang semua saringan yang pernah dibuka (aplikasi kembali ke depan, stream tersambung lagi). */
  reloadAll = async (): Promise<void> => {
    await Promise.all([...this.requested].map((key) => this.load(key === ALL ? undefined : (key as HistoryKind))));
  };

  // ---- Batalkan ----

  /**
   * Batalkan kiriman yang masih ditahan. Satu kiriman hanya satu permintaan sekaligus (ketukan kedua diabaikan). Sudah
   * terkirim di tempat lain (409 `status_draf`): teks ramah dan daftar dimuat ulang.
   */
  cancel = async (entry: HistoryEntry): Promise<CancelResult> => {
    const draftId = entry.undoable?.draftId;
    if (!draftId || this.state.cancelling.has(draftId)) return { ok: false, message: '' };
    this.setCancelling(draftId, true);
    try {
      await this.transport.draftAction(draftId, { action: 'cancel' });
      this.patchEntries((e) => {
        if (e.undoable?.draftId !== draftId) return e;
        const { undoable: _gone, ...rest } = e;
        return { ...rest, status: 'dibatalkan' };
      });
      return { ok: true };
    } catch (e) {
      if (isApiFailure(e) && e.error === 'status_draf') {
        void this.reloadAll();
        return { ok: false, message: DRAFT_SENT_TEXT };
      }
      return { ok: false, message: friendlyError(e) };
    } finally {
      this.setCancelling(draftId, false);
    }
  };

  // ---- Dalaman ----

  private onEvent(event: StreamEvent) {
    if (event.type !== 'history' || !this.alive) return;
    if (event.rev < this.rev) return;
    this.rev = event.rev;
    const lists: Record<string, HistoryList> = {};
    for (const [key, list] of Object.entries(this.state.lists)) {
      lists[key] = list.status === 'ready' ? { ...list, items: upsert(list, key, event.entry) } : list;
    }
    this.set({ ...this.state, lists });
  }

  private patchEntries(change: (e: HistoryEntry) => HistoryEntry) {
    const lists: Record<string, HistoryList> = {};
    for (const [key, list] of Object.entries(this.state.lists)) lists[key] = { ...list, items: list.items.map(change) };
    this.set({ ...this.state, lists });
  }

  /** Jam server dari jawaban; dicatat bersama daftarnya (tanpa menyiarkan sendiri). */
  private skewOf(iso: string | undefined): number {
    const t = iso ? new Date(iso).getTime() : NaN;
    return Number.isNaN(t) ? this.state.skewMs : t - Date.now();
  }

  private setCancelling(draftId: string, on: boolean) {
    if (!this.alive || this.state.cancelling.has(draftId) === on) return;
    const cancelling = new Set(this.state.cancelling);
    if (on) cancelling.add(draftId);
    else cancelling.delete(draftId);
    this.set({ ...this.state, cancelling });
  }

  private setList(key: string, list: HistoryList, skewMs = this.state.skewMs) {
    if (!this.alive) return;
    this.set({ ...this.state, skewMs, lists: { ...this.state.lists, [key]: list } });
  }

  private set(next: HistoryState) {
    this.state = next;
    for (const l of [...this.listeners]) l();
  }
}

/**
 * Taruh `entry` di daftar `key`: menggantikan entri dengan `id` yang sama (atau membuangnya bila kini tidak cocok dengan
 * saringan), atau menyisipkannya menurut waktu. Entri yang lebih tua dari semua yang dimuat, sementara masih ada halaman
 * lama, tidak disisipkan: ia datang lewat "muat lagi".
 */
function upsert(list: HistoryList, key: string, entry: HistoryEntry): HistoryEntry[] {
  const matches = key === ALL || entry.kind === key;
  const at = list.items.findIndex((e) => e.id === entry.id);
  if (at >= 0) {
    if (!matches) return list.items.filter((_, i) => i !== at);
    return list.items.map((e, i) => (i === at ? entry : e));
  }
  if (!matches) return list.items;
  const t = timeOf(entry.at);
  let place = list.items.findIndex((e) => timeOf(e.at) < t);
  if (place < 0) {
    if (list.before !== null) return list.items;
    place = list.items.length;
  }
  return [...list.items.slice(0, place), entry, ...list.items.slice(place)];
}
