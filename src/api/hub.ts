import type { StreamEvent } from './contract';
import type { ConnectionStatus, Unsubscribe } from './transport';

interface Listener {
  onEvent: (event: StreamEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
  onResync?: (lastSeq: number | undefined) => void;
}

/**
 * Pendengar stream milik satu transport: satu koneksi untuk semua pendengar. `start` dipanggil saat pendengar pertama
 * datang, `stop` saat pendengar terakhir pergi.
 */
export class StreamHub {
  private readonly listeners = new Set<Listener>();
  private current: ConnectionStatus = 'closed';
  private seq: number | undefined;

  constructor(private readonly hooks: { start: () => void; stop: () => void }) {}

  get status(): ConnectionStatus {
    return this.current;
  }

  get active(): boolean {
    return this.listeners.size > 0;
  }

  /** Seq terbesar yang sudah diterima (stream dan hasil fetch), atau `undefined`. */
  get lastSeq(): number | undefined {
    return this.seq;
  }

  /** Catat seq yang sudah diterima klien. Hanya naik. */
  noteSeq(seq: number) {
    if (this.seq === undefined || seq > this.seq) this.seq = seq;
  }

  add(listener: Listener): Unsubscribe {
    this.listeners.add(listener);
    safe(() => listener.onStatus(this.current));
    if (this.listeners.size === 1) this.hooks.start();
    return () => {
      if (!this.listeners.delete(listener)) return;
      if (this.listeners.size === 0) this.hooks.stop();
    };
  }

  emit(event: StreamEvent) {
    if (event.type === 'message') this.noteSeq(event.message.seq);
    for (const l of [...this.listeners]) safe(() => l.onEvent(event));
  }

  setStatus(status: ConnectionStatus) {
    if (status === this.current) return;
    this.current = status;
    for (const l of [...this.listeners]) safe(() => l.onStatus(status));
  }

  /** Koneksi baru terbuka: minta setiap pendengar mengambil pesan yang terlewat sejak {@link lastSeq}. */
  resync() {
    const lastSeq = this.seq;
    for (const l of [...this.listeners]) safe(() => l.onResync?.(lastSeq));
  }
}

/** Satu pendengar yang error tidak boleh menghentikan yang lain; kesalahannya hanya dicatat. */
function safe(run: () => void) {
  try {
    run();
  } catch (e) {
    console.error('Pendengar stream gagal', e);
  }
}
