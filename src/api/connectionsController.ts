import { openAuthBrowser, type OpenAuth } from './authBrowser';
import {
  CANCELLED_TEXT,
  failureText,
  findService,
  parseCallbackUrl,
  redirectUrlOf,
  type ConnectCallback,
} from './connections';
import type { ConnectionDetail, ConnectionPermission, Connections, Service, StreamEvent } from './contract';
import { friendlyError } from './errors';
import { isApiFailure, type Transport, type Unsubscribe } from './transport';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface ListEntry {
  data: Connections | null;
  status: LoadStatus;
  error: string | null;
}

export interface DetailEntry {
  data: ConnectionDetail | null;
  status: LoadStatus;
  error: string | null;
}

/** Tahap menyambungkan satu layanan: membuka halaman resmi, menunggu pengguna selesai, lalu tersambung atau tidak. */
export type ConnectPhase = 'idle' | 'opening' | 'waiting' | 'connected' | 'failed' | 'cancelled';

export interface ConnectFlow {
  phase: ConnectPhase;
  /** Teks ramah untuk `failed` dan `cancelled`. */
  message: string | null;
}

export interface ConnectionsState {
  list: ListEntry;
  details: Record<string, DetailEntry>;
  flows: Record<string, ConnectFlow>;
  /** Pekerjaan yang sedang berjalan, `forget:<id>` dan `disconnect:<id>`. */
  busy: ReadonlySet<string>;
}

export type ActionResult = { ok: true } | { ok: false; message: string };
export type ForgetResult = { ok: true; forgotten: number } | { ok: false; message: string };

const NOT_FOUND_TEXT = 'Layanan ini tidak ditemukan.';
const IDLE: ConnectFlow = { phase: 'idle', message: null };
const INITIAL: ConnectionsState = {
  list: { data: null, status: 'loading', error: null },
  details: {},
  flows: {},
  busy: new Set(),
};

/** Paling lama menunggu layanan tampil tersambung setelah halaman resmi selesai. */
export const CONNECT_WAIT_MS = 6000;

const isConnected = (c: Connections | null, id: string) => !!c?.connected.some((s) => s.id === id);

/**
 * Pemilik data Terhubung: daftar dari `GET /connections`, detail per layanan dari `GET /connections/:id`, dan alur
 * menyambungkan lewat halaman masuk resmi (`POST /connections/:id/start`, dibuka dengan `openAuth`). Event stream
 * `connection` memperbarui daftar (upsert menurut `rev`; yang lebih lama dibuang); daftar dan detail dimuat ulang setiap
 * koneksi stream terbuka. Ubah izin dilakukan dulu di layar lalu dikembalikan kalau gagal. Hidup selama aplikasi
 * terbuka (lihat `ConnectionsProvider`).
 */
export class ConnectionsController {
  private state: ConnectionsState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private unsubscribe: Unsubscribe | null = null;
  private loadingList: Promise<void> | null = null;
  private readonly loadingDetail = new Map<string, Promise<void>>();
  private readonly connecting = new Map<string, Promise<void>>();
  private readonly waiters = new Map<string, Set<() => void>>();
  private readonly permissionSeq = new Map<string, number>();
  private alive = true;
  /** Sebuah layar sudah meminta daftar atau detail, jadi layak dimuat ulang. */
  private requested = false;

  constructor(
    private readonly transport: Transport,
    private readonly openAuth: OpenAuth = openAuthBrowser,
  ) {}

  getState = (): ConnectionsState => this.state;

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

  // ---- Memuat ----

  /** Muat daftar. Yang sudah ada tetap tampil selagi dimuat ulang. */
  load = (): Promise<void> => {
    this.requested = true;
    if (this.loadingList) return this.loadingList;
    if (!this.state.list.data && this.state.list.status !== 'loading') {
      this.setList({ data: null, status: 'loading', error: null });
    }
    const job = (async () => {
      try {
        // `rev` tidak pernah turun: jawaban yang lebih lama dari keadaan sekarang dibuang dan dimuat sekali lagi.
        for (let attempt = 0; attempt < 2; attempt++) {
          const data = await this.transport.connections();
          const have = this.state.list.data;
          if (have && data.rev < have.rev) continue;
          this.setList({ data, status: 'ready', error: null });
          break;
        }
      } catch (e) {
        if (!this.state.list.data && this.alive) this.setList({ data: null, status: 'error', error: friendlyError(e) });
      } finally {
        this.loadingList = null;
      }
    })();
    this.loadingList = job;
    return job;
  };

  /** Muat detail satu layanan. */
  loadDetail = (id: string): Promise<void> => {
    this.requested = true;
    const running = this.loadingDetail.get(id);
    if (running) return running;
    const entry = this.state.details[id];
    if (!entry?.data && entry?.status !== 'loading') this.setDetail(id, { data: null, status: 'loading', error: null });
    const job = (async () => {
      try {
        const data = await this.transport.connectionDetail(id);
        this.setDetail(id, { data, status: 'ready', error: null });
      } catch (e) {
        if (!this.state.details[id]?.data && this.alive) {
          const missing = isApiFailure(e) && e.status === 404;
          this.setDetail(id, { data: null, status: 'error', error: missing ? NOT_FOUND_TEXT : friendlyError(e) });
        }
      } finally {
        this.loadingDetail.delete(id);
      }
    })();
    this.loadingDetail.set(id, job);
    return job;
  };

  /** Muat ulang yang pernah diminta layar (daftar dan detail); belum ada yang meminta: tidak memuat apa-apa. */
  reloadAll = async (): Promise<void> => {
    if (!this.requested) return;
    await Promise.all([this.load(), ...Object.keys(this.state.details).map((id) => this.loadDetail(id))]);
  };

  // ---- Menyambungkan ----

  /**
   * Sambungkan satu layanan: minta alamat halaman masuk resmi, buka, tunggu kembali, lalu pastikan layanannya tampil
   * tersambung. Tidak ada kata sandi yang lewat aplikasi. Di mode `contoh` tidak ada halaman sungguhan: server tiruan
   * menyelesaikannya sendiri dan aplikasi menunggu.
   */
  connect = (id: string): Promise<void> => {
    const running = this.connecting.get(id);
    if (running) return running;
    this.setFlow(id, { phase: 'opening', message: null });
    const job = (async () => {
      const name = findService(this.state.list.data, id)?.name ?? 'layanan ini';
      try {
        const start = await this.transport.startConnection(id);
        this.setFlow(id, { phase: 'waiting', message: null });
        if (this.transport.mode === 'contoh') {
          await this.finish(id, name, { id, ok: true, reason: null });
          return;
        }
        const result = await this.openAuth(start.url, redirectUrlOf(start.callbackScheme));
        if (result.type === 'success') {
          await this.finish(id, name, parseCallbackUrl(result.url));
        } else if (await this.waitConnected(id, 0)) {
          // Halaman ditutup setelah server sudah menyimpan sambungannya.
          this.setFlow(id, { phase: 'connected', message: null });
        } else {
          this.setFlow(id, { phase: 'cancelled', message: CANCELLED_TEXT });
        }
      } catch (e) {
        this.setFlow(id, { phase: 'failed', message: friendlyError(e) });
      } finally {
        this.connecting.delete(id);
      }
    })();
    this.connecting.set(id, job);
    return job;
  };

  /**
   * Aplikasi dibuka (atau dikembalikan ke depan) oleh alamat kembali `…/terhubung/tersambung?id=&ok=`: alur sudah selesai
   * di luar aplikasi. Mengulang dengan alamat yang sama aman.
   */
  handleCallback = async (callback: ConnectCallback): Promise<void> => {
    if (!callback.id) return;
    if (!this.state.list.data) await this.load();
    const name = findService(this.state.list.data, callback.id)?.name ?? 'layanan ini';
    await this.finish(callback.id, name, callback);
  };

  resetFlow = (id: string) => {
    if (this.connecting.has(id) || !this.state.flows[id]) return;
    const flows = { ...this.state.flows };
    delete flows[id];
    this.set({ ...this.state, flows });
  };

  private async finish(id: string, name: string, callback: ConnectCallback) {
    if (!callback.ok) {
      this.setFlow(id, { phase: 'failed', message: failureText(name, callback.reason) });
      return;
    }
    if (await this.waitConnected(id, CONNECT_WAIT_MS)) {
      this.setFlow(id, { phase: 'connected', message: null });
    } else {
      this.setFlow(id, { phase: 'failed', message: failureText(name, null) });
    }
  }

  /** Layanan tampil tersambung? Cek daftar terbaru, lalu (kalau `ms` > 0) tunggu event `connection` paling lama `ms`. */
  private async waitConnected(id: string, ms: number): Promise<boolean> {
    if (isConnected(this.state.list.data, id)) return true;
    await this.load();
    if (isConnected(this.state.list.data, id)) {
      void this.loadDetail(id);
      return true;
    }
    if (ms <= 0) return false;
    return new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = (ok: boolean) => {
        clearTimeout(timer);
        this.waiters.get(id)?.delete(wake);
        resolve(ok);
      };
      const wake = () => {
        if (isConnected(this.state.list.data, id)) done(true);
      };
      const set = this.waiters.get(id) ?? new Set<() => void>();
      set.add(wake);
      this.waiters.set(id, set);
      timer = setTimeout(() => done(isConnected(this.state.list.data, id)), ms);
    }).then((ok) => {
      if (ok) void this.loadDetail(id);
      return ok;
    });
  }

  // ---- Mengubah ----

  /** Ubah izin: tampil dulu, dikembalikan kalau server menolak. */
  setPermission = async (id: string, permission: ConnectionPermission): Promise<ActionResult> => {
    const before = this.state.details[id]?.data;
    if (!before || before.permission === permission) return { ok: true };
    const seq = (this.permissionSeq.get(id) ?? 0) + 1;
    this.permissionSeq.set(id, seq);
    this.setDetail(id, { data: { ...before, permission }, status: 'ready', error: null });
    try {
      const next = await this.transport.setConnectionPermission(id, { permission });
      if (this.permissionSeq.get(id) === seq) this.setDetail(id, { data: next, status: 'ready', error: null });
      return { ok: true };
    } catch (e) {
      if (this.permissionSeq.get(id) === seq) this.setDetail(id, { data: before, status: 'ready', error: null });
      return { ok: false, message: friendlyError(e) };
    }
  };

  /** Hapus yang Nadia pelajari dari layanan ini; sambungannya tetap. */
  forget = async (id: string): Promise<ForgetResult> => {
    if (this.state.busy.has(`forget:${id}`)) return { ok: false, message: '' };
    this.setBusy(`forget:${id}`, true);
    try {
      const res = await this.transport.forgetConnection(id);
      const detail = this.state.details[id]?.data;
      if (detail) this.setDetail(id, { data: { ...detail, memoryCount: 0 }, status: 'ready', error: null });
      return { ok: true, forgotten: res.forgotten };
    } catch (e) {
      return { ok: false, message: friendlyError(e) };
    } finally {
      this.setBusy(`forget:${id}`, false);
    }
  };

  /** Putuskan layanan; ia pindah ke "pernah tersambung". */
  disconnect = async (id: string): Promise<ActionResult> => {
    if (this.state.busy.has(`disconnect:${id}`)) return { ok: false, message: '' };
    this.setBusy(`disconnect:${id}`, true);
    try {
      await this.transport.disconnectConnection(id);
      const was = findService(this.state.list.data, id);
      if (was) {
        const { needsAttention: _a, lastUsed: _l, ...rest } = was;
        this.applyService({ ...rest, status: 'formerly', ring: false }, false, undefined);
      }
      const details = { ...this.state.details };
      delete details[id];
      this.set({ ...this.state, details });
      void this.load();
      return { ok: true };
    } catch (e) {
      return { ok: false, message: friendlyError(e) };
    } finally {
      this.setBusy(`disconnect:${id}`, false);
    }
  };

  // ---- Dalaman ----

  private onEvent(event: StreamEvent) {
    if (event.type !== 'connection' || !this.alive) return;
    this.applyService(event.service, event.removed === true, event.rev);
    this.waiters.get(event.service.id)?.forEach((wake) => wake());
  }

  /** Taruh `service` di daftar menurut statusnya, atau buang kalau `removed`. `rev` lebih lama dari daftar: diabaikan. */
  private applyService(service: Service, removed: boolean, rev: number | undefined) {
    const list = this.state.list.data;
    if (!list || !service.id) return;
    if (rev !== undefined && rev < list.rev) return;
    const without = (xs: Service[]) => xs.filter((s) => s.id !== service.id);
    const put = (xs: Service[], front: boolean) => {
      const at = xs.findIndex((s) => s.id === service.id);
      if (at >= 0) return xs.map((s, i) => (i === at ? service : s));
      return front ? [service, ...xs] : [...xs, service];
    };
    const place = (target: 'connected' | 'catalog' | 'formerly', front: boolean): Connections => ({
      connected: target === 'connected' ? put(list.connected, front) : without(list.connected),
      catalog: target === 'catalog' ? put(list.catalog, front) : without(list.catalog),
      formerly: target === 'formerly' ? put(list.formerly, front) : without(list.formerly),
      rev: rev ?? list.rev,
    });
    let next: Connections;
    if (removed) {
      next = {
        connected: without(list.connected),
        catalog: without(list.catalog),
        formerly: without(list.formerly),
        rev: rev ?? list.rev,
      };
    } else if (service.status === 'connected') next = place('connected', false);
    else if (service.status === 'formerly') next = place('formerly', true);
    else next = place('catalog', false);
    const detail = this.state.details[service.id]?.data;
    const details =
      detail && !removed
        ? {
            ...this.state.details,
            [service.id]: { data: { ...detail, service }, status: 'ready' as const, error: null },
          }
        : this.state.details;
    this.set({ ...this.state, list: { data: next, status: 'ready', error: null }, details });
  }

  private setFlow(id: string, flow: ConnectFlow) {
    if (!this.alive) return;
    const have = this.state.flows[id] ?? IDLE;
    if (have.phase === flow.phase && have.message === flow.message) return;
    this.set({ ...this.state, flows: { ...this.state.flows, [id]: flow } });
  }

  private setBusy(key: string, on: boolean) {
    if (!this.alive || this.state.busy.has(key) === on) return;
    const busy = new Set(this.state.busy);
    if (on) busy.add(key);
    else busy.delete(key);
    this.set({ ...this.state, busy });
  }

  private setList(list: ListEntry) {
    if (!this.alive) return;
    this.set({ ...this.state, list });
  }

  private setDetail(id: string, entry: DetailEntry) {
    if (!this.alive) return;
    this.set({ ...this.state, details: { ...this.state.details, [id]: entry } });
  }

  private set(next: ConnectionsState) {
    this.state = next;
    for (const l of [...this.listeners]) l();
  }
}
