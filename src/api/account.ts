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

/** "21 Nov 2026" untuk waktu `ms` di zona `tz`. */
function dateIn(ms: number, tz: number): string {
  const d = new Date(ms + tz * 60_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Kalimat keadaan paket: "Coba gratis, tersisa 5 hari", "Aktif sampai 21 Nov 2026", "Sudah berakhir".
 *
 * `plan.until` adalah saat akhir paket (eksklusif: paket masih berlaku sampai sedetik sebelumnya). Hari terakhir paket
 * adalah hari kalender dari `until - 1 ms` di zona waktu akun (bawaan WIB), dan sisa hari dihitung dalam hari kalender:
 * di hari terakhir "berakhir hari ini", sehari sebelumnya "tersisa 1 hari", bukan dibulatkan dari jam.
 */
export function planText(plan: AccountPlan, now: number = Date.now(), tz: number = ACCOUNT_TZ_MINUTES): string {
  if (plan.status === 'berakhir') return 'Sudah berakhir';
  const until = plan.until ? new Date(plan.until).getTime() : NaN;
  if (plan.status === 'trial') {
    if (Number.isNaN(until)) return 'Coba gratis';
    const days = calendarDay(until - 1, tz) - calendarDay(now, tz);
    if (days < 0) return 'Sudah berakhir';
    if (days === 0) return 'Coba gratis, berakhir hari ini';
    return `Coba gratis, tersisa ${days} hari`;
  }
  return Number.isNaN(until) ? 'Aktif' : `Aktif sampai ${dateIn(until - 1, tz)}`;
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

/** Kalimat contoh di bawah kolom nama. */
export const greetingPreview = (name: string) => `Halo, saya ${name.trim() || '…'}.`;

/** Nama asisten sah (2 sampai 20 huruf)? */
export const isAssistantName = (name: string): boolean => assistantNameSchema.safeParse(name).success;

/** Jam sapaan yang ditawarkan. */
export const GREETING_TIMES = ['06.00', '07.00', '08.00', '09.00'] as const;

export const NOTIFICATION_KINDS: { key: keyof AccountNotifications; title: string; note: string }[] = [
  { key: 'pesan', title: 'Pesan dari asisten', note: 'Balasan dan hal yang perlu Anda setujui.' },
  { key: 'pengingat', title: 'Pengingat', note: 'Agenda dan tugas yang Anda minta diingatkan.' },
  { key: 'ringkasanHarian', title: 'Ringkasan harian', note: 'Gambaran singkat hari Anda.' },
  { key: 'rumah', title: 'Rumah', note: 'Kabar penting dari perangkat di rumah.' },
  { key: 'usaha', title: 'Usaha', note: 'Stok menipis, pembayaran masuk, dan laporan.' },
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
