import type { BusinessSource } from '@/api/contract';

/** "dari Moka" untuk sumber `key` yang tersambung; `null` kalau tidak tersambung atau tidak dikenal. */
export function sourceCaption(sources: BusinessSource[], key: string): string | null {
  const found = sources.find((s) => s.key === key && s.connected);
  return found ? `dari ${found.label}` : null;
}
