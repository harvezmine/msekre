import type { Category } from '@/theme/tokens';

const TONES: readonly Category[] = ['terhubung', 'agenda', 'usaha', 'rumah'];

/** Warna inisial kontak dari nama (hash sederhana di antara penanda), supaya orang yang sama selalu sewarna. */
export function toneForName(name: string): Category {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length]!;
}
