/** Jeda sambung ulang WebSocket: 1, 2, 4, 8, 16, lalu paling lama 30 detik, dengan goyangan kecil ±10%. */
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 30_000;
export const BACKOFF_JITTER = 0.1;

/**
 * Jeda sebelum percobaan sambung ulang ke-`attempt` (mulai 0). Goyangan mencegah banyak HP menyambung serentak setelah
 * server hidup lagi; hasilnya tidak pernah lewat {@link BACKOFF_MAX_MS}. `random` mengembalikan 0..1 (bawaan
 * `Math.random`); 0,5 berarti tanpa goyangan.
 */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, Math.floor(attempt)));
  const jitter = base * BACKOFF_JITTER * (random() * 2 - 1);
  return Math.round(Math.min(BACKOFF_MAX_MS, base + jitter));
}
