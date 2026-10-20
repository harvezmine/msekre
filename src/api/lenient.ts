import { z } from 'zod';
import {
  isoDateTimeSchema,
  messageSchema,
  messagesPageSchema,
  messagesChangedPageSchema,
  partSchema,
  streamEventSchema,
  UNKNOWN_PART_NOTE,
  type Message,
  type MessagesPage,
  type MessagesChangedPage,
  type Part,
  type StreamEvent,
} from './contract';

/**
 * Pembacaan longgar untuk pesan dari server. Kontrak bisa lebih baru dari aplikasi (jenis bagian, jenis kartu, atau
 * nilai enum baru): satu pesan seperti itu tidak boleh menggagalkan seluruh halaman atau menghilang dari utas. Bagian
 * yang tidak lolos skema menjadi `{ type: 'unknown', note }`; hanya pesan yang amplopnya rusak (tanpa `id` atau `seq`)
 * dibuang. `rev` yang hilang atau rusak diganti `seq` (server lama), supaya pesan tetap tampil.
 */

const envelopeSchema = z.object({ id: z.string().min(1), seq: z.number().int().positive() });

const positiveInt = z.number().int().positive();

function revOf(raw: unknown, fallback: number): number {
  const rev = positiveInt.safeParse(raw);
  return rev.success ? rev.data : fallback;
}

export function unknownPart(): Part {
  return { type: 'unknown', note: UNKNOWN_PART_NOTE };
}

/** Pesan sah apa adanya, atau versi yang bagian-bagiannya diganti `unknown`; `null` kalau amplopnya rusak. */
export function parseMessageLenient(raw: unknown): Message | null {
  const strict = messageSchema.safeParse(raw);
  if (strict.success) return strict.data;
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) return null;
  const r = raw as Record<string, unknown>;
  const at = isoDateTimeSchema.safeParse(r.at);
  const from = r.from === 'user' || r.from === 'assistant' ? r.from : null;
  const via = r.via === 'app' || r.via === 'whatsapp' ? r.via : null;
  // Pengirim, kanal, atau waktu yang tidak dikenal: seluruh isi pesan tidak bisa dipercaya.
  const trusted = at.success && from !== null && via !== null;
  const parts =
    trusted && Array.isArray(r.parts) && r.parts.length > 0
      ? r.parts.map((p): Part => {
          const part = partSchema.safeParse(p);
          return part.success ? part.data : unknownPart();
        })
      : [unknownPart()];
  const coerced = messageSchema.safeParse({
    id: envelope.data.id,
    seq: envelope.data.seq,
    rev: revOf(r.rev, envelope.data.seq),
    ...(typeof r.clientId === 'string' ? { clientId: r.clientId } : {}),
    at: at.success ? at.data : new Date(0).toISOString(),
    from: from ?? 'assistant',
    via: via ?? 'app',
    parts,
  });
  return coerced.success ? coerced.data : null;
}

function parseItems(raw: unknown): Message[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((item) => {
    const message = parseMessageLenient(item);
    return message ? [message] : [];
  });
}

/** Halaman riwayat, pesan demi pesan. `null` kalau bentuk halamannya sendiri salah. */
export function parsePageLenient(raw: unknown): MessagesPage | null {
  const items = parseItems((raw as { items?: unknown } | null)?.items);
  const rest = messagesPageSchema.omit({ items: true }).safeParse(raw);
  return items && rest.success ? { items, before: rest.data.before } : null;
}

/** Halaman resync (`?after=`), pesan demi pesan. */
export function parseChangedPageLenient(raw: unknown): MessagesChangedPage | null {
  const items = parseItems((raw as { items?: unknown } | null)?.items);
  const rest = messagesChangedPageSchema.omit({ items: true }).safeParse(raw);
  return items && rest.success ? { items, more: rest.data.more } : null;
}

/**
 * Event stream. Pesan memakai pembacaan longgar; event lain harus sah. `null` untuk event yang rusak atau jenisnya
 * belum dikenal (dilewati).
 */
export function parseEventLenient(raw: unknown): StreamEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  if ((raw as { type?: unknown }).type === 'message') {
    const message = parseMessageLenient((raw as { message?: unknown }).message);
    return message ? { type: 'message', message } : null;
  }
  const parsed = streamEventSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
