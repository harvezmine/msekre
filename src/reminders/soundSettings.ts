import { useSyncExternalStore } from 'react';
import { readSecure, writeSecure } from '@/api/secureStore';

/**
 * Pilihan suara pengingat dan alarm di HP ini (Akun → Pemberitahuan). Tidak dikirim ke server. Nada alarm tetap nada
 * alarm bawaan HP (saluran `alarm` modul native); pilihan nada menyusul setelah diuji di HP.
 */
export interface SoundSettings {
  /** Pengingat dan layar alarm bergetar. */
  vibrate: boolean;
}

export const DEFAULT_SOUND: SoundSettings = { vibrate: true };
const KEY = 'suara.pengingat';

function parse(raw: string | null): SoundSettings {
  try {
    const v = JSON.parse(raw ?? 'null') as Partial<SoundSettings> | null;
    return { vibrate: typeof v?.vibrate === 'boolean' ? v.vibrate : DEFAULT_SOUND.vibrate };
  } catch {
    return DEFAULT_SOUND;
  }
}

/**
 * Pilihan suara yang tersimpan di HP. Dibaca sekali (`load`), lalu berubah lewat `set`; pendengar (penjadwal pengingat,
 * layar alarm, layar Pemberitahuan) diberi tahu setiap berubah.
 */
export class SoundSettingsStore {
  private state: SoundSettings = DEFAULT_SOUND;
  private loading: Promise<SoundSettings> | null = null;
  private readonly listeners = new Set<() => void>();

  /** `persist: false` hanya di memori (tes). */
  constructor(private readonly persist = true) {}

  get = (): SoundSettings => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Baca dari penyimpanan HP (sekali); yang diubah selagi membaca menang. */
  load = (): Promise<SoundSettings> => {
    this.loading ??= (async () => {
      if (!this.persist) return this.state;
      const stored = parse(await readSecure(KEY));
      if (this.state === DEFAULT_SOUND && stored.vibrate !== this.state.vibrate) {
        this.state = stored;
        this.emit();
      }
      return this.state;
    })();
    return this.loading;
  };

  set = async (patch: Partial<SoundSettings>): Promise<void> => {
    const next = { ...this.state, ...patch };
    if (next.vibrate === this.state.vibrate) return;
    this.state = next;
    this.emit();
    if (this.persist) await writeSecure(KEY, JSON.stringify(next));
  };

  private emit() {
    for (const l of [...this.listeners]) l();
  }
}

let shared: SoundSettingsStore | null = null;

export function getSoundSettings(): SoundSettingsStore {
  shared ??= new SoundSettingsStore();
  return shared;
}

/** Ganti penyimpanan bersama (tes). `null` = kembali ke bawaan. */
export function setSoundSettings(store: SoundSettingsStore | null) {
  shared = store;
}

/** Pilihan suara untuk layar, berubah langsung saat diganti. */
export function useSoundSettings(): SoundSettings & { set: SoundSettingsStore['set'] } {
  const store = getSoundSettings();
  const state = useSyncExternalStore(store.subscribe, store.get);
  return { ...state, set: store.set };
}
