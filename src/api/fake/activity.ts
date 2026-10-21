import type { SampleState } from '@/sample/reducer';
import type { HistoryEntry as SampleEntry, Outgoing } from '@/sample/types';
import type { Draft, HistoryEntry, HistoryKind, HistoryQuery } from '../contract';
import { HISTORY_LIMIT } from '../contract';
import { wibIso } from './clock';

/** Hari contoh: "Hari ini" = Senin 20 Okt, "Kemarin" = Minggu 19 Okt (kalender 2025 server tiruan). */
const DAY_OF: Record<SampleEntry['day'], number> = { 'Hari ini': 20, Kemarin: 19 };

const CLOCK = /\b\d{2}\.\d{2}\b/g;

/** Keterangan contoh tanpa jam ("disetujui Anda 10.42" -> "disetujui Anda"): aplikasi menambah jam dari `at`. */
export function detailOf(sub: string): string | undefined {
  const parts = sub
    .split(' · ')
    .map((p) => p.replace(CLOCK, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

function kindOf(h: SampleEntry): HistoryKind {
  if (h.outgoingId) return 'kirim';
  if (h.kind === 'pembelian') return 'bayar';
  if (h.kind === 'rumah') return 'rumah';
  if (h.kind === 'usaha') return 'usaha';
  if (h.icon === 'link') return 'sambung';
  if (h.icon === 'bell' || h.icon === 'task') return 'agenda';
  return 'lainnya';
}

/** Keadaan kiriman menurut draf di chat (yang terbaru), atau menurut kiriman di penyimpanan contoh. */
function statusOf(o: Outgoing, draft: Draft | undefined): HistoryEntry['status'] {
  const s = draft?.status ?? o.status;
  if (s === 'held') return 'menunggu';
  if (s === 'sent') return 'terkirim';
  if (s === 'cancelled') return 'dibatalkan';
  if (s === 'failed') return 'gagal';
  return undefined;
}

/**
 * Riwayat server tiruan dari penyimpanan contoh, terbaru dulu. Kiriman memakai keadaan drafnya (`drafts`): yang ditahan
 * bisa dibatalkan sampai `heldUntil`; yang sudah keluar "terkirim". Ketuk: kiriman membuka chat, perangkat membuka
 * detailnya.
 */
export function historyFrom(state: SampleState, drafts: ReadonlyMap<string, Draft>): HistoryEntry[] {
  return state.history.map((h) => {
    const o = h.outgoingId ? state.outgoing[h.outgoingId] : undefined;
    const draft = o ? drafts.get(o.id) : undefined;
    const status = o ? statusOf(o, draft) : undefined;
    const until = status === 'menunggu' ? (draft?.heldUntil ?? wibIso(10, 20, o!.heldUntil)) : undefined;
    const detail = detailOf(h.sub);
    return {
      id: h.id,
      at: wibIso(10, DAY_OF[h.day], h.time),
      kind: kindOf(h),
      icon: h.icon,
      title: h.title,
      ...(detail ? { detail } : {}),
      ...(o ? { channel: 'whatsapp' as const } : {}),
      ...(status ? { status } : {}),
      ...(o && until ? { undoable: { draftId: o.id, until } } : {}),
      ...(o
        ? { link: { route: '/chat' } }
        : h.deviceId
          ? { link: { route: '/perangkat/[id]', params: { id: h.deviceId } } }
          : {}),
    };
  });
}

/** Satu halaman `GET /history`: `before` = id entri terakhir halaman ini (penanda buram); tidak dikenal = halaman pertama. */
export function pageOf(
  all: readonly HistoryEntry[],
  query: Partial<Pick<HistoryQuery, 'kind' | 'before' | 'limit'>>,
): { items: HistoryEntry[]; before: string | null } {
  const list = query.kind ? all.filter((e) => e.kind === query.kind) : [...all];
  const at = query.before === undefined ? -1 : list.findIndex((e) => e.id === query.before);
  const start = at < 0 ? 0 : at + 1;
  const limit = query.limit ?? HISTORY_LIMIT;
  const items = list.slice(start, start + limit);
  return { items, before: start + limit < list.length ? items[items.length - 1]!.id : null };
}
