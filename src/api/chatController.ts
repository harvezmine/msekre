import { chatReducer, initialChatState, type ChatAction, type ChatState, type PendingMessage } from './chatState';
import { cardFromDevice } from './devices';
import type { DeviceCard, DeviceControlReq, DraftActionReq, SendMessageReq, StreamEvent } from './contract';
import { DRAFT_CHANGED_TEXT, DRAFT_SENT_TEXT, friendlyError } from './errors';
import { isApiFailure, type MediaSource, type Transport } from './transport';

export type DraftActionName = DraftActionReq['action'];

/** Paling banyak halaman lama yang dimuat mencari draf untuk "Lihat draf". */
export const FIND_DRAFT_MAX_PAGES = 5;

/** Tanda "berpikir" yang tidak pernah dimatikan (event `off` hilang) padam sendiri setelah selama ini. */
export const THINKING_MAX_MS = 3 * 60_000;

/**
 * Pemilik keadaan utas untuk satu transport: menggabungkan hasil request dan event stream ke {@link chatReducer},
 * mengurus gelembung optimistis, antrean saat koneksi putus, dan resync. Tidak tahu React; `useChat` membungkusnya.
 * Semua aksi tidak pernah melempar: kegagalan menjadi keadaan di layar (gelembung "Belum terkirim") atau teks ramah
 * lewat penerima galat.
 */
export class ChatController {
  /** Penerima yang dipasang terakhir (layar paling atas: chat di atas Beranda) yang menerima; lihat `addErrorHandler`. */
  private readonly errorHandlers: ((text: string) => void)[] = [];
  private readonly pinHandlers: ((deviceId: string) => void)[] = [];

  private state: ChatState = initialChatState;
  private readonly listeners = new Set<() => void>();
  private unsubscribe: (() => void) | null = null;
  private initial: Promise<void> | null = null;
  private catchUpChain: Promise<void> = Promise.resolve();
  private flushing = false;
  private reconnectedWhileLoading = false;
  private readonly thinkTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private olderJob: Promise<void> | null = null;
  private counter = 0;
  private readonly salt = Math.random().toString(36).slice(2, 8);

  constructor(readonly transport: Transport) {}

  /**
   * Pasang penerima teks ramah (tanpa kode error) saat aksi kartu gagal, misalnya untuk toast. Beberapa layar boleh
   * memasang sekaligus (Beranda dan chat); yang terakhir dipasang yang menerima. Hasilnya melepas penerima itu.
   */
  addErrorHandler(handler: (text: string) => void): () => void {
    return addLast(this.errorHandlers, handler);
  }

  /** Pasang penerima "perangkat ini butuh PIN" (428 `pin_diperlukan`), misalnya untuk membuka lembar PIN. */
  addPinHandler(handler: (deviceId: string) => void): () => void {
    return addLast(this.pinHandlers, handler);
  }

  private onError(text: string) {
    this.errorHandlers.at(-1)?.(text);
  }

  private get onPinRequired(): ((deviceId: string) => void) | undefined {
    return this.pinHandlers.at(-1);
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
    for (const timer of this.thinkTimers.values()) clearTimeout(timer);
    this.thinkTimers.clear();
  }

  private onEvent(event: StreamEvent) {
    switch (event.type) {
      case 'message':
        this.dispatch({ type: 'message', message: event.message });
        break;
      case 'draft':
        this.dispatch({ type: 'draft', draft: event.draft, rev: event.rev });
        break;
      case 'thinking':
        this.dispatch({ type: 'thinking', runId: event.runId, on: event.on });
        this.watchThinking(event.runId, event.on);
        break;
      case 'device':
        // Kartu perangkat terakhir di utas mengikuti perangkatnya, juga bila diubah dari Beranda atau Perangkat.
        for (const device of event.devices ?? []) this.dispatch({ type: 'device', card: cardFromDevice(device) });
        break;
      case 'ping':
        break;
    }
  }

  /** Pengaman: `runId` yang menyala terlalu lama (event `off` hilang) dimatikan sendiri. */
  private watchThinking(runId: string, on: boolean) {
    const old = this.thinkTimers.get(runId);
    if (old) clearTimeout(old);
    this.thinkTimers.delete(runId);
    if (!on) return;
    this.thinkTimers.set(
      runId,
      setTimeout(() => {
        this.thinkTimers.delete(runId);
        this.dispatch({ type: 'thinking', runId, on: false });
      }, THINKING_MAX_MS),
    );
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
        // Stream yang terbuka selagi halaman ini diambil bisa melewatkan pesan di antaranya: ambil yang berubah.
        if (this.reconnectedWhileLoading) this.queueCatchUp(this.maxRev());
      } catch {
        this.dispatch({ type: 'loadFailed' });
      } finally {
        this.initial = null;
        this.reconnectedWhileLoading = false;
      }
    })();
    return this.initial;
  };

  /** Halaman yang lebih lama, saat menggulir ke ujung atas. Dipanggil lagi selagi berjalan: menunggu yang berjalan. */
  loadOlder = (): Promise<void> => {
    if (this.olderJob) return this.olderJob;
    const { hasOlder, loadingOlder, olderCursor } = this.state;
    if (!hasOlder || loadingOlder || olderCursor === null) return Promise.resolve();
    this.dispatch({ type: 'olderStart' });
    const job = (async () => {
      try {
        const page = await this.transport.messages(olderCursor);
        this.dispatch({ type: 'olderLoaded', items: page.items, before: page.before });
      } catch {
        this.dispatch({ type: 'olderFailed' });
      } finally {
        this.olderJob = null;
      }
    })();
    this.olderJob = job;
    return job;
  };

  /**
   * Pastikan pesan yang memuat kartu draf `draftId` (atau pesan `messageId`) ada di utas, untuk "Lihat draf": dimuat bila
   * belum ada, lalu pesan yang berubah diambil (resync), lalu halaman yang lebih lama paling banyak
   * {@link FIND_DRAFT_MAX_PAGES} kali. `false` kalau tetap tidak ketemu (sudah dikirim dan terlalu lama, atau dibuang).
   */
  ensureDraft = async (draftId: string, messageId?: string): Promise<boolean> => {
    const has = () =>
      this.state.messages.some(
        (m) =>
          (messageId !== undefined && m.id === messageId) ||
          m.parts.some((p) => p.type === 'card' && p.card.kind === 'draft' && p.card.draft.id === draftId),
      );
    if (has()) return true;
    if (!this.state.loaded) await this.loadInitial();
    if (has()) return true;
    await this.queueCatchUp(this.maxRev());
    if (has()) return true;
    for (let page = 0; page < FIND_DRAFT_MAX_PAGES && this.state.hasOlder; page++) {
      await this.loadOlder();
      if (has()) return true;
    }
    return has();
  };

  /** Koneksi baru terbuka: ambil pesan yang terlewat. */
  private onResync(lastRev: number | undefined) {
    this.dispatch({ type: 'resync' });
    for (const timer of this.thinkTimers.values()) clearTimeout(timer);
    this.thinkTimers.clear();
    if (!this.state.loaded) {
      this.reconnectedWhileLoading = true;
      void this.loadInitial();
      return;
    }
    this.queueCatchUp(lastRev);
  }

  /** `rev` terbesar di utas yang dimuat; 0 kalau kosong. */
  private maxRev(): number {
    return this.state.messages.reduce((max, m) => Math.max(max, m.rev), 0);
  }

  /** Antrekan pengambilan pesan yang berubah sejak `from` (tanpa `from`: halaman terbaru). Janjinya selesai bersama. */
  private queueCatchUp(from: number | undefined): Promise<void> {
    this.catchUpChain = this.catchUpChain.then(() => (from === undefined ? this.latest() : this.catchUp(from)));
    return this.catchUpChain;
  }

  /** `messagesChanged` berulang selama `more`, dari `rev` pesan terakhir. */
  private async catchUp(from: number) {
    try {
      let rev = from;
      for (;;) {
        const page = await this.transport.messagesChanged(rev);
        this.dispatch({ type: 'merge', items: page.items });
        const last = page.items[page.items.length - 1];
        // Halaman yang tidak maju (server salah, atau `rev` yang sama) tidak boleh membuat putaran tanpa akhir.
        if (!page.more || !last || last.rev <= rev) return;
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

  /** Diantre juga selagi antrean sedang dikirim, supaya tidak menyalip pesan yang diketik lebih dulu. */
  private get mustQueue(): boolean {
    return this.offline || this.flushing;
  }

  private newClientId(): string {
    this.counter += 1;
    return `app-${this.salt}-${Date.now().toString(36)}-${this.counter}`;
  }

  private add(pending: Omit<PendingMessage, 'status' | 'queued' | 'clientId'>) {
    const clientId = this.newClientId();
    const queued = this.mustQueue;
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
    const queued = this.mustQueue;
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

  /**
   * Aksi pada kartu draf. Hasilnya menimpa kartu (event `draft` yang sama menyusul dan diabaikan). Kartu terkunci
   * selama aksinya berjalan (ketukan kedua diabaikan). Draf yang sudah berubah di tempat lain (409 `status_draf`) memberi
   * teks ramah dan mengambil keadaan terbarunya.
   */
  draftAction = async (id: string, action: DraftActionName, text?: string): Promise<void> => {
    if (this.state.busyDrafts.has(id)) return;
    const req: DraftActionReq = action === 'edit' ? { action, text: text ?? '' } : { action };
    this.dispatch({ type: 'draftBusy', id, on: true });
    try {
      const res = await this.transport.draftAction(id, req);
      this.dispatch({ type: 'draft', draft: res.draft, rev: res.rev });
    } catch (e) {
      if (isApiFailure(e) && e.error === 'status_draf') {
        this.onError(action === 'cancel' ? DRAFT_SENT_TEXT : DRAFT_CHANGED_TEXT);
        await this.queueCatchUp(this.maxRev());
      } else {
        this.onError(friendlyError(e));
      }
    } finally {
      this.dispatch({ type: 'draftBusy', id, on: false });
    }
  };

  /** Atur perangkat dari kartu. Gagal: teks ramah lewat penerima galat dan hasilnya `null`. */
  controlDevice = async (deviceId: string, req: DeviceControlReq): Promise<DeviceCard | null> => {
    try {
      const { card } = await this.transport.controlDevice(deviceId, req);
      this.dispatch({ type: 'device', card });
      return card;
    } catch (e) {
      // Butuh PIN: lembar PIN yang bicara, bukan toast buntu.
      if (isApiFailure(e) && e.code === 'pin_required' && this.onPinRequired) this.onPinRequired(deviceId);
      else this.onError(friendlyError(e));
      return null;
    }
  };

  mediaUrl = (mediaId: string): Promise<MediaSource> => this.transport.mediaUrl(mediaId);
}

/** Tambahkan `item` di akhir `list`; hasilnya melepasnya lagi (yang terakhir dengan nilai sama). */
function addLast<T>(list: T[], item: T): () => void {
  list.push(item);
  return () => {
    const i = list.lastIndexOf(item);
    if (i >= 0) list.splice(i, 1);
  };
}
