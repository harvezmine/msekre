/** Jendela bunyi alarm di HP (sama dengan `AlarmNotifier.TIMEOUT_MS` di native): sesudah itu layar alarm menutup sendiri. */
export const ALARM_WINDOW_MS = 10 * 60_000;

/**
 * Kapan jendela bunyi habis (milidetik epoch): `until` dari catatan alarm di HP; kalau tidak ada, waktu alarm + 10 menit;
 * kalau catatannya tidak ada sama sekali, 10 menit sejak layar dibuka.
 */
export function ringWindowEnd(ringing: { at: number; until?: number } | null, openedAt: number): number {
  if (!ringing) return openedAt + ALARM_WINDOW_MS;
  return ringing.until ?? ringing.at + ALARM_WINDOW_MS;
}
