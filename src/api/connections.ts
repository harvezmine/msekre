import type { Connections, ConnectionPermission, Service, ServiceCategory } from './contract';

/** "baru saja", "5 menit lalu", "2 jam lalu", "3 hari lalu". Waktu yang tidak terbaca: `null`. */
export function agoText(iso: string, now: number = Date.now()): string | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const minutes = Math.floor((now - t) / 60_000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

/** Layanan tersambung yang perlu disambungkan ulang lewat halaman masuk resmi? */
export const needsReconnect = (s: Service | undefined): boolean => s?.attention?.action === 'reconnect';

/** Baris kedua daftar Terhubung: perlu perhatian, atau "akun · Terakhir dipakai 5 menit lalu". */
export function serviceLine(s: Service, now: number = Date.now()): string {
  if (s.attention) return s.attention.text;
  const used = s.lastUsed ? agoText(s.lastUsed, now) : null;
  const parts = [s.account, used ? `Terakhir dipakai ${used}` : null].filter((p): p is string => !!p);
  return parts.length ? parts.join(' · ') : 'Aktif';
}

/** Judul kelompok di katalog, dalam urutan tampil. */
export const CATEGORIES: { key: ServiceCategory; title: string }[] = [
  { key: 'kerja', title: 'Kerja' },
  { key: 'catatan', title: 'Catatan' },
  { key: 'usaha', title: 'Usaha' },
  { key: 'rumah', title: 'Rumah' },
  { key: 'lainnya', title: 'Lainnya' },
];

/** Katalog menurut kelompok; kelompok kosong dibuang. */
export function groupByCategory(services: Service[]): { key: ServiceCategory; title: string; items: Service[] }[] {
  return CATEGORIES.flatMap((c) => {
    const items = services.filter((s) => s.category === c.key);
    return items.length ? [{ ...c, items }] : [];
  });
}

export const PERMISSION_OPTIONS: { value: ConnectionPermission; title: string }[] = [
  { value: 'baca', title: 'Baca saja' },
  { value: 'baca_tulis', title: 'Baca dan tulis' },
];

/** Hasil kembali dari halaman masuk resmi: `<skema>://terhubung/tersambung?id=<id>&ok=1` atau `ok=0&reason=`. */
export interface ConnectCallback {
  id: string | null;
  ok: boolean;
  reason: string | null;
}

export function parseCallbackUrl(url: string): ConnectCallback {
  const query = url.split('#')[0]!.split('?')[1] ?? '';
  const params = new Map<string, string>();
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const at = pair.indexOf('=');
    const key = at < 0 ? pair : pair.slice(0, at);
    let value = at < 0 ? '' : pair.slice(at + 1);
    try {
      value = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      // Biarkan apa adanya.
    }
    params.set(key, value);
  }
  return { id: params.get('id') || null, ok: params.get('ok') === '1', reason: params.get('reason') || null };
}

/** Skema alamat milik aplikasi ini (sama dengan `scheme` di app.config.ts); skema dari server diabaikan. */
export const APP_SCHEME = 'sekretarisai';

/** Alamat kembali yang dinanti aplikasi dari halaman masuk resmi. */
export const CONNECT_REDIRECT_URL = `${APP_SCHEME}://terhubung/tersambung`;

/** Teks ramah untuk gagal menyambung; `reason` dari server dibaca bila dikenal. */
export function failureText(name: string, reason: string | null): string {
  if (reason === 'ditolak') return `Izin dari ${name} belum diberikan, jadi belum tersambung.`;
  return `Belum berhasil tersambung ke ${name}. Coba lagi ya.`;
}

export const CANCELLED_TEXT = 'Halaman masuk ditutup sebelum selesai, jadi belum ada yang tersambung.';

/** Cari satu layanan di semua daftar. */
export function findService(c: Connections | null, id: string): Service | undefined {
  if (!c) return undefined;
  return [...c.connected, ...c.catalog, ...c.formerly].find((s) => s.id === id);
}
