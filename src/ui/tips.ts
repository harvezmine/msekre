import { useEffect, useSyncExternalStore } from 'react';
import { readSecure, writeSecure } from '@/api/secureStore';
import { devQuery } from '@/dev/query';

/**
 * Petunjuk sekali-lihat (§6.3 spesifikasi): satu per satu, masing-masing hanya sekali seumur aplikasi di HP ini, hilang
 * dengan ketukan apa pun. Tanda "sudah dilihat" disimpan di penyimpanan aman HP (bukan data akun).
 */
export type TipId = 'inti';

export const TIP_TEXT: Record<TipId, string> = {
  inti: 'Ketuk untuk chat · Tahan untuk bicara',
};

const KEY: Record<TipId, string> = { inti: 'petunjuk.inti' };

/** `undefined` = belum dibaca dari HP (petunjuk belum ditampilkan, supaya tidak berkedip). */
let seen: Record<TipId, boolean | undefined> = { inti: undefined };
let reading = false;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of [...listeners]) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

function load() {
  if (reading) return;
  reading = true;
  // Pratinjau web saat pengembangan: `?petunjuk=1` menampilkannya, `?petunjuk=0` tidak.
  const forced = devQuery().petunjuk;
  if (forced === '0' || forced === '1') {
    seen = { ...seen, inti: forced === '0' };
    emit();
    return;
  }
  void readSecure(KEY.inti).then((value) => {
    if (seen.inti !== undefined) return;
    seen = { ...seen, inti: value === '1' };
    emit();
  });
}

/** Tutup petunjuk untuk selamanya (di HP ini). */
export function dismissTip(id: TipId): void {
  if (seen[id] === true) return;
  seen = { ...seen, [id]: true };
  emit();
  void writeSecure(KEY[id], '1');
}

/** Petunjuk `id`: tampil hanya bila sudah pasti belum pernah dilihat. */
export function useTip(id: TipId): { visible: boolean; dismiss: () => void } {
  const value = useSyncExternalStore(subscribe, () => seen[id]);
  useEffect(() => {
    if (value === undefined) load();
  }, [value]);
  return { visible: value === false, dismiss: () => dismissTip(id) };
}

/** Untuk tes: `seen` (bawaan tes, petunjuk tidak muncul), `fresh` (pembukaan pertama), `unknown` (dibaca dari HP). */
export function resetTips(state: 'seen' | 'fresh' | 'unknown'): void {
  reading = state !== 'unknown';
  seen = { inti: state === 'unknown' ? undefined : state === 'seen' };
  emit();
}
