import type { OrbitNode } from '@/ui/orbit/types';
import { iconOr } from '@/ui/icons';
import { friendlyError } from './errors';
import type { Home, StreamEvent } from './contract';
import type { Transport, Unsubscribe } from './transport';

export type HomeStatus = 'loading' | 'ready' | 'error';

export interface HomeState {
  /** Beranda terakhir yang diterima, atau `null` sebelum yang pertama. */
  home: Home | null;
  /** Simpul cincin dari `home`. Isi yang sama memakai larik yang sama, supaya aliran di cincin tidak mulai ulang. */
  ring: OrbitNode[];
  /** `loading`: belum ada Beranda; `error`: belum ada Beranda dan gagal memuat (`error` berisi teks ramah). */
  status: HomeStatus;
  error: string | null;
}

const INITIAL: HomeState = { home: null, ring: [], status: 'loading', error: null };

const sameNodes = (a: OrbitNode[], b: OrbitNode[]) =>
  a.length === b.length &&
  a.every(
    (n, i) => n.key === b[i]!.key && n.icon === b[i]!.icon && n.label === b[i]!.label && !n.offline === !b[i]!.offline,
  );

/**
 * Pemilik data Beranda: muat dari `GET /home`, perbarui lewat event stream `home` (upsert menurut `rev`; yang lebih
 * lama dibuang), muat ulang setiap koneksi stream terbuka (resync), dan ganti tempat. Hidup selama aplikasi terbuka
 * (lihat `HomeProvider`), jadi Beranda sudah terisi saat dibuka lagi.
 */
export class HomeController {
  private state: HomeState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private unsubscribe: Unsubscribe | null = null;
  private loading: Promise<void> | null = null;
  private alive = true;

  constructor(private readonly transport: Transport) {}

  getState = (): HomeState => this.state;

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
      () => void this.load(),
    );
    void this.load();
  }

  stop() {
    this.alive = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Muat Beranda dari server. Yang terakhir diambil dianggap benar (juga bila `rev`-nya lebih kecil, misalnya server diganti). */
  load = (): Promise<void> => {
    if (this.loading) return this.loading;
    if (this.state.home === null && this.state.status !== 'loading') this.set({ ...this.state, status: 'loading' });
    this.loading = this.transport.home().then(
      (home) => {
        this.loading = null;
        this.apply(home, true);
      },
      (e: unknown) => {
        this.loading = null;
        // Beranda yang sudah tampil tetap tampil; hanya layar kosong yang menampilkan kegagalan.
        if (this.state.home === null && this.alive) this.set({ ...INITIAL, status: 'error', error: friendlyError(e) });
      },
    );
    return this.loading;
  };

  /** Pilih tempat. `null` kalau berhasil, selain itu teks ramah untuk ditampilkan. */
  setPlace = async (place: string): Promise<string | null> => {
    try {
      this.apply(await this.transport.setPlace(place), false);
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  /** Hidupkan atau matikan perangkat dari kartu Rumah (server asli). `null` kalau berhasil, selain itu teks ramah. */
  controlDevice = async (deviceId: string, on: boolean): Promise<string | null> => {
    try {
      await this.transport.controlDevice(deviceId, { on });
      // Kartu Rumah mengikuti event `home`; muat ulang juga supaya tidak bergantung pada stream.
      void this.load();
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  private onEvent(event: StreamEvent) {
    if (event.type === 'home') this.apply(event.home, false);
  }

  /** `force`: ganti walau `rev` tidak lebih baru. Selain itu hanya `rev` yang lebih baru (atau sama dari jawaban sendiri) menang. */
  private apply(home: Home, force: boolean) {
    if (!this.alive) return;
    const current = this.state.home;
    if (!force && current && home.rev < current.rev) return;
    const next: OrbitNode[] = home.ring.nodes.map((n) => ({
      key: n.key,
      icon: iconOr(n.icon, 'link'),
      label: n.label,
      ...(n.reachable ? {} : { offline: true }),
    }));
    const ring = sameNodes(next, this.state.ring) ? this.state.ring : next;
    this.set({ home, ring, status: 'ready', error: null });
  }

  private set(next: HomeState) {
    this.state = next;
    for (const l of [...this.listeners]) l();
  }
}
