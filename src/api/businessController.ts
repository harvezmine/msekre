import { friendlyError } from './errors';
import type { Business, BusinessPeriod, StreamEvent } from './contract';
import type { MediaSource, Transport, Unsubscribe } from './transport';

export type BusinessStatus = 'loading' | 'ready' | 'error';

/** Usaha satu tempat dan rentang: jawaban terakhir `GET /business` yang diperbarui event stream dan "Pesan lagi". */
export interface BusinessEntry {
  data: Business | null;
  /** `loading`: belum ada data; `error`: belum ada data dan gagal memuat (`error` berisi teks ramah). */
  status: BusinessStatus;
  error: string | null;
}

export interface BusinessState {
  /** Menurut {@link businessKey}. */
  entries: Record<string, BusinessEntry>;
  /** Barang yang pesanannya sedang dibuat ("Pesan lagi" sedang berjalan). */
  busy: ReadonlySet<string>;
}

/** Hasil "Pesan lagi": draf di chat (`draftId`, `messageId`), atau teks ramah untuk toast. */
export type ReorderResult = { ok: true; draftId: string; messageId: string } | { ok: false; message: string };

const INITIAL: BusinessState = { entries: {}, busy: new Set() };

export const businessKey = (place: string, period: BusinessPeriod) => `${place}|${period}`;

/**
 * Pemilik data Usaha: cache per tempat dan rentang dari `GET /business`, diperbarui lewat event stream `business`
 * (upsert menurut `rev`; yang lebih lama dibuang) dan muat ulang setiap koneksi stream terbuka. "Pesan lagi" lewat
 * `POST /business/reorder`; satu barang paling banyak satu permintaan sekaligus. Hidup selama aplikasi terbuka (lihat
 * `BusinessProvider`).
 */
export class BusinessController {
  private state: BusinessState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private unsubscribe: Unsubscribe | null = null;
  private readonly loading = new Map<string, Promise<void>>();
  private readonly reordering = new Map<string, Promise<ReorderResult>>();
  private alive = true;

  constructor(private readonly transport: Transport) {}

  getState = (): BusinessState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

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

  /** Muat Usaha satu tempat dan rentang. Yang sudah ada tetap tampil selagi dimuat ulang. */
  load = (place: string, period: BusinessPeriod = 'hari'): Promise<void> => {
    const key = businessKey(place, period);
    const running = this.loading.get(key);
    if (running) return running;
    const entry = this.state.entries[key];
    if (!entry?.data && entry?.status !== 'loading') this.setEntry(key, { data: null, status: 'loading', error: null });
    const job = this.transport.business(place, period).then(
      (data) => {
        this.loading.delete(key);
        // Jawaban terakhir dianggap benar (juga bila `rev`-nya lebih kecil, misalnya server diganti).
        this.setEntry(key, { data, status: 'ready', error: null });
      },
      (e: unknown) => {
        this.loading.delete(key);
        if (!this.state.entries[key]?.data && this.alive)
          this.setEntry(key, { data: null, status: 'error', error: friendlyError(e) });
      },
    );
    this.loading.set(key, job);
    return job;
  };

  reloadAll = async (): Promise<void> => {
    await Promise.all(
      Object.keys(this.state.entries).map((key) => {
        const at = key.lastIndexOf('|');
        return this.load(key.slice(0, at), key.slice(at + 1) as BusinessPeriod);
      }),
    );
  };

  /**
   * Buat draf pesanan ke pemasok (tidak ada yang terkirim tanpa persetujuan). Dipanggil lagi selagi masih berjalan,
   * hasilnya permintaan yang sama. Berhasil: barang itu langsung bertanda punya draf di semua cache.
   */
  reorder = (stockId: string): Promise<ReorderResult> => {
    const running = this.reordering.get(stockId);
    if (running) return running;
    this.setBusy(stockId, true);
    const job = this.transport.businessReorder(stockId).then(
      (res): ReorderResult => {
        this.markReorder(stockId, res.draftId);
        return { ok: true, ...res };
      },
      (e: unknown): ReorderResult => ({ ok: false, message: friendlyError(e) }),
    );
    this.reordering.set(stockId, job);
    void job.finally(() => {
      this.reordering.delete(stockId);
      this.setBusy(stockId, false);
    });
    return job;
  };

  /** Cara mengunduh berkas laporan (`GET /media/:id`). */
  mediaUrl = (mediaId: string): Promise<MediaSource> => this.transport.mediaUrl(mediaId);

  // ---- Dalaman ----

  private onEvent(event: StreamEvent) {
    if (event.type !== 'business' || !this.alive) return;
    const { business } = event;
    const key = businessKey(business.place, business.period);
    const entry = this.state.entries[key];
    if (entry?.data && business.rev < entry.data.rev) return;
    this.setEntry(key, { data: business, status: 'ready', error: null });
  }

  private markReorder(stockId: string, draftId: string) {
    if (!this.alive) return;
    const entries = { ...this.state.entries };
    let changed = false;
    for (const [key, entry] of Object.entries(entries)) {
      if (!entry.data?.lowStock.some((s) => s.id === stockId && s.reorderDraftId !== draftId)) continue;
      const lowStock = entry.data.lowStock.map((s) => (s.id === stockId ? { ...s, reorderDraftId: draftId } : s));
      entries[key] = { ...entry, data: { ...entry.data, lowStock } };
      changed = true;
    }
    if (changed) this.set({ ...this.state, entries });
  }

  private setBusy(stockId: string, on: boolean) {
    if (!this.alive || this.state.busy.has(stockId) === on) return;
    const busy = new Set(this.state.busy);
    if (on) busy.add(stockId);
    else busy.delete(stockId);
    this.set({ ...this.state, busy });
  }

  private setEntry(key: string, entry: BusinessEntry) {
    if (!this.alive) return;
    this.set({ ...this.state, entries: { ...this.state.entries, [key]: entry } });
  }

  private set(next: BusinessState) {
    this.state = next;
    for (const l of [...this.listeners]) l();
  }
}
