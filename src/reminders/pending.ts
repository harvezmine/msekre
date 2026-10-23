import { readSecure, writeSecure } from '@/api/secureStore';

/**
 * Tombol notifikasi pengingat yang sudah dijalankan di HP tapi belum sampai ke server (tanpa internet, atau sesi belum
 * siap saat aplikasi baru dibuka dari notifikasi): `done` ("Selesai") atau `snooze` ("Tunda 10 menit", sampai `until`).
 */
export interface PendingReminderAction {
  id: string;
  kind: 'done' | 'snooze';
  /** `snooze`: saat pengingat muncul lagi (ISO 8601). */
  until?: string;
  title: string;
  body: string;
  date: string;
}

const KEY = 'pengingat.aksi';

function valid(p: Partial<PendingReminderAction> | null | undefined): p is PendingReminderAction {
  return (
    typeof p?.id === 'string' &&
    (p.kind === 'done' || (p.kind === 'snooze' && typeof p.until === 'string')) &&
    typeof p.title === 'string' &&
    typeof p.body === 'string' &&
    typeof p.date === 'string'
  );
}

/**
 * Antrean tombol pengingat yang menunggu dikabarkan ke server, satu per id (yang terakhir menang). Disimpan di HP supaya
 * selamat dari aplikasi yang ditutup; penyamaan pengingat mengulang `PATCH`-nya sampai berhasil (atau itemnya sudah
 * tidak ada). Selama menunggu, "Selesai" tidak dijadwalkan lagi dan tundaan tetap berbunyi pada waktunya.
 */
export class PendingReminderActions {
  private items: Map<string, PendingReminderAction> | null = null;

  /** `persist: false` hanya di memori (tes). */
  constructor(private readonly persist = true) {}

  private async load(): Promise<Map<string, PendingReminderAction>> {
    if (this.items) return this.items;
    const items = new Map<string, PendingReminderAction>();
    if (this.persist) {
      try {
        const parsed: unknown = JSON.parse((await readSecure(KEY)) ?? '[]');
        if (Array.isArray(parsed)) {
          for (const p of parsed as Partial<PendingReminderAction>[]) if (valid(p)) items.set(p.id, p);
        }
      } catch {
        // Rusak: dianggap kosong.
      }
    }
    this.items ??= items;
    return this.items;
  }

  private async save(items: Map<string, PendingReminderAction>) {
    if (this.persist) await writeSecure(KEY, items.size ? JSON.stringify([...items.values()]) : null);
  }

  async list(): Promise<PendingReminderAction[]> {
    return [...(await this.load()).values()];
  }

  async put(action: PendingReminderAction): Promise<void> {
    const items = await this.load();
    items.set(action.id, action);
    await this.save(items);
  }

  /** Hapus, hanya kalau yang tersimpan masih yang sama (tombol baru selagi menunggu tidak ikut terhapus). */
  async remove(id: string, same?: PendingReminderAction): Promise<void> {
    const items = await this.load();
    const now = items.get(id);
    if (!now || (same && (now.kind !== same.kind || now.until !== same.until))) return;
    items.delete(id);
    await this.save(items);
  }

  async clear(): Promise<void> {
    const items = await this.load();
    items.clear();
    await this.save(items);
  }
}

let shared: PendingReminderActions | null = null;

export function getPendingReminderActions(): PendingReminderActions {
  shared ??= new PendingReminderActions();
  return shared;
}

/** Ganti antrean bersama (tes). `null` = kembali ke bawaan. */
export function setPendingReminderActions(actions: PendingReminderActions | null) {
  shared = actions;
}
