/**
 * Jam "HH.MM" dari waktu ISO 8601. Dengan `tzOffsetMinutes` (zona waktu pengguna dari server, WIB 420) jamnya menurut zona
 * itu, sama dengan jam yang ditulis server; tanpa itu menurut zona HP. Tanggal tidak ditampilkan, jadi batas yang
 * melewati tengah malam tetap benar. Waktu yang tidak terbaca: "--.--".
 */
export function formatJam(iso: string, tzOffsetMinutes?: number | null): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--.--';
  // Geser ke jam dinding zona itu (menit, positif di timur UTC), lalu baca sebagai UTC.
  const offset = tzOffsetMinutes ?? -d.getTimezoneOffset();
  const local = new Date(d.getTime() + offset * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(local.getUTCHours())}.${pad(local.getUTCMinutes())}`;
}

/** "Selamat pagi" / "siang" / "sore" / "malam" menurut jam (0-23): pagi 04-10, siang 11-14, sore 15-17, selain itu malam. */
export function greetingFor(hour: number): string {
  if (hour >= 4 && hour < 11) return 'Selamat pagi';
  if (hour >= 11 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/** 8122045781 -> 812-2045-781 (tiga, empat, sisanya). */
export function groupPhone(digits: string): string {
  return [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7)].filter(Boolean).join('-');
}

/** Nomor E.164 tanpa "+" untuk ditampilkan: 6281220457781 -> "+62 812-2045-781". Selain 62, apa adanya dengan "+". */
export function formatPhoneDisplay(e164: string): string {
  return e164.startsWith('62') ? `+62 ${groupPhone(e164.slice(2))}` : `+${e164}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Tanggal "12 Jan 2027" dari waktu ISO 8601, menurut zona waktu HP. Waktu yang tidak terbaca: `null`. */
export function formatTanggal(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Hanya angka, tanpa 62 atau 0 di depan, paling banyak 13 angka. "0812…", "+62 812…", "62 0812…" semuanya menjadi
 * "812…". Nomor seluler Indonesia selalu berawal 8, jadi 0 di depan memang selalu awalan.
 */
export function cleanPhone(text: string): string {
  return text.replace(/\D/g, '').replace(/^62/, '').replace(/^0+/, '').slice(0, 13);
}

/** 100000 -> "Rp100.000" (titik pemisah ribuan, tanpa Intl). */
export function formatRupiah(amount: number): string {
  const digits = String(Math.max(0, Math.round(amount)));
  return `Rp${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** "48 KB · Excel" dari ukuran berkas dan jenis (mime). */
export function formatFileMeta(sizeBytes: number, mime: string): string {
  let size: string;
  if (sizeBytes < 1024) size = `${sizeBytes} B`;
  else if (sizeBytes < 1024 * 1024) size = `${Math.round(sizeBytes / 1024)} KB`;
  else size = `${(sizeBytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  let kind = 'Berkas';
  if (/spreadsheet|excel/.test(mime)) kind = 'Excel';
  else if (/wordprocessing|msword/.test(mime)) kind = 'Word';
  else if (/presentation|powerpoint/.test(mime)) kind = 'PowerPoint';
  else if (mime === 'application/pdf') kind = 'PDF';
  else if (mime.startsWith('image/')) kind = 'Gambar';
  else if (mime.startsWith('audio/')) kind = 'Suara';
  return `${size} · ${kind}`;
}
