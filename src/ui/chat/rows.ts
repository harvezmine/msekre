import { chosenIn, type ChatState, type PendingMessage } from '@/api/chatState';
import type { Message, Part } from '@/api/contract';

/** Satu baris di daftar chat: satu bagian pesan, satu gelembung optimistis, atau tanda berpikir. */
export type Row =
  | {
      key: string;
      kind: 'part';
      message: Message;
      part: Part;
      /** Pilihan yang sudah diambil (hanya untuk bagian `choices`). */
      chosenId?: string;
      /** Bagian terakhir dari pesan WhatsApp: tanda "lewat WhatsApp" di bawahnya. */
      tag: boolean;
      startsExchange: boolean;
    }
  | { key: string; kind: 'pending'; pending: PendingMessage; startsExchange: boolean }
  | { key: 'berpikir'; kind: 'thinking' };

type Weight = 'user' | 'ask' | 'other';

/** Pertanyaan dan jawabannya satu tukar-pesan: balasan atas tombol pilihan atau kartu pembayaran tidak diberi jarak ekstra. */
function weight(row: Row | undefined): Weight {
  if (!row || row.kind === 'thinking') return 'other';
  if (row.kind === 'pending') return 'user';
  const { part, message } = row;
  if (part.type === 'choices') return 'ask';
  if (part.type === 'card' && part.card.kind === 'payment') return 'ask';
  return part.type === 'text' && message.from === 'user' ? 'user' : 'other';
}

/**
 * Baris utas dari yang terlama ke terbaru: pesan (satu baris per bagian), lalu gelembung yang belum tersimpan, lalu
 * tanda berpikir. `onlyNew` (`?kosong=1`) membuang pesan yang sudah ada saat layar dibuka.
 */
export function buildRows(state: ChatState, { onlyNew = false }: { onlyNew?: boolean } = {}): Row[] {
  const rows: Row[] = [];
  for (const message of state.messages) {
    if (onlyNew && state.initialIds?.has(message.id)) continue;
    message.parts.forEach((part, i) => {
      rows.push({
        key: `${message.id}:${i}`,
        kind: 'part',
        message,
        part,
        chosenId: part.type === 'choices' ? (part.chosenId ?? chosenIn(state, message)) : undefined,
        tag: message.via === 'whatsapp' && i === message.parts.length - 1,
        startsExchange: false,
      });
    });
  }
  for (const pending of state.pending) {
    rows.push({ key: `p:${pending.clientId}`, kind: 'pending', pending, startsExchange: false });
  }
  if (state.runs.size > 0) rows.push({ key: 'berpikir', kind: 'thinking' });
  return rows.map((row, i) => {
    if (row.kind === 'thinking') return row;
    const prev = weight(rows[i - 1]);
    const starts = i > 0 && weight(row) === 'user' && prev !== 'user' && prev !== 'ask';
    return { ...row, startsExchange: starts };
  });
}
