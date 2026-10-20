import type { StreamEvent } from './contract';
import type { ConnectionStatus, Unsubscribe } from './transport';

interface Listener {
  onEvent: (event: StreamEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
  onResync?: () => void;
}

/**
 * Pendengar stream milik satu transport: satu koneksi untuk semua pendengar. `start` dipanggil saat pendengar pertama
 * datang, `stop` saat pendengar terakhir pergi.
 */
export class StreamHub {
  private readonly listeners = new Set<Listener>();
  private current: ConnectionStatus = 'closed';

  constructor(private readonly hooks: { start: () => void; stop: () => void }) {}

  get status(): ConnectionStatus {
    return this.current;
  }

  get active(): boolean {
    return this.listeners.size > 0;
  }

  add(listener: Listener): Unsubscribe {
    this.listeners.add(listener);
    listener.onStatus(this.current);
    if (this.listeners.size === 1) this.hooks.start();
    return () => {
      if (!this.listeners.delete(listener)) return;
      if (this.listeners.size === 0) this.hooks.stop();
    };
  }

  emit(event: StreamEvent) {
    for (const l of [...this.listeners]) l.onEvent(event);
  }

  setStatus(status: ConnectionStatus) {
    if (status === this.current) return;
    this.current = status;
    for (const l of [...this.listeners]) l.onStatus(status);
  }

  resync() {
    for (const l of [...this.listeners]) l.onResync?.();
  }
}
