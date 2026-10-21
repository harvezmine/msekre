import { Linking } from 'react-native';
import type { AccountNotifications, AccountPlan, AssistantStyle } from './contract';
import { assistantNameSchema } from './contract';
import { formatTanggal } from './format';
import { readWaNumber, waUrl } from './waNumber';

const DAY_MS = 86_400_000;

/** Kalimat keadaan paket: "Coba gratis, tersisa 5 hari", "Aktif sampai 21 Nov 2026", "Sudah berakhir". */
export function planText(plan: AccountPlan, now: number = Date.now()): string {
  if (plan.status === 'berakhir') return 'Sudah berakhir';
  const until = plan.until ? new Date(plan.until).getTime() : NaN;
  if (plan.status === 'trial') {
    if (Number.isNaN(until)) return 'Coba gratis';
    const days = Math.ceil((until - now) / DAY_MS);
    if (days <= 0) return 'Coba gratis, berakhir hari ini';
    return `Coba gratis, tersisa ${days} hari`;
  }
  const date = plan.until ? formatTanggal(plan.until) : null;
  return date ? `Aktif sampai ${date}` : 'Aktif';
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
export const ERASE_TEXT = 'Halo, saya mau menghapus akun Sekretaris AI saya.';
