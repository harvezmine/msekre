import type { StreamEvent } from './contract';

/**
 * Proses asisten yang sedang berjalan, menurut `runId`. Dua proses bersamaan (aplikasi dan WhatsApp) tidak saling
 * menimpa: tanda "berpikir" menyala selama himpunannya tidak kosong. Fungsi murni; himpunan lama tidak diubah.
 */
export type ActiveRuns = ReadonlySet<string>;

export const NO_RUNS: ActiveRuns = new Set<string>();

/** Himpunan baru setelah `event`; event selain `thinking` tidak mengubah apa pun (himpunan yang sama dikembalikan). */
export function applyThinking(runs: ActiveRuns, event: StreamEvent): ActiveRuns {
  if (event.type !== 'thinking') return runs;
  if (event.on === runs.has(event.runId)) return runs;
  const next = new Set(runs);
  if (event.on) next.add(event.runId);
  else next.delete(event.runId);
  return next;
}

export const isThinking = (runs: ActiveRuns): boolean => runs.size > 0;
