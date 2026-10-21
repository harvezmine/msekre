import type { AgendaItem, Device, Draft, Home } from '@/api/contract';
import { addDays, parts } from '@/api/dates';
import { canSwitch, deviceStateOf } from '@/api/devices';
import { greetingFor } from '@/api/format';
import { iconOr, type IconName } from '../icons';

/**
 * Isi Beranda yang tumbuh pelan-pelan (§6.1 spesifikasi): paling banyak tiga blok, urutannya tetap, masing-masing hanya
 * bila ada isinya. Tanpa blok sama sekali (pengguna baru): satu kartu "Coba bilang". Usaha tidak pernah di Beranda.
 */

/** Contoh kalimat kartu "Coba bilang", berganti tiap hari: pengingat, pesan, AC, tagihan. */
export const SUGGESTIONS = [
  'Ingatkan saya rapat besok jam 9',
  'Kirim pesan ke Ibu, saya pulang telat',
  'Nyalakan AC kamar jam 9 malam',
  'Beli token listrik 100 ribu',
] as const;

export function suggestionFor(date: string): string {
  const { y, m, d } = parts(date);
  // Digeser 3 supaya hari contoh (Senin, 20 Okt 2025) memakai contoh pertama, sama dengan papan desain.
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000) + 3;
  return SUGGESTIONS[((day % SUGGESTIONS.length) + SUGGESTIONS.length) % SUGGESTIONS.length]!;
}

/** "Pagi, Rina" menurut jam (batas yang sama dengan sapaan server); pengguna baru "Halo, Rina"; tanpa nama "Selamat pagi". */
export function greetingText(hour: number, name: string | null, fresh: boolean): string {
  if (fresh) return name ? `Halo, ${name}` : 'Halo';
  if (!name) return greetingFor(hour);
  return `${greetingFor(hour)
    .replace(/^Selamat /, '')
    .replace(/^./, (c) => c.toUpperCase())}, ${name}`;
}

const HONORIFIC = /^(pak|bu|ibu|bapak|mas|mbak|mba|kak|bang|dik|adik|om|tante|pt|cv|ud|tb|toko)\.?$/i;

/** Huruf avatar penerima: "Pak Budi" → "B", "PT Sumber Susu" → "S". */
export function contactInitial(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const main = words.find((w) => !HONORIFIC.test(w)) ?? words[0] ?? '?';
  return main.charAt(0).toUpperCase();
}

/** Draf yang paling lama menunggu persetujuan (`Home.approvals` sudah urut yang tertua dulu). */
export function oldestApproval(home: Home): Draft | null {
  return home.approvals.find((d) => d.status === 'draft') ?? null;
}

const minutesOf = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split('.').map(Number);
  return h * 60 + m;
};

/** Butir agenda berikutnya untuk Beranda. `day` 1 = besok. */
export interface NextAgenda {
  id: string;
  time: string;
  title: string;
  day: 0 | 1;
}

/** Mulai dalam 12 jam ke depan; butir yang sudah mulai tetap tampil 15 menit. */
export const NEXT_WINDOW_MIN = 12 * 60;
export const NEXT_GRACE_MIN = 15;

/**
 * Agenda berikutnya: yang paling dekat dari butir agenda (hari ini dan besok) dan `Home.agendaToday`, tanpa tugas, yang
 * sudah selesai, atau yang sepanjang hari. `null` kalau tidak ada dalam 12 jam.
 */
export function nextAgenda(
  { items, today, homeToday }: { items: AgendaItem[]; today: string | null; homeToday: Home['agendaToday'] },
  now: string,
): NextAgenda | null {
  const nowMin = minutesOf(now);
  const tomorrow = today ? addDays(today, 1) : null;
  const seen = new Set<string>();
  const candidates: NextAgenda[] = [];
  for (const it of items) {
    // Butir yang dikenal agenda menang atas salinan di Beranda (yang selesai tidak muncul lagi).
    seen.add(it.id);
    if (it.kind === 'task' || it.done || it.allDay) continue;
    if (it.date !== today && it.date !== tomorrow) continue;
    const day = it.date === today ? 0 : 1;
    candidates.push({ id: it.id, time: it.time, title: it.title, day });
  }
  for (const it of homeToday) {
    if (seen.has(it.id) || it.kind === 'task') continue;
    candidates.push({ id: it.id, time: it.time, title: it.title, day: 0 });
  }
  let best: { item: NextAgenda; away: number } | null = null;
  for (const item of candidates) {
    const away = item.day * 24 * 60 + minutesOf(item.time) - nowMin;
    if (away < -NEXT_GRACE_MIN || away > NEXT_WINDOW_MIN) continue;
    if (!best || away < best.away) best = { item, away };
  }
  return best?.item ?? null;
}

/** Perangkat yang bisa jadi sakelar besar di Beranda: punya daya atau kunci, bukan Kotak atau sensor. */
function toggleable(d: Device): boolean {
  return d.kind !== 'box' && d.kind !== 'sensor' && canSwitch(d);
}

const usedAt = (d: Device) => (d.lastUsedAt ? Date.parse(d.lastUsedAt) || 0 : 0);

/**
 * Sakelar Beranda, paling banyak tiga: yang disematkan pengguna (`favorite`); belum ada: yang terakhir diatur. Pilihan
 * otomatis tidak memuat kunci, kamera, atau perangkat yang dijaga, supaya ketukan tak sengaja tidak menyentuhnya.
 */
export function pickFavorites(devices: Device[], max = 3): Device[] {
  const candidates = devices.filter(toggleable);
  const pinned = candidates.filter((d) => d.favorite);
  if (pinned.length > 0) return pinned.slice(0, max);
  return candidates
    .filter((d) => !d.sensitive && d.kind !== 'lock' && d.kind !== 'camera')
    .map((d, i) => ({ d, i }))
    .sort((a, b) => usedAt(b.d) - usedAt(a.d) || a.i - b.i)
    .slice(0, max)
    .map(({ d }) => d);
}

const KIND_ICON: Partial<Record<Device['kind'], IconName>> = {
  ac: 'snow',
  tv: 'tv',
  lamp: 'bulb',
  speaker: 'speaker',
  fan: 'fan',
  plug: 'bolt',
  lock: 'lock',
  camera: 'camera',
};

export function deviceIcon(d: Device): IconName {
  return KIND_ICON[d.kind] ?? iconOr(d.icon, 'bulb');
}

/** Satu kata keadaan di sakelar besar: "24°", "Nyala", "Mati", "Terkunci", "Terbuka", "Terputus". */
export function stateWord(d: Device): string {
  if (!d.reachable) return 'Terputus';
  const s = deviceStateOf(d);
  if (d.kind === 'lock') return d.on ? 'Terkunci' : 'Terbuka';
  if (d.kind === 'camera') return d.on ? 'Merekam' : 'Mati';
  if (!d.on) return 'Mati';
  if (d.kind === 'ac' && s.temp !== undefined) return `${s.temp}°`;
  return 'Nyala';
}
