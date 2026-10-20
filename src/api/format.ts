/**
 * Jam "HH.MM" dari waktu ISO 8601, di zona waktu HP (WIB, WITA, atau WIT sesuai pengaturan HP). Tanggal tidak
 * ditampilkan, jadi batas yang melewati tengah malam tetap benar menurut jam HP. Waktu yang tidak terbaca: "--.--".
 */
export function formatJam(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--.--';
  // Geser ke jam dinding HP lewat selisih zona waktunya (menit, negatif di timur UTC), lalu baca sebagai UTC.
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(local.getUTCHours())}.${pad(local.getUTCMinutes())}`;
}
