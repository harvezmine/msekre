import {
  chatReducer,
  chosenIn,
  initialChatState,
  isChatThinking,
  type ChatAction,
  type ChatState,
  type PendingMessage,
} from '@/api/chatState';
import type { Draft, Message, Part } from '@/api/contract';

const AT = '2026-10-20T03:42:00.000Z';

function msg(seq: number, text: string, extra: Partial<Message> = {}): Message {
  return {
    id: `m${seq}`,
    seq,
    rev: seq,
    at: AT,
    from: 'assistant',
    via: 'app',
    parts: [{ type: 'text', text }],
    ...extra,
  };
}

const run = (actions: ChatAction[], from: ChatState = initialChatState) => actions.reduce(chatReducer, from);
const ids = (s: ChatState) => s.messages.map((m) => m.id);
const texts = (s: ChatState) => s.messages.map((m) => (m.parts[0]!.type === 'text' ? m.parts[0].text : '?'));

const draft = (status: Draft['status'], extra: Partial<Draft> = {}): Draft => ({
  id: 'd1',
  to: 'Pak Budi',
  channel: 'whatsapp',
  what: 'balasan',
  text: 'Halo',
  status,
  ...extra,
});
const draftMsg = (seq: number, d: Draft): Message =>
  msg(seq, '', { parts: [{ type: 'card', card: { kind: 'draft', draft: d } }] });
const draftOf = (s: ChatState, i: number) => {
  const part = s.messages[i]!.parts[0]!;
  return part.type === 'card' && part.card.kind === 'draft' ? part.card.draft : null;
};
const pendingOf = (clientId: string, extra: Partial<PendingMessage> = {}): PendingMessage => ({
  clientId,
  text: 'Halo',
  status: 'sending',
  queued: false,
  ...extra,
});

describe('riwayat', () => {
  test('halaman pertama (terbaru dulu) menjadi utas dari terlama; kursor dan id awal tercatat', () => {
    const s = run([{ type: 'loaded', items: [msg(3, 'c'), msg(2, 'b')], before: 2 }]);
    expect(texts(s)).toEqual(['b', 'c']);
    expect(s).toMatchObject({ loaded: true, olderCursor: 2, hasOlder: true, loadFailed: false });
    expect(s.initialIds).toEqual(new Set(['m3', 'm2']));
  });

  test('before null: tidak ada pesan lebih lama', () => {
    const s = run([{ type: 'loaded', items: [msg(1, 'a')], before: null }]);
    expect(s).toMatchObject({ olderCursor: null, hasOlder: false });
  });

  test('pesan lama disisipkan menurut seq dan kursor bergeser; spinner hanya selama memuat', () => {
    let s = run([{ type: 'loaded', items: [msg(5, 'e'), msg(4, 'd')], before: 4 }, { type: 'olderStart' }]);
    expect(s.loadingOlder).toBe(true);
    s = run([{ type: 'olderLoaded', items: [msg(3, 'c'), msg(2, 'b')], before: 2 }], s);
    expect(texts(s)).toEqual(['b', 'c', 'd', 'e']);
    expect(s).toMatchObject({ loadingOlder: false, olderCursor: 2, hasOlder: true });
    s = run([{ type: 'olderStart' }, { type: 'olderLoaded', items: [msg(1, 'a')], before: null }], s);
    expect(texts(s)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(s.hasOlder).toBe(false);
    expect(run([{ type: 'olderStart' }], s)).toBe(s);
  });

  test('gagal memuat lama melepas spinner dan kursor tetap; gagal memuat pertama bisa diulang', () => {
    let s = run([{ type: 'loaded', items: [msg(2, 'b')], before: 2 }, { type: 'olderStart' }, { type: 'olderFailed' }]);
    expect(s).toMatchObject({ loadingOlder: false, olderCursor: 2, hasOlder: true });
    s = run([{ type: 'loadFailed' }]);
    expect(s.loadFailed).toBe(true);
    s = run([{ type: 'loaded', items: [msg(1, 'a')], before: null }], s);
    expect(s).toMatchObject({ loadFailed: false, loaded: true });
  });

  test('halaman pertama kedua kali (resync) tidak menggeser kursor atau id awal', () => {
    let s = run([{ type: 'loaded', items: [msg(5, 'e')], before: 5 }]);
    s = run([{ type: 'olderLoaded', items: [msg(4, 'd')], before: 4 }], s);
    s = run([{ type: 'loaded', items: [msg(6, 'f'), msg(5, 'e')], before: 5 }], s);
    expect(s.olderCursor).toBe(4);
    expect(s.initialIds).toEqual(new Set(['m5']));
    expect(texts(s)).toEqual(['d', 'e', 'f']);
  });
});

describe('upsert', () => {
  test('id yang sama menggantikan di tempatnya; seq lama dipertahankan, rev lebih baru menang', () => {
    let s = run([{ type: 'merge', items: [msg(1, 'a'), msg(2, 'b'), msg(3, 'c')] }]);
    s = run([{ type: 'message', message: msg(2, 'B baru', { rev: 9 }) }], s);
    expect(texts(s)).toEqual(['a', 'B baru', 'c']);
    expect(s.messages[1]).toMatchObject({ seq: 2, rev: 9 });
  });

  test('rev yang sama atau lebih lama diabaikan (state yang sama dikembalikan)', () => {
    const s = run([{ type: 'merge', items: [msg(1, 'a', { rev: 5 })] }]);
    expect(run([{ type: 'message', message: msg(1, 'usang', { rev: 4 }) }], s)).toBe(s);
    expect(run([{ type: 'message', message: msg(1, 'sama', { rev: 5 }) }], s)).toBe(s);
  });

  test('pesan baru masuk menurut seq walau datang tidak berurutan', () => {
    const s = run([
      { type: 'merge', items: [msg(1, 'a'), msg(4, 'd')] },
      { type: 'message', message: msg(3, 'c') },
    ]);
    expect(ids(s)).toEqual(['m1', 'm3', 'm4']);
  });

  test('merge kosong tidak mengubah apa pun', () => {
    expect(run([{ type: 'merge', items: [] }])).toBe(initialChatState);
  });
});

describe('gelembung optimistis', () => {
  test('diganti pesan tersimpan dengan clientId yang sama; echo kedua tidak menggandakan', () => {
    let s = run([{ type: 'pendingAdd', pending: pendingOf('c1') }]);
    expect(s.pending).toHaveLength(1);
    const saved = msg(1, 'Halo', { from: 'user', clientId: 'c1' });
    s = run([{ type: 'message', message: saved }], s);
    expect(s.pending).toHaveLength(0);
    expect(ids(s)).toEqual(['m1']);
    const again = run([{ type: 'message', message: saved }], s);
    expect(again).toBe(s);
  });

  test('pesan orang lain tidak membuang gelembung; gagal menandai failed dan sendStarted mengulang', () => {
    let s = run([
      { type: 'pendingAdd', pending: pendingOf('c1') },
      { type: 'message', message: msg(1, 'x') },
    ]);
    expect(s.pending).toHaveLength(1);
    s = run([{ type: 'sendFailed', clientId: 'c1' }], s);
    expect(s.pending[0]).toMatchObject({ status: 'failed', queued: false });
    s = run([{ type: 'sendStarted', clientId: 'c1' }], s);
    expect(s.pending[0]).toMatchObject({ status: 'sending', queued: false });
  });

  test('antrean: queued sampai sendStarted', () => {
    let s = run([{ type: 'pendingAdd', pending: pendingOf('c1', { queued: true }) }]);
    expect(s.pending[0]!.queued).toBe(true);
    s = run([{ type: 'sendStarted', clientId: 'c1' }], s);
    expect(s.pending[0]!.queued).toBe(false);
  });

  test('pendingDrop membuang gelembung; unlock membuka kunci pilihan', () => {
    const choice = { messageId: 'm1', choiceId: 'ya' };
    let s = run([{ type: 'pendingAdd', pending: pendingOf('c1', { choice }) }]);
    expect(s.locks).toEqual({ m1: 'ya' });
    expect(run([{ type: 'pendingDrop', clientId: 'c1' }], s).locks).toEqual({ m1: 'ya' });
    s = run([{ type: 'pendingDrop', clientId: 'c1', unlock: true }], s);
    expect(s.pending).toHaveLength(0);
    expect(s.locks).toEqual({});
    expect(run([{ type: 'pendingDrop', clientId: 'tidak-ada' }], s)).toBe(s);
  });
});

describe('pilihan', () => {
  const choices: Part = {
    type: 'choices',
    choices: [
      { id: 'ya', title: 'Ya' },
      { id: 'tidak', title: 'Tidak' },
    ],
  };

  test('terkunci lewat ketukan sebelum server menyiarkan chosenId; chosenId server menang', () => {
    const m = msg(1, '', { parts: [choices] });
    let s = run([{ type: 'merge', items: [m] }]);
    expect(chosenIn(s, m)).toBeUndefined();
    s = run([{ type: 'pendingAdd', pending: pendingOf('c1', { choice: { messageId: 'm1', choiceId: 'ya' } }) }], s);
    expect(chosenIn(s, s.messages[0]!)).toBe('ya');
    s = run([{ type: 'message', message: { ...m, rev: 9, parts: [{ ...choices, chosenId: 'tidak' } as Part] } }], s);
    expect(chosenIn(s, s.messages[0]!)).toBe('tidak');
  });
});

describe('draf', () => {
  test('event draft menimpa kartu dengan draft.id yang sama, tanpa mengubah rev atau pesan lain', () => {
    const other = msg(1, 'lain');
    let s = run([{ type: 'merge', items: [other, draftMsg(2, draft('draft'))] }]);
    const held = draft('held', { heldUntil: AT });
    s = run([{ type: 'draft', draft: held }], s);
    expect(draftOf(s, 1)).toEqual(held);
    expect(s.messages[1]!.rev).toBe(2);
    expect(s.messages[0]).toBe(other);
  });

  test('draf yang tidak dikenal atau tidak berubah: state yang sama', () => {
    const s = run([{ type: 'merge', items: [draftMsg(1, draft('draft'))] }]);
    expect(run([{ type: 'draft', draft: { ...draft('held', { heldUntil: AT }), id: 'lain' } }], s)).toBe(s);
  });

  test('upsert dengan rev lebih baru membawa draf terbaru; rev lama tidak menimpa draf yang sudah diperbarui', () => {
    let s = run([{ type: 'merge', items: [draftMsg(1, draft('draft'))] }]);
    s = run([{ type: 'draft', draft: draft('cancelled') }], s);
    expect(run([{ type: 'message', message: draftMsg(1, draft('draft')) }], s)).toBe(s);
    s = run([{ type: 'message', message: { ...draftMsg(1, draft('sent')), rev: 7 } }], s);
    expect(draftOf(s, 0)!.status).toBe('sent');
  });

  test('kartu perangkat terbaru dengan deviceId yang sama diganti jawaban kendali', () => {
    const card = (on: boolean, temp: number): Part => ({
      type: 'card',
      card: { kind: 'device', deviceId: 'ac', name: 'AC kamar', on, temp },
    });
    let s = run([
      { type: 'merge', items: [msg(1, '', { parts: [card(true, 24)] }), msg(2, '', { parts: [card(true, 24)] })] },
    ]);
    s = run([{ type: 'device', card: { kind: 'device', deviceId: 'ac', name: 'AC kamar', on: false, temp: 22 } }], s);
    expect(s.messages[0]!.parts[0]).toEqual(card(true, 24));
    expect(s.messages[1]!.parts[0]).toEqual(card(false, 22));
    const none = run([{ type: 'device', card: { kind: 'device', deviceId: 'x', name: 'X', on: true } }], s);
    expect(none).toBe(s);
  });
});

describe('berpikir dan koneksi', () => {
  test('dua runId yang tumpang tindih: berpikir sampai keduanya selesai', () => {
    let s = run([
      { type: 'thinking', runId: 'a', on: true },
      { type: 'thinking', runId: 'b', on: true },
    ]);
    expect(isChatThinking(s)).toBe(true);
    s = run([{ type: 'thinking', runId: 'a', on: false }], s);
    expect(isChatThinking(s)).toBe(true);
    s = run([{ type: 'thinking', runId: 'b', on: false }], s);
    expect(isChatThinking(s)).toBe(false);
  });

  test('resync mengosongkan runId yang terlewat', () => {
    const s = run([{ type: 'thinking', runId: 'a', on: true }, { type: 'resync' }]);
    expect(isChatThinking(s)).toBe(false);
    expect(run([{ type: 'resync' }], s)).toBe(s);
  });

  test('status koneksi', () => {
    expect(initialChatState.connection).toBe('connecting');
    const s = run([{ type: 'connection', status: 'open' }]);
    expect(s.connection).toBe('open');
    expect(run([{ type: 'connection', status: 'open' }], s)).toBe(s);
  });
});
