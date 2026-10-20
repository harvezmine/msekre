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

export type OutgoingStatus = 'draft' | 'held' | 'cancelled';
export interface Outgoing {
  to: string;
  channel: 'WhatsApp';
  text: string;
  status: OutgoingStatus;
  /** Batas waktu boleh dibatalkan. */
  heldUntil: string;
  sentAt: string;
}

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
  undoable?: boolean;
  struck?: boolean;
}

export interface Business {
  source: string;
  sales: string;
  change: string;
  alert: string;
}
