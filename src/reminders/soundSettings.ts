import { useSyncExternalStore } from 'react';
import { readSecure, writeSecure } from '@/api/secureStore';

/**
 * Nada alarm: `bawaan` = nada alarm bawaan HP; selebihnya nada lembut yang ikut di aplikasi (`modules/alarm/android/
 * src/main/res/raw/alarm_nada_<id>.ogg`).
 */
export type ToneId = 'bawaan' | 'lembut' | 'pagi' | 'tenang';

export const TONES: readonly { id: ToneId; label: string }[] = [
  { id: 'bawaan', label: 'Bawaan HP' },
  { id: 'lembut', label: 'Lembut' },
  { id: 'pagi', label: 'Pagi' },
  { id: 'tenang', label: 'Tenang' },
];

const TONE_IDS = new Set<string>(TONES.map((t) => t.id));

export function toneLabel(id: ToneId): string {
  return TONES.find((t) => t.id === id)?.label ?? 'Bawaan HP';
}

/** Pilihan suara pengingat dan alarm di HP ini (Akun → Pemberitahuan). Tidak dikirim ke server. */
export interface SoundSettings {
  /** Pengingat dan alarm bergetar. */
  vibrate: boolean;
  tone: ToneId;
}

export const DEFAULT_SOUND: SoundSettings = { vibrate: true, tone: 'bawaan' };
const KEY = 'suara.pengingat';

function parse(raw: string | null): SoundSettings {
  try {
    const v = JSON.parse(raw ?? 'null') as Partial<SoundSettings> | null;
    return {
      vibrate: typeof v?.vibrate === 'boolean' ? v.vibrate : DEFAULT_SOUND.vibrate,
      tone: typeof v?.tone === 'string' && TONE_IDS.has(v.tone) ? v.tone : DEFAULT_SOUND.tone,
    };
  } catch {
    return DEFAULT_SOUND;
  }
}

/**
 * Pilihan suara yang tersimpan di HP. Dibaca sekali (`load`), lalu berubah lewat `set`; pendengar (penjadwal pengingat,
 * modul alarm, layar Pemberitahuan) diberi tahu setiap berubah.
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
      if (this.state === DEFAULT_SOUND && (stored.vibrate !== this.state.vibrate || stored.tone !== this.state.tone)) {
        this.state = stored;
        this.emit();
      }
      return this.state;
    })();
    return this.loading;
  };

  set = async (patch: Partial<SoundSettings>): Promise<void> => {
    const next = { ...this.state, ...patch };
    if (next.vibrate === this.state.vibrate && next.tone === this.state.tone) return;
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
