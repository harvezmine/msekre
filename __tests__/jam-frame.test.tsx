/// <reference types="node" />
/**
 * Jam frame Reanimated tanpa id yang tak dikenal di utas UI.
 *
 * Latar: di build rilis kesalahan di utas UI menutup paksa aplikasi. `FrameCallbackRegistryUI.manageStateFrameCallback`
 * (Reanimated 4.7) membaca `frameCallbackRegistry.get(id)!.startTime` tanpa memeriksa id-nya, jadi mematikan jam yang
 * belum (atau sudah tidak) terdaftar melempar "Cannot set properties of undefined (setting 'startTime')".
 *
 * Urutan lama yang memicunya (terlihat di tes Mode Suara saat balasan datang tepat di ujung langkah jam tiruan):
 * 1. Kait `useFrameCallback(cb, autostart)` mendaftar ulang setiap kali identitas `cb` berubah, dan worklet sebaris
 *    berubah identitas di setiap render (React Compiler tidak memoize argumen worklet ini; di Jest compiler mati).
 * 2. Di Jest, `scheduleOnUI` menjadi `setTimeout(0)` per tugas. Timer 0 ms yang dibuat selama langkah jam tiruan
 *    dijadwalkan di `now + 1`, yang dibuat sesudahnya di `now`. Render di dalam langkah (daftar #b) lalu render tepat
 *    sesudahnya (hapus #b, daftar #c) membuat "hapus #b" sampai di utas UI sebelum "daftar #b": id tak dikenal.
 *
 * Perbaikan: jam frame dimiliki `FrameClock` yang hanya dipasang selama berjalan, dengan worklet yang stabil, dan tanpa
 * `setActive`. Pertahanan: patch Reanimated (patches/, lewat patch-package saat npm install/ci) mengabaikan perubahan
 * keadaan untuk id yang tak dikenal.
 */
import { act, render } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { makeMutable, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { renderWithProviders } from './helpers';
import { heroMetrics, type WebNode } from '@/ui/beranda/heroLayout';
import { IntiHero } from '@/ui/beranda/IntiHero';
import { WavesSkia } from '@/voice/WavesSkia';

interface UiRegistry {
  frameCallbackRegistry: Map<number, unknown>;
  activeFrameCallbacks: Set<number>;
  registerFrameCallback: (cb: unknown, id: number) => void;
  unregisterFrameCallback: (id: number) => void;
  manageStateFrameCallback: (id: number, state: boolean) => void;
}
const registry = () => (globalThis as unknown as { _frameCallbackRegistry: UiRegistry })._frameCallbackRegistry;

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

let errors: jest.SpyInstance;
beforeEach(async () => {
  errors = jest.spyOn(console, 'error');
  // Registri UI disiapkan lewat tugas utas UI saat modul useFrameCallback dimuat; di Jest tugas itu berjalan di timer
  // tiruan beberapa frame kemudian.
  for (let i = 0; i < 50 && !registry(); i++) await advance(16);
});
afterEach(() => errors.mockRestore());

/** Pesan console.error yang menyebut `startTime` (kesalahan registri jam frame di utas UI). */
const startTimeErrors = () =>
  errors.mock.calls.map((args) => args.map(String).join(' ')).filter((m) => /startTime/.test(m));

describe('registri jam frame di utas UI (patch Reanimated)', () => {
  test('mematikan, menghapus, atau menyalakan id yang tak dikenal tidak melempar dan tidak menyalakan apa pun', async () => {
    const r = registry();
    expect(r).toBeDefined();
    expect(() => r.manageStateFrameCallback(987654, false)).not.toThrow();
    expect(() => r.unregisterFrameCallback(987654)).not.toThrow();
    expect(() => r.manageStateFrameCallback(987654, true)).not.toThrow();
    // Id tak dikenal tidak pernah masuk daftar aktif (putaran frame akan membaca registrinya dan melempar).
    expect(r.activeFrameCallbacks.has(987654)).toBe(false);
  });

  test('patch juga ada di sumber yang dibundel Metro (src) dan di lib yang dipakai Jest', () => {
    const root = join(__dirname, '..', 'node_modules', 'react-native-reanimated');
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<string, string>;
    // Metro memilih kolom "react-native" lebih dulu (src), Jest memakai "main" (lib).
    expect(pkg['react-native']).toBe('src/index');
    expect(pkg.main).toBe('lib/module/index');
    for (const file of [
      'src/frameCallback/FrameCallbackRegistryUI.ts',
      'lib/module/frameCallback/FrameCallbackRegistryUI.js',
    ]) {
      const code = readFileSync(join(root, file), 'utf8');
      expect([file, code.includes('patch Sekretaris AI')]).toEqual([file, true]);
      expect([
        file,
        /const callback = this\.frameCallbackRegistry\.get\(callbackId\);\s*if \(!callback\)/.test(code),
      ]).toEqual([file, true]);
    }
  });

  test('urutan lama (worklet sebaris + setActive, render tepat di ujung langkah jam tiruan) tidak lagi melempar', async () => {
    // Pola lama WavesSkia/IntiHero: worklet sebaris (identitas baru tiap render) dan setActive di efek.
    function OldClock({ n }: { n: number }) {
      const sv = useSharedValue(0);
      const frame = useFrameCallback((info) => {
        'worklet';
        sv.set(n + (info.timeSincePreviousFrame ?? 0));
      }, true);
      useEffect(() => {
        frame.setActive(true);
      }, [frame]);
      return null;
    }
    // Pembaruan berprioritas sinkron (seperti store Mode Suara lewat useSyncExternalStore) dari timer yang jatuh tepat di
    // ujung langkah: test-renderer merender dan menjalankan efeknya di tugas mikro tiruan, masih di dalam langkah.
    let value = 0;
    const listeners = new Set<() => void>();
    const subscribe = (f: () => void) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    };
    function Host({ bump }: { bump: number }) {
      const n = useSyncExternalStore(subscribe, () => value);
      return <OldClock n={n + bump} />;
    }
    const count = countRegistry();
    try {
      const view = await render(<Host bump={0} />);
      setTimeout(() => {
        value = 1;
        listeners.forEach((f) => f());
      }, 1000);
      // Daftar ulang #b di dalam langkah: tugas utas UI-nya dijadwalkan di now + 1.
      await advance(1000);
      // Render tepat sesudahnya pada waktu yang sama: "hapus #b" dijadwalkan di now, jadi sampai lebih dulu.
      await view.rerender(<Host bump={1} />);
      await advance(0);
      await advance(50);
      // Urutannya memang terjadi: ada "hapus" untuk id yang belum terdaftar (dulu melempar di sini).
      expect(count.unknownRemovals()).toBeGreaterThan(0);
      expect(startTimeErrors()).toEqual([]);
      await view.unmount();
      await advance(50);
      expect(startTimeErrors()).toEqual([]);
    } finally {
      // Di Jest "daftar #b" yang terlambat tetap tiba setelah hapusnya: bersihkan supaya tes berikutnya bersih.
      count.dropLeftovers();
      count.restore();
    }
  });
});

/** Panggilan registri UI (dihitung setelah tugas utas UI berjalan) untuk jam yang didaftarkan sejak penghitung dibuat. */
function countRegistry() {
  const r = registry();
  let unknown = 0;
  const original = r.unregisterFrameCallback;
  const register = jest.spyOn(r, 'registerFrameCallback');
  const unregister = jest.spyOn(r, 'unregisterFrameCallback').mockImplementation(function (this: UiRegistry, id) {
    if (!this.frameCallbackRegistry.has(id)) unknown += 1;
    return original.call(this, id);
  });
  const manage = jest.spyOn(r, 'manageStateFrameCallback');
  return {
    /** "Hapus" yang tiba untuk id yang (belum) terdaftar. */
    unknownRemovals: () => unknown,
    /** Lepas jam milik tes ini yang masih terdaftar (sisa urutan terbalik di Jest). */
    dropLeftovers: () => {
      for (const [, id] of register.mock.calls) if (r.frameCallbackRegistry.has(id)) original.call(r, id);
    },
    read: () => ({
      register: register.mock.calls.length,
      unregister: unregister.mock.calls.length,
      on: manage.mock.calls.filter(([, on]) => on).length,
      off: manage.mock.calls.filter(([, on]) => !on).length,
    }),
    /** Jam milik tes ini yang masih menyala di utas UI. */
    active: () => register.mock.calls.filter(([, id]) => r.activeFrameCallbacks.has(id)).length,
    restore: () => [register, unregister, manage].forEach((s) => s.mockRestore()),
  };
}

const RING: WebNode[] = [
  { key: 'gcal', icon: 'calendar', label: 'Google Kalender' },
  { key: 'gmail', icon: 'mail', label: 'Gmail' },
  { key: 'wa', icon: 'chat', label: 'WhatsApp' },
];

describe('jam frame kita: dipasang hanya saat berjalan, tanpa daftar ulang dan tanpa setActive', () => {
  test('WavesSkia: render ulang (onFail baru, keadaan berganti) tidak mendaftar ulang; jeda = lepas, lanjut = pasang', async () => {
    const count = countRegistry();
    try {
      const level = makeMutable(0.3);
      const glow = makeMutable(0);
      const props = { level, glow, width: 393, height: 541 };
      const view = await render(<WavesSkia {...props} state="listening" onFail={() => {}} />);
      await advance(50);
      expect(count.read()).toEqual({ register: 1, unregister: 0, on: 1, off: 0 });
      // Jam benar-benar berjalan: cahaya Inti ikut level mikrofon.
      expect(glow.get()).toBeGreaterThan(0);

      for (const state of ['thinking', 'speaking', 'listening', 'idle'] as const) {
        await view.rerender(<WavesSkia {...props} state={state} onFail={() => {}} quiet={state === 'idle'} />);
        await advance(17);
      }
      expect(count.read()).toEqual({ register: 1, unregister: 0, on: 1, off: 0 });

      await view.rerender(<WavesSkia {...props} state="idle" onFail={() => {}} paused />);
      await advance(17);
      // Jeda: jam dilepas (hapus = satu "mati" di dalam registri), tanpa setActive terpisah.
      expect(count.read()).toEqual({ register: 1, unregister: 1, on: 1, off: 1 });
      const before = glow.get();
      await advance(500);
      expect(glow.get()).toBe(before);

      await view.rerender(<WavesSkia {...props} state="idle" onFail={() => {}} />);
      await advance(17);
      expect(count.read()).toEqual({ register: 2, unregister: 1, on: 2, off: 1 });
      await view.unmount();
      await advance(17);
      expect(count.read()).toEqual({ register: 2, unregister: 2, on: 2, off: 2 });
      expect(count.active()).toBe(0);
      expect(startTimeErrors()).toEqual([]);
    } finally {
      count.restore();
    }
  });

  test('IntiHero: render ulang tidak mendaftar ulang; jeda = lepas, lanjut = pasang; tanpa simpul = tanpa jam', async () => {
    type HeroProps = Parameters<typeof IntiHero>[0];
    const m = heroMetrics(393, 873);
    let update: (p: Partial<HeroProps>) => void = () => {};
    // Penyedia (tema, dll.) tetap terpasang; hanya prop IntiHero yang berganti.
    function Host() {
      const [props, setProps] = useState<HeroProps>({ metrics: m, nodes: RING, paused: false, halo: false });
      update = (p) => setProps((prev) => ({ ...prev, ...p }));
      return <IntiHero {...props} />;
    }
    const count = countRegistry();
    try {
      const view = await renderWithProviders(<Host />);
      await advance(50);
      expect(count.read()).toEqual({ register: 1, unregister: 0, on: 1, off: 0 });
      for (const halo of [true, false, true]) {
        await act(async () => update({ halo, nodes: [...RING] }));
        await advance(17);
      }
      expect(count.read()).toEqual({ register: 1, unregister: 0, on: 1, off: 0 });
      await act(async () => update({ paused: true }));
      await advance(17);
      expect(count.read()).toEqual({ register: 1, unregister: 1, on: 1, off: 1 });
      expect(count.active()).toBe(0);
      await act(async () => update({ paused: false }));
      await advance(17);
      expect(count.read()).toEqual({ register: 2, unregister: 1, on: 2, off: 1 });
      expect(count.active()).toBe(1);
      // Tanpa simpul: tidak ada yang bergerak, jamnya dilepas.
      await act(async () => update({ nodes: [] }));
      await advance(17);
      expect(count.read()).toEqual({ register: 2, unregister: 2, on: 2, off: 2 });
      expect(count.active()).toBe(0);
      await view.unmount();
      await advance(17);
      expect(startTimeErrors()).toEqual([]);
    } finally {
      count.restore();
    }
  });
});
