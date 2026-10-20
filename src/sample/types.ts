import type { IconName } from '@/ui/icons';

export const PLACES = ['Semua', 'Rumah', 'Kedai Dago', 'Kedai Riau'] as const;
export type Place = (typeof PLACES)[number];

export type AcMode = 'Dingin' | 'Kering' | 'Kipas' | 'Otomatis';
export type AcFan = 'Pelan' | 'Sedang' | 'Kencang' | 'Otomatis';
export interface AcState {
  on: boolean;
  temp: number;
  mode: AcMode;
  fan: AcFan;
}

export type DeviceKind = 'lampu' | 'ac' | 'kamera' | 'kunci' | 'speaker' | 'lain';
export interface Device {
  id: string;
  /** Tempat nyata (bukan 'Semua'). */
  place: Exclude<Place, 'Semua'>;
  room: string;
  name: string;
  icon: IconName;
  kind: DeviceKind;
  /** Tulisan keadaan, contoh "Nyala · 80%". */
  status: string;
  on: boolean;
  reachable: boolean;
  via?: 'ir' | 'cloud';
  /** Mematikan perangkat ini butuh PIN. */
  needsPin?: boolean;
}

/**
 * - `draft`: menunggu persetujuan Anda (Ubah, Kirim).
 * - `held`: sudah disetujui, ditahan 5 menit sebelum benar-benar keluar; masih bisa dibatalkan sampai `heldUntil`.
 * - `sent`: sudah keluar (belum dipakai di Fase 0b, tidak ada jam yang berjalan).
 * - `cancelled`: dibatalkan saat ditahan, tidak jadi terkirim.
 */
export type OutgoingStatus = 'draft' | 'held' | 'sent' | 'cancelled';
export interface Outgoing {
  id: string;
  to: string;
  channel: 'WhatsApp';
  /** Jenis kiriman, untuk kalimat seperti "Mengirim balasan ke Pak Budi" dan "Ini draf pesanannya". */
  what: 'balasan' | 'pesanan';
  text: string;
  status: OutgoingStatus;
  /** Kalimat di kartu persetujuan Beranda. Bila kosong: "Pesanan untuk PT Sumber Susu sudah siap. Kirim?". */
  ask?: string;
  /** Jam contoh saat Anda menyetujui. */
  sentAt: string;
  /** Batas waktu boleh dibatalkan (5 menit setelah `sentAt`). */
  heldUntil: string;
}
/** Draf baru dari layar lain (misalnya "Pesan lagi" di Usaha). Id dibuat penyimpanan. */
export type NewDraft = Pick<Outgoing, 'to' | 'channel' | 'what' | 'text'> & Partial<Pick<Outgoing, 'ask' | 'sentAt'>>;

export type AgendaKind = 'reminder' | 'task' | 'meeting' | 'recurring';
export interface AgendaItem {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH.MM */
  time: string;
  title: string;
  kind: AgendaKind;
  way?: 'alarm' | 'call';
  repeat?: string;
  note?: string;
  done?: boolean;
  past?: boolean;
  snoozedUntil?: string;
  /** Tampil di kartu "Agenda hari ini" di Beranda. */
  home?: boolean;
}

export interface Leftover {
  id: string;
  title: string;
}

export type Permission = 'read' | 'act';
export interface Service {
  id: string;
  name: string;
  icon: IconName;
  /** Tulisan keadaan, contoh "Aktif · terakhir dibaca 5 menit lalu". */
  status: string;
  permission: Permission;
  reachable: boolean;
  /** Kunci simpul di cincin Beranda, kalau layanan ini punya simpul. */
  ringKey?: string;
}

export type HistoryKind = 'pesan' | 'rumah' | 'usaha' | 'pembelian';
export interface HistoryEntry {
  id: string;
  day: 'Hari ini' | 'Kemarin';
  time: string;
  kind: HistoryKind;
  icon: IconName;
  title: string;
  sub: string;
  /** Kiriman yang dicatat entri ini. Batalkan dan coretan diturunkan dari status kirimannya (`historyRows`). */
  outgoingId?: string;
}

/** Isi kartu notulen di chat. */
export interface NotesInfo {
  title: string;
  when: string;
  decisions: string[];
}
export interface FileInfo {
  name: string;
  meta: string;
}
export interface TokenInfo {
  title: string;
  amount: string;
  meter: string;
  owner: string;
}
export interface QrisInfo {
  amount: string;
  until: string;
}

/** Satu baris utas chat. Kartu membawa datanya sendiri, atau id ke data di penyimpanan (kiriman, perangkat). */
export type ChatEntry =
  | { id: string; kind: 'user' | 'assistant'; text: string }
  | { id: string; kind: 'device'; deviceId: string }
  | { id: string; kind: 'confirm'; outgoingId: string }
  | ({ id: string; kind: 'notes' } & NotesInfo)
  | ({ id: string; kind: 'file' } & FileInfo)
  | ({ id: string; kind: 'token' } & TokenInfo)
  | ({ id: string; kind: 'qris' } & QrisInfo)
  | { id: string; kind: 'thinking' };
/** Baris utas tanpa id; id dibuat penyimpanan. */
export type NewChatEntry = ChatEntry extends infer E ? (E extends ChatEntry ? Omit<E, 'id'> : never) : never;

export interface Business {
  source: string;
  sales: string;
  change: string;
  alert: string;
}
