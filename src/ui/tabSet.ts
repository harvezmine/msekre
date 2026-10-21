import { useEffect, useSyncExternalStore } from 'react';
import { readSecure, writeSecure } from '@/api/secureStore';
import { useDevices } from '@/api/useDevices';
import { useHome } from '@/api/useHome';

/**
 * Tab yang tampil tumbuh mengikuti pemakaian (§6.2 spesifikasi):
 * - Beranda dan Agenda selalu ada;
 * - Perangkat setelah ada perangkat pertama (termasuk Kotak);
 * - Usaha setelah ada data usaha (`Home.business`).
 * Akun bukan tab (avatar di Beranda). Susunan terakhir disimpan di HP, supaya saat aplikasi dibuka tab tidak muncul
 * satu per satu; tab yang baru muncul selama aplikasi terbuka diberi titik sampai dikunjungi.
 */
export type TabName = 'index' | 'agenda' | 'perangkat' | 'usaha';

export interface TabFlags {
  perangkat: boolean;
  usaha: boolean;
}

const KEY = 'tab.susunan';
const MINIMAL: TabFlags = { perangkat: false, usaha: false };

export function tabsFor(flags: TabFlags): TabName[] {
  return [
    'index',
    'agenda',
    ...(flags.perangkat ? ['perangkat' as const] : []),
    ...(flags.usaha ? ['usaha' as const] : []),
  ];
}

/** Bagi tab di kiri dan kanan Inti: dua tab = satu-satu; lebih = Beranda dan Agenda di kiri, sisanya di kanan. */
export function splitTabs<T>(tabs: T[]): { left: T[]; right: T[] } {
  const k = tabs.length <= 2 ? 1 : 2;
  return { left: tabs.slice(0, k), right: tabs.slice(k) };
}

// Susunan yang tersimpan: `undefined` = belum dibaca, `null` = belum pernah ada.
let remembered: TabFlags | null | undefined = undefined;
let reading = false;
/** Tab yang muncul selama aplikasi terbuka dan belum dikunjungi (titik lembut). */
let fresh: ReadonlySet<TabName> = new Set();
let shown: TabFlags | null = null;
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
const snapshot = () => ({ remembered, fresh });
let last = snapshot();
const getSnapshot = () => {
  if (last.remembered !== remembered || last.fresh !== fresh) last = snapshot();
  return last;
};

function read() {
  if (reading) return;
  reading = true;
  void readSecure(KEY).then((raw) => {
    if (remembered !== undefined) return;
    try {
      const v = raw ? (JSON.parse(raw) as Partial<TabFlags>) : null;
      remembered = v ? { perangkat: v.perangkat === true, usaha: v.usaha === true } : null;
    } catch {
      remembered = null;
    }
    emit();
  });
}

/** Tab `name` sudah dikunjungi: titiknya hilang. */
export function visitTab(name: TabName): void {
  if (!fresh.has(name)) return;
  const next = new Set(fresh);
  next.delete(name);
  fresh = next;
  emit();
}

/** Untuk tes: lupakan susunan tersimpan dan titik. `known` = susunan dianggap sudah dibaca dari HP. */
export function resetTabSet(known: TabFlags | null = null): void {
  remembered = known;
  reading = true;
  fresh = new Set();
  shown = null;
  emit();
}

export interface TabSet {
  /** `false` selama susunan belum diketahui (sekejap saat aplikasi dibuka): bilah tab belum menggambar tab. */
  ready: boolean;
  tabs: TabName[];
  fresh: ReadonlySet<TabName>;
}

export function useTabSet(): TabSet {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  const { home, status: homeStatus } = useHome();
  const devices = useDevices('Semua');
  useEffect(() => {
    if (remembered === undefined) read();
  }, []);

  const homeKnown = home !== null;
  const devicesKnown = devices.data !== null;
  const flags: TabFlags = {
    perangkat: devicesKnown
      ? devices.devices.length > 0 || devices.box !== null
      : (state.remembered?.perangkat ?? false),
    usaha: homeKnown ? home.business !== null : (state.remembered?.usaha ?? false),
  };
  // Siap bila ada susunan tersimpan, atau datanya sudah datang. Pembukaan pertama menunggu datanya (tanpa tab yang
  // bermunculan); gagal memuat tanpa susunan tersimpan: Beranda dan Agenda saja.
  const failed = homeStatus === 'error' || devices.status === 'error';
  const ready =
    (state.remembered !== undefined && state.remembered !== null) ||
    (homeKnown && devicesKnown) ||
    (state.remembered === null && failed);

  // Simpan susunan yang sudah pasti, dan beri titik pada tab yang baru muncul selagi aplikasi terbuka.
  const key = `${flags.perangkat}|${flags.usaha}`;
  useEffect(() => {
    if (!ready) return;
    const before = shown;
    shown = flags;
    if (before) {
      const added = (['perangkat', 'usaha'] as const).filter((t) => flags[t] && !before[t]);
      if (added.length) {
        fresh = new Set([...fresh, ...added]);
        emit();
      }
    }
    if (homeKnown && devicesKnown) {
      const saved = remembered ?? MINIMAL;
      if (remembered === null || saved.perangkat !== flags.perangkat || saved.usaha !== flags.usaha) {
        remembered = flags;
        void writeSecure(KEY, JSON.stringify(flags));
        emit();
      }
    }
    // `flags` digambarkan oleh `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key, homeKnown, devicesKnown]);

  return { ready, tabs: tabsFor(flags), fresh: state.fresh };
}
