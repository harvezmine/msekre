import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from './ApiProvider';
import type { SecurityRes } from './contract';

export interface Security {
  /** Keadaan dari server, atau `null` selagi dimuat (atau gagal dimuat: lihat `failed`). */
  state: SecurityRes | null;
  /** Keadaan gagal dimuat (tanpa sinyal). */
  failed: boolean;
  /** Muat ulang keadaan. */
  refresh(): Promise<SecurityRes | null>;
  /**
   * Apakah aksi yang dijaga (kamera mati, alarm rumah mati, kunci pintu) harus minta PIN. Selalu bertanya ke server
   * supaya perubahan dari layar lain terbaca; `false` hanya bila server memastikan PIN mati. Gagal bertanya: `true`.
   */
  pinRequired(): Promise<boolean>;
  /** Hidupkan atau matikan permintaan PIN. Melempar `ApiFailure`. */
  setEnabled(pinEnabled: boolean): Promise<SecurityRes>;
  /** Buat PIN; dengan `currentPin` berarti mengganti. Melempar `ApiFailure` (`pin_wrong` bila PIN lama salah). */
  setPin(pin: string, currentPin?: string): Promise<SecurityRes>;
  /** `true` bila PIN cocok. Melempar `ApiFailure` untuk kendala selain salah PIN. */
  verify(pin: string): Promise<boolean>;
}

/**
 * Keamanan akun: PIN opsional (bawaan mati) untuk kamera, alarm rumah, dan kunci pintu. `load: false` tidak memuat
 * keadaannya saat layar dibuka (layar yang hanya perlu `pinRequired` atau `verify`).
 */
export function useSecurity({ load = true }: { load?: boolean } = {}): Security {
  const { transport } = useApi();
  const [state, setState] = useState<SecurityRes | null>(null);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await transport.security();
      if (alive.current) {
        setState(next);
        setFailed(false);
      }
      return next;
    } catch {
      if (alive.current) setFailed(true);
      return null;
    }
  }, [transport]);
  // Dimuat saat layar dibuka dan tiap kali layar kembali di depan (PIN bisa berubah di layar yang baru ditutup).
  const focused = useIsFocused();
  useEffect(() => {
    if (!load || !focused) return;
    let current = true;
    transport.security().then(
      (next) => {
        if (!current) return;
        setState(next);
        setFailed(false);
      },
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [load, focused, transport]);

  const keep = useCallback((next: SecurityRes) => {
    if (alive.current) setState(next);
    return next;
  }, []);
  return {
    state,
    failed,
    refresh,
    pinRequired: async () => {
      const next = await refresh();
      return next === null || next.pinEnabled;
    },
    setEnabled: async (pinEnabled) => keep(await transport.setSecurity({ pinEnabled })),
    setPin: async (pin, currentPin) =>
      keep(await transport.setPin(currentPin === undefined ? { pin } : { pin, currentPin })),
    verify: (pin) => transport.verifyPin(pin),
  };
}
