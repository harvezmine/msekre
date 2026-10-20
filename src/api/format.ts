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
