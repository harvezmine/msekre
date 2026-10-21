import type { Href } from 'expo-router';
import type { HistoryEntry, HistoryKind, HistoryLink, HistoryStatus } from './contract';
import { formatTanggal } from './format';

/** Saringan Riwayat, dalam urutan tampil. `kind` kosong = semua jenis (termasuk `bayar`, `sambung`, `lainnya`). */
export const HISTORY_FILTERS: { label: string; kind?: HistoryKind }[] = [
  { label: 'Semua' },
  { label: 'Kiriman', kind: 'kirim' },
  { label: 'Rumah', kind: 'rumah' },
  { label: 'Agenda', kind: 'agenda' },
  { label: 'Usaha', kind: 'usaha' },
];

const DAY_MS = 86_400_000;

/** Awal hari (zona HP) dari waktu `ms`, dalam ms. */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Hari ini", "Kemarin", atau tanggal ("12 Jan 2027"), menurut zona HP dan `now` (jam server). */
export function dayLabel(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const days = Math.round((startOfDay(now) - startOfDay(t)) / DAY_MS);
  if (days <= 0) return 'Hari ini';
  if (days === 1) return 'Kemarin';
  return formatTanggal(iso) ?? '';
}

/** Entri per hari, urutan tetap (terbaru dulu). */
export function groupByDay(entries: readonly HistoryEntry[], now: number): { day: string; items: HistoryEntry[] }[] {
  const groups: { day: string; items: HistoryEntry[] }[] = [];
  for (const entry of entries) {
    const day = dayLabel(entry.at, now);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(entry);
    else groups.push({ day, items: [entry] });
  }
  return groups;
}

/** Detik tersisa sampai `until` (ISO), tidak negatif. Waktu yang tidak terbaca: 0. */
export function remainingSec(until: string, now: number): number {
  const t = new Date(until).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Math.ceil((t - now) / 1000));
}

/** "4:32" dari detik. */
export function countdownText(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Tulisan keadaan kiriman di bawah entri; `menunggu` ditulis lain bila masih bisa dibatalkan (ada hitung mundur). */
export const STATUS_TEXT: Record<HistoryStatus, string> = {
  menunggu: 'Sedang dikirim',
  terkirim: 'Terkirim',
  dibatalkan: 'Dibatalkan',
  gagal: 'Tidak terkirim',
};

/** Layar yang boleh dibuka dari satu entri, dengan bagian dinamisnya (`[id]`) diisi `params`. */
const LINK_ROUTES: readonly string[] = [
  '/chat',
  '/agenda',
  '/usaha',
  '/perangkat',
  '/perangkat/[id]',
  '/terhubung',
  '/terhubung/[id]',
];

/**
 * Tujuan ketukan entri, atau `null` bila layarnya tidak dikenal (entri tidak bisa diketuk). Hanya jalur dari daftar di
 * atas yang dibuka, dan nilai `params` hanya huruf, angka, `-`, `_`, `.`.
 */
export function linkHref(link: HistoryLink | undefined): Href | null {
  if (!link || !LINK_ROUTES.includes(link.route)) return null;
  const params = link.params ?? {};
  if (!Object.values(params).every((v) => /^[A-Za-z0-9._-]{1,64}$/.test(v))) return null;
  if (link.route.includes('[id]')) {
    const id = params.id;
    if (!id) return null;
    return { pathname: link.route, params: { id } } as Href;
  }
  return link.route as Href;
}
