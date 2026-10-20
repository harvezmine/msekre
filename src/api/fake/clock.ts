/** Senin, 20 Okt 2025, 10.42 WIB: jam utas contoh Fase 0b (desain dibuat di kalender 2025). */
export const SAMPLE_NOW = Date.UTC(2025, 9, 20, 3, 42);
const WIB_MS = 7 * 3600_000;
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Jam server tiruan: mulai di {@link SAMPLE_NOW} dan berjalan seiring waktu sungguhan (`Date.now`, yang ikut dimajukan
 * timer palsu Jest). Jam "HH.MM" selalu WIB, tidak bergantung zona waktu HP.
 */
export class FakeClock {
  private readonly startedAt = Date.now();

  constructor(private readonly start = SAMPLE_NOW) {}

  now(): number {
    return this.start + (Date.now() - this.startedAt);
  }

  iso(offsetMinutes = 0): string {
    return new Date(this.now() + offsetMinutes * 60_000).toISOString();
  }

  /** "HH.MM" WIB, `offsetMinutes` dari sekarang. */
  hhmm(offsetMinutes = 0): string {
    return hhmmWib(this.now() + offsetMinutes * 60_000);
  }
}

export function hhmmWib(ms: number): string {
  const d = new Date(ms + WIB_MS);
  return `${pad(d.getUTCHours())}.${pad(d.getUTCMinutes())}`;
}

/** Waktu ISO dari tanggal 2025 dan jam WIB "HH.MM", untuk riwayat contoh. */
export function wibIso(month: number, day: number, time: string): string {
  const [h, m] = time.split('.').map(Number);
  return new Date(Date.UTC(2025, month - 1, day, h!, m!) - WIB_MS).toISOString();
}

/** Waktu ISO dari tanggal "YYYY-MM-DD" dan jam WIB "HH.MM". */
export function wibIsoOf(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split('.').map(Number);
  return new Date(Date.UTC(y!, mo! - 1, d!, h!, mi!) - WIB_MS).toISOString();
}
