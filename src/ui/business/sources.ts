import type { BusinessSource } from '@/api/contract';

/**
 * "dari Moka" untuk bagian Usaha `part` (`sales`, `stock`, `moneyIn`, ...): sumber tersambung pertama yang menyebut bagian
 * itu di `provides`; `null` kalau tidak ada. Tidak ada nama sumber yang ditulis mati di aplikasi.
 */
export function sourceCaption(sources: BusinessSource[], part: string): string | null {
  const found = sources.find((s) => s.connected && s.provides?.includes(part));
  return found ? `dari ${found.label}` : null;
}
