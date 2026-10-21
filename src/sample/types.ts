import type { IconName } from '@/ui/icons';
import type { OrbitNode } from '@/ui/orbit/types';

export const PLACES = ['Semua', 'Rumah', 'Kedai Dago', 'Kedai Riau'] as const;
export type Place = (typeof PLACES)[number];

export type AcMode = 'Dingin' | 'Kering' | 'Kipas' | 'Otomatis';
export type AcFan = 'Pelan' | 'Sedang' | 'Kencang' | 'Otomatis';
/** Perintah terakhir untuk AC. Tetap tersimpan saat AC dimatikan, jadi menyala lagi di suhu yang sama. */
export interface AcSettings {
  temp: number;
  mode: AcMode;
  fan: AcFan;
}

export type DeviceKind =
  'lampu' | 'ac' | 'tv' | 'speaker' | 'kipas' | 'colokan' | 'tirai' | 'kunci' | 'kamera' | 'sensor' | 'lain';

/**
 * Keadaan tambahan perangkat contoh di luar bidang datar (`on`, `level`, `ac`, `roomTemp`): kontrol remote. Server
 * tiruan menyusun `Device.state` dari bidang datar ditambah ini.
 */
export interface DeviceExtra {
  swing?: boolean;
  timerMinutes?: number;
  colorTemp?: number;
  color?: string;
  volume?: number;
  muted?: boolean;
  playing?: boolean;
  /** Indeks lagu di daftar putar contoh. */
  trackIndex?: number;
  source?: string;
  channel?: number;
  /** Angka yang sedang diketik di remote TV (pindah channel). */
  channelBuf?: string;
  /** Kecepatan kipas angin (id pilihan). */
  fan?: string;
  position?: number;
  snapshotAt?: string;
  powerW?: number;
  energyTodayKWh?: number;
  battery?: number;
  readings?: Record<string, number>;
  humidity?: number;
}
/**
 * Perangkat dengan keadaan terstruktur. Tulisan keadaan ("Nyala · 80%", "Terkunci", "Tidak terjangkau sejak 10.12")
 * dibuat `deviceStatus` saat digambar, bukan disimpan.
 */
export interface Device {
  id: string;
  /** Tempat nyata (bukan 'Semua'). */
  place: Exclude<Place, 'Semua'>;
  room: string;
  name: string;
  /** Nama pendek di kartu Rumah Beranda, misalnya "Kamera" untuk Kamera ruang tamu. */
  short?: string;
  icon: IconName;
  kind: DeviceKind;
  /** Sakelar ubin. Lampu, AC, speaker: nyala. Kunci: terkunci. Kamera: merekam. */
  on: boolean;
  reachable: boolean;
  /** Jam contoh saat perangkat berhenti terjangkau. */
  unreachableSince?: string;
  /** Terang lampu dalam persen. Tetap tersimpan saat lampu dimatikan. */
  level?: number;
  /** Simpul cincin Beranda dari perangkat ini, kalau ada (AC kamar). */
  ring?: RingNode;
  /** Hanya untuk `kind: 'ac'`. */
  ac?: AcSettings;
  /** Suhu ruangan yang terbaca (contoh), untuk "suhu ruangan sekarang 27°". */
  roomTemp?: number;
  /** Merek, untuk keterangan seperti "LG · lewat Kotak Sekretaris AI". */
  brand?: string;
  /** `ir`: dikendalikan lewat inframerah dari Kotak, jadi yang diketahui hanya perintah terakhir. */
  via?: 'ir' | 'cloud';
  /** Mematikan perangkat ini butuh PIN. */
  needsPin?: boolean;
  /** Keadaan remote (volume, sumber, posisi tirai, ...). */
  extra?: DeviceExtra;
  /** Disematkan ke Beranda. */
  favorite?: boolean;
  /** Terakhir diatur pengguna (ISO 8601), dari server tiruan. */
  lastUsed?: string;
}

/**
 * - `draft`: menunggu persetujuan Anda (Ubah, Kirim).
 * - `held`: sudah disetujui, ditahan 5 menit sebelum benar-benar keluar; masih bisa dibatalkan sampai `heldUntil`.
 * - `sent`: sudah keluar; masa tahan habis. Di mode contoh, jam server tiruan yang menentukannya (`markSent`).
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
  /** Deret item berulang; id kejadiannya `<seriesId>:<tanggal>`. */
  seriesId?: string;
  note?: string;
  done?: boolean;
  past?: boolean;
  snoozedUntil?: string;
}

export interface Leftover {
  id: string;
  title: string;
}

export type Permission = 'read' | 'act';
/** Simpul cincin Beranda tanpa keterjangkauan; `offline` diturunkan dari layanan atau perangkat sumbernya. */
export type RingNode = Omit<OrbitNode, 'offline'>;

export interface Service {
  id: string;
  name: string;
  icon: IconName;
  permission: Permission;
  reachable: boolean;
  /** Jam contoh saat layanan berhenti terjangkau, untuk "Tidak terjangkau sejak 10.12". */
  unreachableSince?: string;
  /** Keterangan saat aktif, contoh "terakhir dibaca 5 menit lalu". Tulisan lengkapnya dibuat `serviceStatus`. */
  note?: string;
  /** Simpul cincin Beranda dari layanan ini, kalau ada. */
  ring?: RingNode;
}

/**
 * Jenis entri Riwayat, sama dengan filter 2m. `lainnya`: kejadian di luar empat filter itu (menyambung atau memutus
 * layanan, mengubah izin, menghapus data, menambah agenda); hanya tampil di Semua.
 */
export type HistoryKind = 'pesan' | 'rumah' | 'usaha' | 'pembelian' | 'lainnya';
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
  /** Perangkat yang dicatat entri ini, supaya mengatur AC berkali-kali jadi satu entri. */
  deviceId?: string;
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
