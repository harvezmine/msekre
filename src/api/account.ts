import { Linking } from 'react-native';
import type { AccountNotifications, AccountPlan, AssistantStyle } from './contract';
import { assistantNameSchema } from './contract';
import { readWaNumber, waUrl } from './waNumber';

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
/** Zona waktu akun bila server tidak menyebut yang lain: WIB, 420 menit dari UTC. */
export const ACCOUNT_TZ_MINUTES = 420;

/** Nomor hari kalender (sejak 1970) dari waktu `ms` di zona `tz` (menit dari UTC). */
const calendarDay = (ms: number, tz: number) => Math.floor((ms + tz * 60_000) / DAY_MS);

/** "21 Nov 2026" untuk waktu `ms` di zona `tz`; tanpa tahun bila `year` false. */
function dateIn(ms: number, tz: number, year = true): string {
  const d = new Date(ms + tz * 60_000);
  const day = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return year ? `${day} ${d.getUTCFullYear()}` : day;
}

/** Lama masa coba gratis (hari), untuk batang hari di kartu profil. */
export const TRIAL_DAYS = 7;

/**
 * Keadaan paket dalam hari kalender di zona `tz`:
 * - `trial` dengan `days` = sisa hari (0 = hari terakhir), atau tanpa `days` bila akhirnya tidak diketahui;
 * - `aktif` dengan `last` = saat hari terakhir (ms), bila diketahui;
 * - `berakhir`, termasuk masa coba yang sudah lewat hari terakhirnya.
 *
 * `plan.until` adalah saat akhir paket (eksklusif: paket masih berlaku sampai sedetik sebelumnya). Hari terakhir paket
 * adalah hari kalender dari `until - 1 ms` di zona waktu akun (bawaan WIB); sisa hari dihitung dalam hari kalender, bukan
 * dibulatkan dari jam.
 */
export type PlanState = { kind: 'trial'; days?: number } | { kind: 'aktif'; last?: number } | { kind: 'berakhir' };

export function planState(plan: AccountPlan, now: number = Date.now(), tz: number = ACCOUNT_TZ_MINUTES): PlanState {
  if (plan.status === 'berakhir') return { kind: 'berakhir' };
  const until = plan.until ? new Date(plan.until).getTime() : NaN;
  if (plan.status === 'trial') {
    if (Number.isNaN(until)) return { kind: 'trial' };
    const days = calendarDay(until - 1, tz) - calendarDay(now, tz);
    return days < 0 ? { kind: 'berakhir' } : { kind: 'trial', days };
  }
  return Number.isNaN(until) ? { kind: 'aktif' } : { kind: 'aktif', last: until - 1 };
}

/**
 * Kalimat keadaan paket: "Coba gratis, tersisa 5 hari", "Coba gratis, berakhir hari ini", "Aktif sampai 21 Nov 2026",
 * "Sudah berakhir". Hari terakhir dan sisa hari mengikuti {@link planState}.
 */
export function planText(plan: AccountPlan, now: number = Date.now(), tz: number = ACCOUNT_TZ_MINUTES): string {
  const s = planState(plan, now, tz);
  if (s.kind === 'berakhir') return 'Sudah berakhir';
  if (s.kind === 'trial') {
    if (s.days === undefined) return 'Coba gratis';
    return s.days === 0 ? 'Coba gratis, berakhir hari ini' : `Coba gratis, tersisa ${s.days} hari`;
  }
  return s.last === undefined ? 'Aktif' : `Aktif sampai ${dateIn(s.last, tz)}`;
}

/**
 * Satu baris pendek untuk kartu profil Akun: "Coba gratis · 5 hari", "Coba gratis · hari terakhir", "Aktif sampai
 * 21 Nov" (tahun hanya bila bukan tahun ini), "Sudah berakhir".
 */
export function planLine(plan: AccountPlan, now: number = Date.now(), tz: number = ACCOUNT_TZ_MINUTES): string {
  const s = planState(plan, now, tz);
  if (s.kind === 'berakhir') return 'Sudah berakhir';
  if (s.kind === 'trial') {
    if (s.days === undefined) return 'Coba gratis';
    return s.days === 0 ? 'Coba gratis · hari terakhir' : `Coba gratis · ${s.days} hari`;
  }
  if (s.last === undefined) return 'Aktif';
  const thisYear = new Date(now + tz * 60_000).getUTCFullYear();
  const lastYear = new Date(s.last + tz * 60_000).getUTCFullYear();
  return `Aktif sampai ${dateIn(s.last, tz, lastYear !== thisYear)}`;
}

/**
 * Batang hari masa coba: berapa dari {@link TRIAL_DAYS} ruas yang masih hijau, atau `null` bila bukan masa coba (atau
 * akhirnya tidak diketahui). Hari terakhir tetap satu ruas.
 */
export function trialBar(plan: AccountPlan, now: number = Date.now(), tz: number = ACCOUNT_TZ_MINUTES): number | null {
  const s = planState(plan, now, tz);
  if (s.kind !== 'trial' || s.days === undefined) return null;
  return Math.min(TRIAL_DAYS, Math.max(1, s.days));
}

/** Gaya asisten dengan satu kalimat contoh. `{nama}` diganti nama asisten. */
export const STYLES: { value: AssistantStyle; title: string; example: string }[] = [
  { value: 'singkat', title: 'Singkat', example: 'Rapat jam 9. Sudah saya ingatkan.' },
  {
    value: 'ramah',
    title: 'Ramah',
    example: 'Siap, Kak! Besok jam 9 ada rapat, nanti saya ingatkan ya.',
  },
  {
    value: 'formal',
    title: 'Formal',
    example: 'Baik. Rapat dijadwalkan besok pukul 09.00, dan akan saya ingatkan.',
  },
];

/** Kalimat contoh sapaan dengan nama asisten. */
export const greetingPreview = (name: string) => `Halo, saya ${name.trim() || '…'}.`;

/** Nama asisten sah (2 sampai 20 huruf)? */
export const isAssistantName = (name: string): boolean => assistantNameSchema.safeParse(name).success;

/** Jam sapaan yang ditawarkan. */
export const GREETING_TIMES = ['06.00', '07.00', '08.00', '09.00'] as const;

/**
 * Jenis kabar yang dikirim ke HP, dengan judul satu-dua kata. `only`: hanya ditawarkan bila pengguna punya perangkat
 * (`perangkat`) atau data usaha (`usaha`), seperti tab yang tumbuh mengikuti pemakaian.
 */
export const NOTIFICATION_KINDS: {
  key: keyof AccountNotifications;
  title: string;
  only?: 'perangkat' | 'usaha';
}[] = [
  { key: 'pesan', title: 'Pesan' },
  { key: 'pengingat', title: 'Pengingat' },
  { key: 'ringkasanHarian', title: 'Ringkasan harian' },
  { key: 'rumah', title: 'Rumah', only: 'perangkat' },
  { key: 'usaha', title: 'Usaha', only: 'usaha' },
];

/** Halaman kebijakan privasi di situs. */
export const PRIVACY_URL = 'https://secretary.my.id/privasi.html';

/**
 * Buka WhatsApp Sekretaris AI dengan `text` terisi (pembayaran dan hapus akun tetap lewat WhatsApp). Mengembalikan
 * `false` bila nomornya belum diatur atau WhatsApp tidak bisa dibuka.
 */
export async function openWhatsApp(text: string): Promise<boolean> {
  const number = readWaNumber();
  if (!number) return false;
  try {
    await Linking.openURL(waUrl(number, text));
    return true;
  } catch {
    return false;
  }
}

export const WA_UNAVAILABLE_TEXT =
  'WhatsApp belum bisa dibuka dari sini. Kirim pesan langsung ke nomor Sekretaris AI ya.';
export const RENEW_TEXT = 'Halo, saya mau perpanjang langganan Sekretaris AI.';
/** Pesan awal "Bantuan" di Akun: melapor kendala lewat WhatsApp. */
export const HELP_TEXT = 'Halo, saya mau lapor kendala.';
export const ERASE_TEXT = 'Halo, saya mau menghapus akun Sekretaris AI saya.';
