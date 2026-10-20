import { chatReducer, initialChatState, type ChatAction, type ChatState, type PendingMessage } from './chatState';
import type { DeviceCard, DeviceControlReq, DraftActionReq, SendMessageReq, StreamEvent } from './contract';
import { friendlyError } from './errors';
import { isApiFailure, type MediaSource, type Transport } from './transport';

export type DraftActionName = DraftActionReq['action'];

/**
 * Pemilik keadaan utas untuk satu transport: menggabungkan hasil request dan event stream ke {@link chatReducer},
 * mengurus gelembung optimistis, antrean saat koneksi putus, dan resync. Tidak tahu React; `useChat` membungkusnya.
 * Semua aksi tidak pernah melempar: kegagalan menjadi keadaan di layar (gelembung "Belum terkirim") atau teks ramah
 * lewat penerima galat.
 */
export class ChatController {
  private onError: ((text: string) => void) | undefined;

  private state: ChatState = initialChatState;
  private readonly listeners = new Set<() => void>();
  private unsubscribe: (() => void) | null = null;
  private initial: Promise<void> | null = null;
  private catchUpChain: Promise<void> = Promise.resolve();
  private flushing = false;
  private counter = 0;
  private readonly salt = Math.random().toString(36).slice(2, 8);

  constructor(readonly transport: Transport) {}

  /** Penerima teks ramah (tanpa kode error) saat aksi kartu gagal, misalnya untuk toast. */
  setErrorHandler(handler: ((text: string) => void) | undefined) {
    this.onError = handler;
  }

  // ---- Untuk useSyncExternalStore ----

  getState = (): ChatState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private dispatch(action: ChatAction) {
    const next = chatReducer(this.state, action);
    if (next === this.state) return;
    this.state = next;
    for (const l of [...this.listeners]) l();
  }

  // ---- Hidup-mati ----

  /** Mulai mendengarkan stream dan muat riwayat. Aman dipanggil dua kali. */
  start() {
    if (this.unsubscribe) return;
    this.unsubscribe = this.transport.subscribe(
      (event) => this.onEvent(event),
      (status) => {
        this.dispatch({ type: 'connection', status });
        if (status === 'open') void this.flush();
      },
      (lastRev) => this.onResync(lastRev),
    );
    void this.loadInitial();
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private onEvent(event: StreamEvent) {
    switch (event.type) {
      case 'message':
        this.dispatch({ type: 'message', message: event.message });
        break;
      case 'draft':
        this.dispatch({ type: 'draft', draft: event.draft });
        break;
      case 'thinking':
        this.dispatch({ type: 'thinking', runId: event.runId, on: event.on });
        break;
      case 'ping':
        break;
    }
  }

  // ---- Riwayat ----

  /** Halaman pertama riwayat. Satu permintaan sekaligus; sesudah berhasil tidak mengulang. */
  loadInitial = (): Promise<void> => {
    if (this.state.loaded) return Promise.resolve();
    if (this.initial) return this.initial;
    this.initial = (async () => {
      try {
        const page = await this.transport.messages();
        this.dispatch({ type: 'loaded', items: page.items, before: page.before });
      } catch {
        this.dispatch({ type: 'loadFailed' });
      } finally {
        this.initial = null;
      }
    })();
    return this.initial;
  };

  /** Halaman yang lebih lama, saat menggulir ke ujung atas. */
  loadOlder = async (): Promise<void> => {
    const { hasOlder, loadingOlder, olderCursor } = this.state;
    if (!hasOlder || loadingOlder || olderCursor === null) return;
    this.dispatch({ type: 'olderStart' });
    try {
      const page = await this.transport.messages(olderCursor);
      this.dispatch({ type: 'olderLoaded', items: page.items, before: page.before });
    } catch {
      this.dispatch({ type: 'olderFailed' });
    }
  };

  /** Koneksi baru terbuka: ambil pesan yang terlewat. */
  private onResync(lastRev: number | undefined) {
    this.dispatch({ type: 'resync' });
    if (!this.state.loaded) {
      void this.loadInitial();
      return;
    }
    this.catchUpChain = this.catchUpChain.then(() => (lastRev === undefined ? this.latest() : this.catchUp(lastRev)));
  }

  /** `messagesChanged` berulang selama `more`, dari `rev` pesan terakhir. */
  private async catchUp(from: number) {
    try {
      let rev = from;
      for (;;) {
        const page = await this.transport.messagesChanged(rev);
        this.dispatch({ type: 'merge', items: page.items });
        const last = page.items[page.items.length - 1];
        if (!page.more || !last) return;
        rev = last.rev;
      }
    } catch {
      // Percobaan berikutnya: koneksi terbuka lagi atau layar dibuka lagi.
    }
  }

  /** Belum ada `rev` yang dikenal tapi riwayat sudah ada (misalnya halaman pertama dari awal): gabungkan halaman terbaru. */
  private async latest() {
    try {
      const page = await this.transport.messages();
      this.dispatch({ type: 'merge', items: page.items });
    } catch {
      // Lihat catchUp.
    }
  }

  // ---- Mengirim ----

  /** Koneksi sedang putus atau belum tersambung: pesan diantre, bukan dikirim. */
  private get offline(): boolean {
    const { connection } = this.state;
    return connection === 'connecting' || connection === 'closed';
  }

  private newClientId(): string {
    this.counter += 1;
    return `app-${this.salt}-${Date.now().toString(36)}-${this.counter}`;
  }

  private add(pending: Omit<PendingMessage, 'status' | 'queued' | 'clientId'>) {
    const clientId = this.newClientId();
    const queued = this.offline;
    this.dispatch({ type: 'pendingAdd', pending: { ...pending, clientId, status: 'sending', queued } });
    if (!queued) void this.deliver(clientId);
  }

  /** Kirim teks. Gelembung "mengirim…" langsung tampil; tanpa koneksi, pesan diantre sampai tersambung. */
  send = (text: string): void => {
    const value = text.trim();
    if (value) this.add({ text: value });
  };

  /** Ketuk satu tombol pilihan: tombolnya terkunci dan jawabannya terkirim sebagai pesan. */
  choose = (messageId: string, choiceId: string): void => {
    if (this.state.locks[messageId] !== undefined) return;
    const message = this.state.messages.find((m) => m.id === messageId);
    const part = message?.parts.find((p) => p.type === 'choices');
    if (part?.type !== 'choices' || part.chosenId !== undefined) return;
    const choice = part.choices.find((c) => c.id === choiceId);
    if (choice) this.add({ text: choice.title, choice: { messageId, choiceId } });
  };

  /** "Coba lagi" pada gelembung yang belum terkirim. */
  retry = (clientId: string): void => {
    const pending = this.state.pending.find((p) => p.clientId === clientId);
    if (pending?.status !== 'failed') return;
    const queued = this.offline;
    this.dispatch({ type: 'sendStarted', clientId, queued });
    if (!queued) void this.deliver(clientId);
  };

  private async deliver(clientId: string): Promise<void> {
    const pending = this.state.pending.find((p) => p.clientId === clientId);
    if (!pending) return;
    const req: SendMessageReq = pending.choice
      ? { kind: 'choice', clientId, messageId: pending.choice.messageId, choiceId: pending.choice.choiceId }
      : { kind: 'text', clientId, text: pending.text };
    try {
      const message = await this.transport.send(req);
      this.dispatch({ type: 'message', message });
      this.dispatch({ type: 'pendingDrop', clientId });
    } catch (e) {
      // Pilihan itu sudah diambil di tempat lain: upsert `chosenId` menyusul, tidak perlu "Coba lagi".
      if (isApiFailure(e) && e.error === 'sudah_dipilih')
        this.dispatch({ type: 'pendingDrop', clientId, unlock: true });
      else this.dispatch({ type: 'sendFailed', clientId });
    }
  }

  /** Koneksi kembali: kirim pesan yang diantre, satu per satu menurut urutan ketik. */
  private async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      for (;;) {
        const next = this.state.pending.find((p) => p.queued);
        if (!next || this.offline) return;
        this.dispatch({ type: 'sendStarted', clientId: next.clientId });
        await this.deliver(next.clientId);
      }
    } finally {
      this.flushing = false;
    }
  }

  // ---- Kartu ----

  /** Aksi pada kartu draf. Hasilnya menimpa kartu (event `draft` yang sama menyusul dan diabaikan). */
  draftAction = async (id: string, action: DraftActionName, text?: string): Promise<void> => {
    const req: DraftActionReq = action === 'edit' ? { action, text: text ?? '' } : { action };
    try {
      const draft = await this.transport.draftAction(id, req);
      this.dispatch({ type: 'draft', draft });
    } catch (e) {
      this.onError?.(friendlyError(e));
    }
  };

  /** Atur perangkat dari kartu. Sebelum Fase 3 server membalas `belum_tersedia`: teks ramah lewat penerima galat. */
  controlDevice = async (deviceId: string, req: DeviceControlReq): Promise<DeviceCard | null> => {
    try {
      const card = await this.transport.controlDevice(deviceId, req);
      this.dispatch({ type: 'device', card });
      return card;
    } catch (e) {
      this.onError?.(friendlyError(e));
      return null;
    }
  };

  mediaUrl = (mediaId: string): Promise<MediaSource> => this.transport.mediaUrl(mediaId);
}
