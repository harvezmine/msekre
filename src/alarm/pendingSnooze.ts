import { readSecure, writeSecure } from '@/api/secureStore';

/** Tunda yang sudah dipasang di HP tapi belum sampai ke server (tanpa internet saat ditekan). */
export interface PendingSnooze {
  id: string;
  /** Saat alarm berbunyi lagi (ISO 8601). */
  until: string;
  title: string;
  note?: string;
}

const KEY = 'alarm.tunda';

/**
 * Daftar tunda yang menunggu dikabarkan ke server. Alarm tundaannya sudah terjadwal di HP; daftar ini yang menjaganya
 * tetap terjadwal (penyamaan alarm tidak membuangnya karena server belum tahu) dan yang membuat `PATCH` diulang pada
 * penyamaan berikutnya. Disimpan di HP supaya selamat dari aplikasi yang ditutup.
 */
export class PendingSnoozes {
  private items: Map<string, PendingSnooze> | null = null;

  /** `persist: false` hanya di memori (tes). */
  constructor(private readonly persist = true) {}

  private async load(): Promise<Map<string, PendingSnooze>> {
    if (this.items) return this.items;
    const items = new Map<string, PendingSnooze>();
    if (this.persist) {
      try {
        const parsed: unknown = JSON.parse((await readSecure(KEY)) ?? '[]');
        if (Array.isArray(parsed)) {
          for (const p of parsed as Partial<PendingSnooze>[]) {
            if (typeof p?.id === 'string' && typeof p.until === 'string' && typeof p.title === 'string') {
              items.set(p.id, { id: p.id, until: p.until, title: p.title, ...(p.note ? { note: p.note } : {}) });
            }
          }
        }
      } catch {
        // Rusak: dianggap kosong.
      }
    }
    // Yang ditulis selagi membaca menang.
    this.items ??= items;
    return this.items;
  }

  private async save(items: Map<string, PendingSnooze>) {
    if (this.persist) await writeSecure(KEY, items.size ? JSON.stringify([...items.values()]) : null);
  }

  async list(): Promise<PendingSnooze[]> {
    return [...(await this.load()).values()];
  }

  async put(snooze: PendingSnooze): Promise<void> {
    const items = await this.load();
    items.set(snooze.id, snooze);
    await this.save(items);
  }

  async remove(id: string): Promise<void> {
    const items = await this.load();
    if (items.delete(id)) await this.save(items);
  }

  async clear(): Promise<void> {
    const items = await this.load();
    items.clear();
    await this.save(items);
  }
}

let shared: PendingSnoozes | null = null;

/** Daftar tunda bersama untuk seluruh aplikasi. */
export function getPendingSnoozes(): PendingSnoozes {
  shared ??= new PendingSnoozes();
  return shared;
}

/** Ganti daftar bersama (tes). `null` = kembali ke bawaan. */
export function setPendingSnoozes(snoozes: PendingSnoozes | null) {
  shared = snoozes;
}
