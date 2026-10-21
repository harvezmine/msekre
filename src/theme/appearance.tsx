import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { readSecure, writeSecure } from '@/api/secureStore';

/** Pilihan tampilan: ikut HP (bawaan), selalu terang, atau selalu gelap. */
export type AppearancePreference = 'system' | 'light' | 'dark';
export const APPEARANCE_PREFERENCES: readonly AppearancePreference[] = ['system', 'light', 'dark'];

/** Kata untuk pengguna. */
export const APPEARANCE_LABEL: Record<AppearancePreference, string> = {
  system: 'Ikuti HP',
  light: 'Terang',
  dark: 'Gelap',
};

// Pilihan tampilan hanya milik HP ini (bukan data akun), disimpan di penyimpanan aman yang sama dengan pilihan mode.
const KEY = 'tampilan';

export function parsePreference(raw: string | null): AppearancePreference {
  return APPEARANCE_PREFERENCES.find((p) => p === raw) ?? 'system';
}

type Scheme = 'light' | 'dark';

interface Value {
  preference: AppearancePreference;
  setPreference: (next: AppearancePreference) => void;
  /** Mode HP saat ini, bila provider yang menjaganya; tanpa provider, `useAppearance` membacanya sendiri. */
  system: Scheme | null;
}

const AppearanceContext = createContext<Value>({ preference: 'system', setPreference: () => {}, system: null });

/** Teruskan pilihan ke bagian native (papan ketik, dialog, pemilih tanggal) supaya ikut. 'unspecified' = ikut HP lagi. */
function applyNative(p: AppearancePreference) {
  Appearance.setColorScheme(p === 'system' ? 'unspecified' : p);
}

const systemNow = (): Scheme => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');

/**
 * Menyimpan pilihan tampilan. Memuatnya dulu dan baru menampilkan isinya (layar pembuka asli masih menutupi), jadi tidak
 * ada kilatan terang lalu gelap. Mode HP dipantau sendiri: sesudah pilihan dikembalikan ke "Ikuti HP", yang dibaca
 * langsung dari sistem, bukan dari nilai paksaan sebelumnya.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<AppearancePreference>('system');
  const [system, setSystem] = useState<Scheme>(systemNow);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void readSecure(KEY).then((raw) => {
      if (!alive) return;
      const p = parsePreference(raw);
      if (p !== 'system') applyNative(p);
      setPref(p);
      setSystem(systemNow());
      setReady(true);
    });
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme === 'dark' ? 'dark' : 'light'));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const setPreference = useCallback((next: AppearancePreference) => {
    applyNative(next);
    setPref(next);
    setSystem(systemNow());
    void writeSecure(KEY, next);
  }, []);

  const value = useMemo(() => ({ preference, setPreference, system }), [preference, setPreference, system]);
  if (!ready) return null;
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

/** Pilihan tampilan dan mode yang benar-benar berlaku (pilihan, atau mode HP bila "Ikuti HP"). */
export function useAppearance(): {
  preference: AppearancePreference;
  setPreference: (p: AppearancePreference) => void;
  scheme: Scheme;
} {
  const { preference, setPreference, system } = useContext(AppearanceContext);
  const hook = useColorScheme();
  const phone: Scheme = system ?? (hook === 'dark' ? 'dark' : 'light');
  return { preference, setPreference, scheme: preference === 'system' ? phone : preference };
}
