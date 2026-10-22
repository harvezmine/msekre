/// <reference types="node" />
/**
 * Worklet di utas UI, tanpa HP. Jest biasanya menjalankan worklet sebagai fungsi JavaScript biasa, jadi kesalahan yang
 * hanya muncul di utas UI tidak terlihat. Di sini worklet dijalankan seperti di HP: teks kodenya (`__initData.code`,
 * hasil plugin worklets) dievaluasi di ranah JavaScript baru yang hanya punya bawaan standar, isi penutupnya dipasang di
 * `this.__closure`, dan fungsi biasa (bukan worklet) di penutup diganti tiruan yang melempar, seperti di utas UI.
 *
 * Latar: APK 1.0.0 (4) tertutup paksa saat Inti ditahan. `approach(a, b, dt)` (tanpa argumen keempat) memakai nilai
 * bawaan parameter `ms = WAVE_CROSSFADE_MS`; di utas UI nilai bawaan dihitung sebelum `this.__closure` dibuka, jadi
 * setiap frame melempar ReferenceError, dan di build rilis kesalahan worklet membatalkan proses.
 */
import { render } from '@testing-library/react-native';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { isSharedValue, makeMutable } from 'react-native-reanimated';
import { renderWithProviders } from './helpers';
import { heroMetrics, type WebNode } from '@/ui/beranda/heroLayout';
import { IntiHero } from '@/ui/beranda/IntiHero';
import * as webMath from '@/ui/beranda/webMath';
import * as dial from '@/ui/kit/dialGeometry';
import * as slider from '@/ui/kit/sliderMath';
import * as sheet from '@/ui/sheetMath';
import * as waveMath from '@/voice/waveMath';
import { WAVE_LAYERS, WAVE_POINTS } from '@/voice/waveMath';
import { WavesSkia } from '@/voice/WavesSkia';

type Fn = (...args: never[]) => unknown;
interface Worklet {
  (...args: never[]): unknown;
  __workletHash?: number;
  __initData?: { code: string };
  __closure?: unknown;
}

/** Worklet yang dipakai `WavesSkia` dan jaring Inti, ditangkap dari kait Reanimated dan Skia saat menggambar. */
const mockCaptured = {
  frame: [] as Worklet[],
  derived: [] as Worklet[],
  path: [] as Worklet[],
  style: [] as Worklet[],
};

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return new Proxy(actual, {
    get(target, key) {
      if (key === 'useFrameCallback') {
        return (cb: Worklet, auto?: boolean) => {
          mockCaptured.frame.push(cb);
          return target.useFrameCallback(cb, auto);
        };
      }
      if (key === 'useDerivedValue') {
        return (cb: Worklet, deps?: unknown[]) => {
          mockCaptured.derived.push(cb);
          return target.useDerivedValue(cb, deps);
        };
      }
      if (key === 'useAnimatedStyle') {
        return (cb: Worklet, deps?: unknown[]) => {
          mockCaptured.style.push(cb);
          return target.useAnimatedStyle(cb, deps);
        };
      }
      return target[key];
    },
  });
});

jest.mock('@shopify/react-native-skia', () => {
  const base = jest.requireActual('./skiaMock').createSkiaMock();
  return new Proxy(base, {
    get(target, key) {
      if (key === 'usePathValue') {
        return (cb: Worklet) => {
          mockCaptured.path.push(cb);
          return { value: null, get: () => null, set: () => {} };
        };
      }
      return target[key];
    },
  });
});

// ---- Runtime UI tiruan ----

const uiRealm = createContext({ console, _WORKLET: true });

function isWorklet(fn: unknown): fn is Worklet & { __initData: { code: string } } {
  return typeof fn === 'function' && typeof (fn as Worklet).__workletHash === 'number' && !!(fn as Worklet).__initData;
}

/** Nilai penutup seperti yang diterima utas UI. */
function toUi(value: unknown, name: string): unknown {
  if (typeof value === 'function') {
    if (isWorklet(value)) return onUi(value, name);
    return () => {
      throw new Error(
        `[utas UI] fungsi biasa "${name}" dipanggil langsung di worklet (harus worklet atau scheduleOnRN)`,
      );
    };
  }
  if (value === null || typeof value !== 'object' || isSharedValue(value)) return value;
  if (Array.isArray(value)) return value.map((v, i) => toUi(v, `${name}[${i}]`));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toUi(v, `${name}.${k}`)]));
}

/** Worklet seperti di utas UI: teks kodenya dievaluasi di ranah baru, penutupnya di `this.__closure`. */
function onUi<F extends Fn>(fn: F, name = fn.name || 'worklet'): F {
  if (!isWorklet(fn)) throw new Error(`"${name}" bukan worklet (tanpa 'worklet' atau tidak diolah plugin worklets)`);
  const compiled = runInContext(fn.__initData.code, uiRealm) as (...args: unknown[]) => unknown;
  const closure = toUi(fn.__closure ?? [], `${name}.__closure`);
  return ((...args: unknown[]) => compiled.apply({ __closure: closure }, args)) as unknown as F;
}

/** Daftar parameter dari teks kode worklet, `(function nama(a,b,c){`. */
function paramsOf(code: string): string {
  return /^\(function\s*[\w$]*\s*\(([^)]*)\)/.exec(code)?.[1] ?? '';
}

const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Pembangun jalur tiruan: mencatat setiap titik. */
function recordingBuilder() {
  const points: [number, number][] = [];
  return {
    points,
    builder: {
      moveTo: (x: number, y: number) => void points.push([x, y]),
      lineTo: (x: number, y: number) => void points.push([x, y]),
      close: () => {},
    },
  };
}

beforeEach(() => {
  mockCaptured.frame = [];
  mockCaptured.derived = [];
  mockCaptured.path = [];
  mockCaptured.style = [];
});

describe('worklet di utas UI (runtime UI tiruan)', () => {
  test('setiap fungsi hitungan gelombang adalah worklet, tanpa nilai bawaan parameter', () => {
    const fns = Object.entries(waveMath).filter(([, v]) => typeof v === 'function');
    expect(fns.length).toBeGreaterThan(10);
    for (const [name, fn] of fns) {
      expect([name, isWorklet(fn)]).toEqual([name, true]);
      expect([name, paramsOf((fn as Worklet).__initData!.code)]).not.toEqual([name, expect.stringContaining('=')]);
    }
    // Pembantu worklet lain yang dipakai gerak di utas UI: aturan yang sama.
    for (const mod of [dial, slider, sheet]) {
      for (const [name, fn] of Object.entries(mod)) {
        if (!isWorklet(fn)) continue;
        expect([name, paramsOf(fn.__initData.code)]).not.toEqual([name, expect.stringContaining('=')]);
      }
    }
  });

  test('hitungan gelombang berjalan di utas UI; approach tanpa argumen keempat (bentuk jam frame) tidak melempar', () => {
    const ui = {
      approach: onUi(waveMath.approach),
      waveY: onUi(waveMath.waveY),
      targetLevel: onUi(waveMath.targetLevel),
      smoothLevel: onUi(waveMath.smoothLevel),
      bandBottom: onUi(waveMath.bandBottom),
      frameSeconds: onUi(waveMath.frameSeconds),
    };
    // Penyebab APK 1.0.0 (4) tertutup: ReferenceError "WAVE_CROSSFADE_MS" di sini.
    expect(ui.approach(0, 1, 1 / 60)).toBeCloseTo(waveMath.approach(0, 1, 1 / 60), 9);
    expect(ui.approach(0, 1, 1 / 60, 600)).toBeCloseTo(waveMath.approach(0, 1, 1 / 60, 600), 9);
    const layer = WAVE_LAYERS[2]!;
    expect(ui.waveY(layer, 0.3, 2, 0.7, 500)).toBeCloseTo(waveMath.waveY(layer, 0.3, 2, 0.7, 500), 9);
    expect(ui.targetLevel('speaking', 3.1, 0, false)).toBeCloseTo(waveMath.targetLevel('speaking', 3.1, 0, false), 9);
    expect(ui.smoothLevel(0.2, 0.9, 1 / 60)).toBeCloseTo(waveMath.smoothLevel(0.2, 0.9, 1 / 60), 9);
    expect(ui.bandBottom(layer, 1, 500)).toBeLessThanOrEqual(500);
    expect(ui.frameSeconds(null)).toBeCloseTo(0.016, 6);
  });

  test('jam frame, jalur, dan nilai turunan WavesSkia berjalan di utas UI tanpa melempar; semua angka terhingga', async () => {
    const level = makeMutable(0.6);
    const glow = makeMutable(0);
    await render(<WavesSkia state="listening" level={level} width={393} height={541} glow={glow} />);
    expect(mockCaptured.frame.length).toBeGreaterThan(0);
    expect(mockCaptured.path.length).toBe(WAVE_LAYERS.length + 1);

    const frame = onUi(mockCaptured.frame.at(-1)!, 'jam frame');
    let at = 0;
    for (let i = 0; i < 180; i++) {
      at += 16.7;
      frame({ timestamp: at, timeSincePreviousFrame: i === 0 ? null : 16.7, timeSinceFirstFrame: at } as never);
    }
    expect(finite(glow.get())).toBe(true);
    expect(glow.get()).toBeGreaterThan(0.4);
    expect(glow.get()).toBeLessThanOrEqual(1);

    for (const [i, cb] of mockCaptured.path.entries()) {
      const { points, builder } = recordingBuilder();
      onUi(cb, `jalur ${i}`)(builder as never);
      expect(points.length).toBeGreaterThanOrEqual(WAVE_POINTS + 1);
      for (const [x, y] of points) expect([finite(x), finite(y)]).toEqual([true, true]);
    }
    for (const [i, cb] of mockCaptured.derived.entries()) {
      const out = onUi(cb, `nilai turunan ${i}`)();
      const values = typeof out === 'object' && out ? Object.values(out) : [out];
      for (const v of values) expect(finite(v)).toBe(true);
    }
  });

  test('nilai rusak (NaN, tak hingga, jeda negatif) tidak sampai ke Skia dan tidak menghentikan jam frame', async () => {
    const level = makeMutable(Number.NaN);
    const glow = makeMutable(0);
    const onFail = jest.fn();
    await render(<WavesSkia state="listening" level={level} width={393} height={541} glow={glow} onFail={onFail} />);
    const frame = onUi(mockCaptured.frame.at(-1)!, 'jam frame');
    for (const gap of [Number.NaN, Infinity, -40, 1e9, 16]) {
      frame({ timestamp: 0, timeSincePreviousFrame: gap, timeSinceFirstFrame: 0 } as never);
      expect(finite(glow.get())).toBe(true);
    }
    level.set(Infinity);
    frame({ timestamp: 0, timeSincePreviousFrame: 16, timeSinceFirstFrame: 0 } as never);
    expect(glow.get()).toBeGreaterThanOrEqual(0);
    expect(glow.get()).toBeLessThanOrEqual(1);
    for (const cb of mockCaptured.path) {
      const { points, builder } = recordingBuilder();
      onUi(cb)(builder as never);
      for (const [x, y] of points) expect([finite(x), finite(y)]).toEqual([true, true]);
    }
    expect(onFail).not.toHaveBeenCalled();
  });
});

/** Semua angka di gaya hasil worklet (termasuk "12deg"), untuk memeriksa NaN dan tak hingga. */
function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(value);
  else if (typeof value === 'string' && /^-?[\d.e+-]+(deg|rad)?$/i.test(value)) out.push(Number.parseFloat(value));
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => numbersIn(v, out));
  return out;
}

const RING: WebNode[] = [
  { key: 'gcal', icon: 'calendar', label: 'Google Kalender' },
  { key: 'gmail', icon: 'mail', label: 'Gmail' },
  { key: 'wa', icon: 'chat', label: 'WhatsApp' },
  { key: 'ac', icon: 'snow', label: 'AC kamar' },
  { key: 'cctv', icon: 'camera', label: 'CCTV', offline: true },
  { key: 'kasir', icon: 'receipt', label: 'Kasir Kopi Rindang' },
  { key: 'bank', icon: 'bank', label: 'Bank' },
];

describe('jaring Inti Beranda di utas UI (runtime UI tiruan)', () => {
  test('setiap fungsi webMath adalah worklet, tanpa nilai bawaan parameter', () => {
    const fns = Object.entries(webMath).filter(([, v]) => typeof v === 'function');
    expect(fns.length).toBeGreaterThanOrEqual(8);
    for (const [name, fn] of fns) {
      expect([name, isWorklet(fn)]).toEqual([name, true]);
      expect([name, paramsOf((fn as Worklet).__initData!.code)]).not.toEqual([name, expect.stringContaining('=')]);
    }
  });

  test('jam, melayang, dan jadwal titik cahaya berjalan di utas UI; masukan rusak tidak menghasilkan NaN', () => {
    const ui = {
      advanceClock: onUi(webMath.advanceClock),
      drift: onUi(webMath.drift),
      easeInOut: onUi(webMath.easeInOut),
      pulseIndex: onUi(webMath.pulseIndex),
      pulseAge: onUi(webMath.pulseAge),
      pulseAlpha: onUi(webMath.pulseAlpha),
      pulseTarget: onUi(webMath.pulseTarget),
      at: onUi(webMath.at),
    };
    const LOOP = webMath.WEB_LOOP;
    expect(ui.advanceClock(0, null, LOOP)).toBeCloseTo(0.016, 6);
    expect(ui.advanceClock(1, 16, LOOP)).toBeCloseTo(1.016, 6);
    // Frame pertama setelah jeda panjang: paling banyak 50 ms; jeda rusak: jam diam.
    expect(ui.advanceClock(1, 5000, LOOP)).toBeCloseTo(1.05, 6);
    for (const gap of [Number.NaN, -40, Infinity]) expect(finite(ui.advanceClock(1, gap, LOOP))).toBe(true);
    expect(ui.advanceClock(Number.NaN, 16, LOOP)).toBeCloseTo(0.016, 6);
    // Berputar mulus di ujung putaran.
    expect(ui.advanceClock(LOOP - 0.01, 16, LOOP)).toBeCloseTo(0.006, 6);
    expect(ui.advanceClock(5, 16, Number.NaN)).toBeCloseTo(5.016, 6);
    // Semua periode membagi putaran: melayang di awal dan di akhir putaran sama.
    for (let i = 0; i < 7; i++) {
      for (const axis of [0, 1]) {
        expect(ui.drift(0, i, axis, 2.5)).toBeCloseTo(ui.drift(LOOP, i, axis, 2.5), 6);
        expect(Math.abs(ui.drift(13.7, i, axis, 2.5))).toBeLessThanOrEqual(2.5);
      }
    }
    for (const bad of [Number.NaN, Infinity, -1]) {
      expect(finite(ui.drift(bad, bad, 1, bad))).toBe(true);
      expect(finite(ui.easeInOut(bad))).toBe(true);
      expect(ui.pulseAlpha(bad)).toBe(0);
    }
    expect(ui.easeInOut(0)).toBe(0);
    expect(ui.easeInOut(1)).toBe(1);
    expect(ui.pulseAlpha(0.5)).toBe(1);
    expect(ui.pulseIndex(1, 5, 2.5)).toBe(-1);
    expect(ui.pulseIndex(12, 5, 0)).toBe(2);
    expect(ui.pulseIndex(3, 0, 0)).toBe(-1);
    expect(ui.pulseAge(12, 5, 0)).toBeCloseTo(2, 6);
    expect(ui.pulseAge(1, 8, 2.5)).toBe(-1);
    expect(ui.pulseTarget([2, 0, 1], 4, false)).toBe(0);
    expect(ui.pulseTarget([2, 0, 1], 4, true)).toBe(0);
    expect(ui.pulseTarget([2, 0, 1], 0, true)).toBe(1);
    expect(ui.pulseTarget([], 3, false)).toBe(-1);
    expect(ui.pulseTarget([1], -1, false)).toBe(-1);
    expect(ui.at([1, 2], 5, 9)).toBe(9);
    expect(ui.at([1, Number.NaN], 1, 7)).toBe(7);
    expect(ui.at([1, 2], -1, 7)).toBe(7);
  });

  test('jam frame dan gaya jaring (simpul, titik cahaya, denyut) berjalan di utas UI selama dua putaran titik cahaya', async () => {
    await renderWithProviders(<IntiHero metrics={heroMetrics(393, 873)} nodes={RING} paused={false} halo={false} />);
    expect(mockCaptured.frame.length).toBeGreaterThan(0);
    // Simpul (7) + dua jalur titik cahaya (kepala, dan denyut di jalur keluar) + gaya Inti sendiri.
    expect(mockCaptured.style.length).toBeGreaterThanOrEqual(RING.length + 3);
    const frame = onUi(mockCaptured.frame.at(-1)!, 'jam jaring');
    const styles = mockCaptured.style.map((cb, i) => onUi(cb, `gaya ${i}`));
    const seen = { comet: 0, ping: 0 };
    for (let i = 0; i < 1200; i++) {
      const gap = i === 0 ? null : i % 97 === 0 ? Number.NaN : 16.7;
      frame({ timestamp: i * 16.7, timeSincePreviousFrame: gap, timeSinceFirstFrame: i * 16.7 } as never);
      if (i % 10 !== 0) continue;
      for (const [j, style] of styles.entries()) {
        const out = style() as { opacity?: number };
        for (const n of numbersIn(out)) expect([`gaya ${j}`, finite(n)]).toEqual([`gaya ${j}`, true]);
        if (typeof out.opacity === 'number') {
          expect(out.opacity).toBeGreaterThanOrEqual(0);
          expect(out.opacity).toBeLessThanOrEqual(1);
        }
        const transform = (out as { transform?: Record<string, unknown>[] }).transform ?? [];
        if ((out.opacity ?? 0) > 0.3 && transform.some((x) => 'rotate' in x)) seen.comet += 1;
        // Denyut: digeser ke simpul lalu membesar (cahaya Inti hanya membesar, tanpa geser).
        const moved = transform.some((x) => 'translateX' in x);
        if ((out.opacity ?? 0) > 0.1 && moved && transform.some((x) => 'scale' in x && x.scale !== 1)) seen.ping += 1;
      }
    }
    // Dalam 20 detik titik cahaya benar-benar terlihat berjalan, dan simpul tujuannya berdenyut.
    expect(seen.comet).toBeGreaterThan(0);
    expect(seen.ping).toBeGreaterThan(0);
  });
});

// ---- Pemeriksa seluruh aplikasi ----

const ROOT = join(__dirname, '..');
const WORKLET_HINT =
  /'worklet'|useAnimatedStyle|useAnimatedProps|useDerivedValue|useFrameCallback|usePathValue|useAnimatedReaction|useAnimatedScrollHandler/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.web\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [full] : [];
  });
}

const WORKLET_FILES = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'src'))].filter((f) =>
  WORKLET_HINT.test(readFileSync(f, 'utf8')),
);

/** Nama yang ada di runtime UI tanpa penutup. */
const UI_GLOBALS = new Set([
  'Math', 'Number', 'String', 'Boolean', 'Object', 'Array', 'JSON', 'Infinity', 'NaN', 'undefined', 'isNaN', 'isFinite',
  'parseInt', 'parseFloat', 'Error', 'TypeError', 'Date', 'console', 'globalThis', 'global', 'Symbol', 'Map', 'Set',
  'WeakMap', 'RegExp', 'Promise', 'ArrayBuffer', 'Float32Array', 'Float64Array', 'Int16Array', 'Uint8Array', 'arguments',
  'performance', 'requestAnimationFrame', 'queueMicrotask', '_WORKLET', '__DEV__', '_log', '_getAnimationTimestamp',
]); // prettier-ignore

/* eslint-disable @typescript-eslint/no-require-imports */
const babel = require('@babel/core') as typeof import('@babel/core');
const { parse } = require('@babel/parser') as typeof import('@babel/parser');
const traverse = (require('@babel/traverse') as { default: typeof import('@babel/traverse').default }).default;
/* eslint-enable @typescript-eslint/no-require-imports */

/** Kode rilis Android (Metro, Hermes, React Compiler), seperti build EAS. */
function compileForRelease(file: string): string {
  const out = babel.transformFileSync(file, {
    cwd: ROOT,
    root: ROOT,
    babelrc: false,
    configFile: false,
    presets: [require.resolve('babel-preset-expo')],
    caller: {
      name: 'metro',
      bundler: 'metro',
      platform: 'android',
      isDev: false,
      isServer: false,
      engine: 'hermes',
      supportsStaticESM: false,
      supportsReactCompiler: true,
    } as never,
  });
  return out?.code ?? '';
}

describe('pemeriksa worklet seluruh aplikasi', () => {
  test('setiap worklet hasil kompilasi rilis hanya memakai nama yang ada di utas UI (tanpa nilai bawaan dari luar)', () => {
    expect(WORKLET_FILES.length).toBeGreaterThan(15);
    const problems: string[] = [];
    let total = 0;
    for (const file of WORKLET_FILES) {
      const code = compileForRelease(file);
      for (const m of code.matchAll(/_init_data=\{code:("(?:[^"\\]|\\.)*")/g)) {
        total += 1;
        const workletCode = JSON.parse(m[1]!) as string;
        const ast = parse(workletCode);
        traverse(ast, {
          FunctionExpression(fp) {
            fp.stop();
            const fname = fp.node.id?.name ?? '?';
            const where = `${relative(ROOT, file)} ${fname}`;
            const closure = new Set<string>();
            const first = fp.node.body.body[0];
            if (
              first?.type === 'VariableDeclaration' &&
              workletCode.slice(first.start!, first.end!).includes('__closure')
            ) {
              const id = first.declarations[0]!.id;
              if (id.type === 'ArrayPattern')
                for (const el of id.elements) if (el?.type === 'Identifier') closure.add(el.name);
              if (id.type === 'ObjectPattern') {
                for (const p of id.properties)
                  if (p.type === 'ObjectProperty' && p.value.type === 'Identifier') closure.add(p.value.name);
              }
            }
            for (const pp of fp.get('params')) {
              pp.traverse({
                Identifier(ip) {
                  if (!ip.isReferencedIdentifier() || UI_GLOBALS.has(ip.node.name)) return;
                  if (closure.has(ip.node.name) || !ip.scope.hasBinding(ip.node.name)) {
                    problems.push(`${where}: nilai bawaan parameter memakai "${ip.node.name}" (belum ada di utas UI)`);
                  }
                },
              });
            }
            fp.traverse({
              Identifier(ip) {
                if (!ip.isReferencedIdentifier()) return;
                const n = ip.node.name;
                if (!ip.scope.hasBinding(n) && !UI_GLOBALS.has(n))
                  problems.push(`${where}: nama "${n}" tidak ada di utas UI`);
              },
            });
          },
        });
      }
    }
    expect(total).toBeGreaterThan(50);
    expect(problems).toEqual([]);
  }, 120_000);

  test('fungsi yang dipanggil langsung di dalam worklet juga worklet (atau API worklet Reanimated/worklets)', () => {
    const ROOT_HOOKS = new Set([
      'useAnimatedStyle',
      'useAnimatedProps',
      'useDerivedValue',
      'useFrameCallback',
      'useAnimatedReaction',
      'useAnimatedScrollHandler',
    ]);
    const PACKAGE_WORKLETS: Record<string, Set<string>> = {
      'react-native-reanimated': new Set([
        'withTiming', 'withSpring', 'withDecay', 'withRepeat', 'withSequence', 'withDelay', 'withClamp', 'interpolate',
        'interpolateColor', 'clamp', 'cancelAnimation', 'measure', 'scrollTo', 'isSharedValue',
      ]), // prettier-ignore
      'react-native-worklets': new Set(['scheduleOnRN', 'scheduleOnUI', 'runOnJS', 'runOnUI']),
    };
    const GLOBAL_CALLS = new Set(['String', 'Number', 'Boolean', 'isNaN', 'isFinite', 'parseInt', 'parseFloat']);
    type Ast = ReturnType<typeof parse>;
    const parsed = new Map<string, Ast>();
    const parseFile = (file: string): Ast => {
      let ast = parsed.get(file);
      if (!ast) {
        ast = parse(readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
        parsed.set(file, ast);
      }
      return ast;
    };
    const hasDirective = (node: { body?: unknown }) => {
      const body = node.body as { type?: string; directives?: { value: { value: string } }[] } | undefined;
      return body?.type === 'BlockStatement' && !!body.directives?.some((d) => d.value.value === 'worklet');
    };
    const resolveModule = (from: string, spec: string): string | null => {
      const base = spec.startsWith('@/') ? join(ROOT, 'src', spec.slice(2)) : join(dirname(from), spec);
      for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        try {
          if (statSync(base + ext).isFile()) return base + ext;
        } catch {
          // Coba akhiran berikutnya.
        }
      }
      return null;
    };
    /** Apakah `name` yang diekspor `file` sebuah worklet (fungsi dengan 'worklet', diikuti lewat ekspor ulang)? */
    const exportsWorklet = (file: string, name: string, depth = 0): boolean => {
      if (depth > 5) return false;
      let found = false;
      traverse(parseFile(file), {
        ExportNamedDeclaration(ep) {
          const d = ep.node.declaration;
          if (d?.type === 'FunctionDeclaration' && d.id?.name === name) found = hasDirective(d);
          if (d?.type === 'VariableDeclaration') {
            for (const v of d.declarations) {
              if (v.id.type === 'Identifier' && v.id.name === name && v.init && 'body' in v.init)
                found = hasDirective(v.init);
            }
          }
          if (ep.node.source) {
            for (const s of ep.node.specifiers) {
              if (s.type === 'ExportSpecifier' && (s.exported.type === 'Identifier' ? s.exported.name : '') === name) {
                const target = resolveModule(file, ep.node.source.value);
                found = !!target && exportsWorklet(target, s.local.name, depth + 1);
              }
            }
          }
        },
      });
      return found;
    };

    const problems: string[] = [];
    for (const file of WORKLET_FILES) {
      const where = relative(ROOT, file);
      traverse(parseFile(file), {
        Function(fp) {
          const parent = fp.parentPath;
          const hookArg =
            parent.isCallExpression() &&
            parent.node.callee.type === 'Identifier' &&
            ROOT_HOOKS.has(parent.node.callee.name) &&
            parent.node.arguments.includes(fp.node as never);
          if (!hookArg && !hasDirective(fp.node)) return;
          const rootScope = fp.scope;
          fp.traverse({
            CallExpression(cp) {
              const callee = cp.node.callee;
              if (callee.type !== 'Identifier') return;
              const binding = cp.scope.getBinding(callee.name);
              if (!binding) {
                if (!GLOBAL_CALLS.has(callee.name)) problems.push(`${where}: "${callee.name}()" tidak ada di utas UI`);
                return;
              }
              for (let s: typeof rootScope | undefined = binding.scope; s; s = s.parent) if (s === rootScope) return;
              const line = cp.node.loc?.start.line;
              if (binding.kind === 'module') {
                const decl = binding.path.parentPath?.node;
                const spec = binding.path.node;
                if (decl?.type !== 'ImportDeclaration' || spec.type !== 'ImportSpecifier') {
                  problems.push(`${where}:${line} "${callee.name}()" diimpor tanpa nama`);
                  return;
                }
                const imported = spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value;
                const source = decl.source.value;
                if (PACKAGE_WORKLETS[source]?.has(imported)) return;
                const target = source.startsWith('.') || source.startsWith('@/') ? resolveModule(file, source) : null;
                if (!target || !exportsWorklet(target, imported)) {
                  problems.push(`${where}:${line} "${callee.name}()" dari ${source} bukan worklet`);
                }
                return;
              }
              const node = binding.path.node;
              const fnNode =
                node.type === 'FunctionDeclaration'
                  ? node
                  : node.type === 'VariableDeclarator' && node.init && 'body' in node.init
                    ? node.init
                    : null;
              if (!fnNode || !hasDirective(fnNode)) {
                problems.push(`${where}:${line} "${callee.name}()" dipanggil di worklet tetapi bukan worklet`);
              }
            },
          });
        },
      });
    }
    expect(problems).toEqual([]);
  });
});
