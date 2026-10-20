import type { DeviceCard, Draft, Message } from './contract';
import { applyThinking, NO_RUNS, type ActiveRuns } from './thinking';
import type { ConnectionStatus } from './transport';

/**
 * Pesan pengguna yang belum tersimpan di server (gelembung optimistis), dikenali dari `clientId`. Diganti pesan yang
 * tersimpan (dari jawaban `send` atau echo di stream) yang membawa `clientId` yang sama.
 */
export interface PendingMessage {
  clientId: string;
  text: string;
  /** `sending`: "mengirim…". `failed`: "Belum terkirim · Coba lagi". */
  status: 'sending' | 'failed';
  /** Diketik saat koneksi putus: menunggu terkirim begitu tersambung lagi. */
  queued: boolean;
  /** Pilihan tombol yang diambil (pesan dan pilihannya); `text` adalah judul pilihannya. */
  choice?: { messageId: string; choiceId: string };
}

export interface ChatState {
  /** Utas yang dimuat, dari yang terlama; urutan `seq`. Digabung berdasarkan `id`. */
  messages: readonly Message[];
  /** Gelembung optimistis, menurut urutan dibuat. */
  pending: readonly PendingMessage[];
  /** Nilai `?before=` untuk halaman yang lebih lama, atau `null` kalau tidak ada lagi. */
  olderCursor: number | null;
  hasOlder: boolean;
  loadingOlder: boolean;
  /** Halaman pertama riwayat sudah dimuat. */
  loaded: boolean;
  /** Halaman pertama gagal dimuat (bisa dicoba lagi). */
  loadFailed: boolean;
  /** Id pesan dari halaman pertama, untuk `?kosong=1` yang hanya menampilkan pesan sesudahnya. */
  initialIds: ReadonlySet<string> | null;
  /** `seq` terkecil di halaman pertama: pesan yang lebih lama (halaman berikutnya) juga tidak tampil di `?kosong=1`. */
  initialMinSeq: number | null;
  /** Id draf yang aksinya sedang berjalan: kartunya mengunci tombol sampai jawabannya datang. */
  busyDrafts: ReadonlySet<string>;
  /** `runId` asisten yang sedang berpikir. */
  runs: ActiveRuns;
  connection: ConnectionStatus;
  /** Pilihan yang sudah diketuk: id pesan → id pilihan. Tombolnya terkunci walau server belum menyiarkan `chosenId`. */
  locks: Readonly<Record<string, string>>;
}

const NO_DRAFTS: ReadonlySet<string> = new Set<string>();

export const initialChatState: ChatState = {
  messages: [],
  pending: [],
  olderCursor: null,
  hasOlder: false,
  loadingOlder: false,
  loaded: false,
  loadFailed: false,
  initialIds: null,
  initialMinSeq: null,
  busyDrafts: NO_DRAFTS,
  runs: NO_RUNS,
  connection: 'connecting',
  locks: {},
};

export type ChatAction =
  /** Halaman pertama riwayat (terbaru dulu). */
  | { type: 'loaded'; items: readonly Message[]; before: number | null }
  | { type: 'loadFailed' }
  | { type: 'olderStart' }
  /** Halaman yang lebih lama (terbaru dulu). */
  | { type: 'olderLoaded'; items: readonly Message[]; before: number | null }
  | { type: 'olderFailed' }
  /** Pesan dari stream, dari jawaban `send`, atau dari resync: pesan baru, atau upsert berdasarkan `id`. */
  | { type: 'message'; message: Message }
  | { type: 'merge'; items: readonly Message[] }
  /**
   * Perubahan draf: menimpa kartu dengan `draft.id` yang sama, kecuali `rev` lebih lama dari `rev` pesan yang memuat
   * kartunya. `rev` 0 = tidak diketahui: dipasang, tanpa mengubah `rev` pesan.
   */
  | { type: 'draft'; draft: Draft; rev: number }
  /** Aksi pada kartu draf mulai (`on`) atau selesai berjalan. */
  | { type: 'draftBusy'; id: string; on: boolean }
  /** Jawaban kendali perangkat: menggantikan kartu perangkat terbaru dengan `deviceId` yang sama. */
  | { type: 'device'; card: DeviceCard }
  | { type: 'thinking'; runId: string; on: boolean }
  /** Koneksi baru terbuka: event `thinking` yang terlewat tidak bisa diambil, jadi himpunan dikosongkan. */
  | { type: 'resync' }
  | { type: 'connection'; status: ConnectionStatus }
  | { type: 'pendingAdd'; pending: PendingMessage }
  /** Mulai (lagi) dikirim: keluar dari antrean dan dari keadaan gagal. */
  | { type: 'sendStarted'; clientId: string; queued?: boolean }
  | { type: 'sendFailed'; clientId: string }
  /** Gelembung optimistis dibuang (sudah tersimpan, atau ditolak). `unlock`: pilihannya dibuka lagi. */
  | { type: 'pendingDrop'; clientId: string; unlock?: boolean };

/** Sisipkan atau perbarui pesan. Tempatnya mengikuti `seq`; versi dengan `rev` lebih baru menang. */
function upsert(messages: readonly Message[], incoming: Message): readonly Message[] {
  const at = messages.findIndex((m) => m.id === incoming.id);
  if (at >= 0) {
    const known = messages[at]!;
    // `rev` yang sama atau lebih lama: tidak ada yang baru (jangan menimpa perubahan draf yang sudah dipasang).
    if (incoming.rev <= known.rev) return messages;
    const next = messages.slice();
    next[at] = { ...incoming, seq: known.seq };
    return next;
  }
  const next = messages.slice();
  const before = next.findIndex((m) => m.seq > incoming.seq);
  if (before < 0) next.push(incoming);
  else next.splice(before, 0, incoming);
  return next;
}

function upsertAll(messages: readonly Message[], items: readonly Message[]): readonly Message[] {
  return items.reduce(upsert, messages);
}

/** Gelembung optimistis yang sudah tersimpan (ada pesan dengan `clientId`-nya) dibuang. */
function settle(pending: readonly PendingMessage[], items: readonly Message[]): readonly PendingMessage[] {
  const saved = new Set(items.flatMap((m) => (m.clientId ? [m.clientId] : [])));
  if (saved.size === 0) return pending;
  const left = pending.filter((p) => !saved.has(p.clientId));
  return left.length === pending.length ? pending : left;
}

function withMessages(state: ChatState, items: readonly Message[]): ChatState {
  const messages = upsertAll(state.messages, items);
  const pending = settle(state.pending, items);
  return messages === state.messages && pending === state.pending ? state : { ...state, messages, pending };
}

function sameDraft(a: Draft, b: Draft): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Draft>;
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}

/** Pasang `draft` pada kartunya di `message`. Pembaruan yang lebih lama dari `rev` pesan atau tidak mengubah apa pun dilewati. */
function mapDraft(message: Message, draft: Draft, rev: number): Message {
  const carries = message.parts.some(
    (p) => p.type === 'card' && p.card.kind === 'draft' && p.card.draft.id === draft.id,
  );
  if (!carries || (rev > 0 && rev < message.rev)) return message;
  let changed = false;
  const parts = message.parts.map((part) => {
    if (part.type !== 'card' || part.card.kind !== 'draft' || part.card.draft.id !== draft.id) return part;
    if (sameDraft(part.card.draft, draft)) return part;
    changed = true;
    return { ...part, card: { ...part.card, draft } };
  });
  const nextRev = Math.max(message.rev, rev);
  if (!changed && nextRev === message.rev) return message;
  return { ...message, parts: changed ? parts : message.parts, rev: nextRev };
}

const isDeviceCard = (part: Message['parts'][number], deviceId: string) =>
  part.type === 'card' && part.card.kind === 'device' && part.card.deviceId === deviceId;

function patchPending(
  pending: readonly PendingMessage[],
  clientId: string,
  patch: Partial<PendingMessage>,
): readonly PendingMessage[] {
  return pending.map((p) => (p.clientId === clientId ? { ...p, ...patch } : p));
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'loaded': {
      const base = withMessages(state, action.items);
      return {
        ...base,
        loaded: true,
        loadFailed: false,
        olderCursor: state.loaded ? state.olderCursor : action.before,
        hasOlder: state.loaded ? state.hasOlder : action.before !== null,
        initialIds: state.initialIds ?? new Set(action.items.map((m) => m.id)),
        initialMinSeq:
          state.initialIds === null && action.items.length > 0
            ? Math.min(...action.items.map((m) => m.seq))
            : state.initialMinSeq,
      };
    }
    case 'loadFailed':
      return state.loaded ? state : { ...state, loadFailed: true };
    case 'olderStart':
      return state.loadingOlder || !state.hasOlder ? state : { ...state, loadingOlder: true };
    case 'olderLoaded':
      return {
        ...withMessages(state, action.items),
        loadingOlder: false,
        olderCursor: action.before,
        hasOlder: action.before !== null,
      };
    case 'olderFailed':
      return state.loadingOlder ? { ...state, loadingOlder: false } : state;
    case 'message':
      return withMessages(state, [action.message]);
    case 'merge':
      return action.items.length === 0 ? state : withMessages(state, action.items);
    case 'draft': {
      const messages = state.messages.map((m) => mapDraft(m, action.draft, action.rev));
      return messages.some((m, i) => m !== state.messages[i]) ? { ...state, messages } : state;
    }
    case 'draftBusy': {
      if (state.busyDrafts.has(action.id) === action.on) return state;
      const busyDrafts = new Set(state.busyDrafts);
      if (action.on) busyDrafts.add(action.id);
      else busyDrafts.delete(action.id);
      return { ...state, busyDrafts };
    }
    case 'device': {
      let at = state.messages.length - 1;
      while (at >= 0 && !state.messages[at]!.parts.some((p) => isDeviceCard(p, action.card.deviceId))) at -= 1;
      if (at < 0) return state;
      const messages = state.messages.slice();
      const m = messages[at]!;
      messages[at] = {
        ...m,
        parts: m.parts.map((p) => (isDeviceCard(p, action.card.deviceId) ? { type: 'card', card: action.card } : p)),
      };
      return { ...state, messages };
    }
    case 'thinking': {
      const runs = applyThinking(state.runs, action);
      return runs === state.runs ? state : { ...state, runs };
    }
    case 'resync':
      return state.runs.size === 0 ? state : { ...state, runs: NO_RUNS };
    case 'connection':
      return state.connection === action.status ? state : { ...state, connection: action.status };
    case 'pendingAdd': {
      const { choice } = action.pending;
      return {
        ...state,
        pending: [...state.pending, action.pending],
        locks: choice ? { ...state.locks, [choice.messageId]: choice.choiceId } : state.locks,
      };
    }
    case 'sendStarted':
      return {
        ...state,
        pending: patchPending(state.pending, action.clientId, { status: 'sending', queued: action.queued ?? false }),
      };
    case 'sendFailed':
      return { ...state, pending: patchPending(state.pending, action.clientId, { status: 'failed', queued: false }) };
    case 'pendingDrop': {
      const dropped = state.pending.find((p) => p.clientId === action.clientId);
      if (!dropped) return state;
      const locks = { ...state.locks };
      if (action.unlock && dropped.choice) delete locks[dropped.choice.messageId];
      return { ...state, pending: state.pending.filter((p) => p !== dropped), locks };
    }
  }
}

/** Sedang berpikir = himpunan `runId` aktif tidak kosong. */
export const isChatThinking = (state: ChatState): boolean => state.runs.size > 0;

/** Pilihan di pesan `messageId` yang sudah diambil: dari server (`chosenId`) atau dari ketukan yang masih berjalan. */
export function chosenIn(state: ChatState, message: Message): string | undefined {
  const part = message.parts.find((p) => p.type === 'choices');
  return (part?.type === 'choices' ? part.chosenId : undefined) ?? state.locks[message.id];
}
