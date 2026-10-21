import type { VoiceClientMessage, VoiceEvent } from './contract';
import type { Unsubscribe, VoiceCloseReason, VoiceSession } from './transport';

/**
 * Dasar sesi suara yang dipakai server tiruan dan server asli: pendengar, antrean sebelum terbuka, dan "tutup tepat
 * sekali". Isi transport memasang `transmit` (kirim ke soket / skenario) dan memanggil {@link opened}, {@link receive},
 * dan {@link finish}.
 */
export class VoiceChannel implements VoiceSession {
  private readonly events = new Set<(e: VoiceEvent) => void>();
  private readonly closers = new Set<(r: VoiceCloseReason) => void>();
  private queue: VoiceClientMessage[] | null = [];
  private done = false;
  /** Dipasang pemilik. Dipanggil untuk tiap pesan, juga yang tadinya diantre. */
  transmit: (message: VoiceClientMessage) => void = () => {};
  /** Dipasang pemilik. Dipanggil saat aplikasi menutup. */
  onLocalClose: () => void = () => {};

  get closed(): boolean {
    return this.done;
  }

  send(message: VoiceClientMessage) {
    if (this.done) return;
    if (this.queue) this.queue.push(message);
    else this.transmit(message);
  }

  close() {
    if (this.done) return;
    this.done = true;
    this.queue = null;
    this.events.clear();
    this.closers.clear();
    this.onLocalClose();
  }

  onEvent(listener: (event: VoiceEvent) => void): Unsubscribe {
    this.events.add(listener);
    return () => this.events.delete(listener);
  }

  onClose(listener: (reason: VoiceCloseReason) => void): Unsubscribe {
    this.closers.add(listener);
    return () => this.closers.delete(listener);
  }

  /** Soket terbuka: kirim yang diantre. */
  opened() {
    const queued = this.queue ?? [];
    this.queue = null;
    for (const m of queued) this.transmit(m);
  }

  receive(event: VoiceEvent) {
    if (this.done) return;
    for (const l of [...this.events]) {
      try {
        l(event);
      } catch (e) {
        console.error('Pendengar suara gagal', e);
      }
    }
  }

  /** Soket tertutup dari luar: beri tahu pendengar sekali. */
  finish(reason: VoiceCloseReason) {
    if (this.done) return;
    this.done = true;
    this.queue = null;
    const closers = [...this.closers];
    this.events.clear();
    this.closers.clear();
    for (const l of closers) {
      try {
        l(reason);
      } catch (e) {
        console.error('Pendengar suara gagal', e);
      }
    }
  }
}
