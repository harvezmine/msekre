/**
 * Tiruan ringan `@shopify/react-native-skia` untuk Jest: tes tidak memuat Skia native maupun CanvasKit (wasm).
 * - `Canvas` menjadi View biasa (meneruskan `style`, `testID`, dan anak-anaknya);
 * - komponen gambar lain (Path, Group, Rect, LinearGradient, BlurMask, …) tidak menggambar apa-apa;
 * - `use*` mengembalikan nilai bersama tiruan; `Skia`, `vec`, dan fungsi lain mengembalikan objek tiruan yang bisa
 *   dirangkai (contoh `Skia.Path.Make().moveTo(0, 0)`).
 * Dipasang di jest.setup.ts. Tes yang perlu Skia sungguhan memakai `jest.unmock` dan CanvasKit sendiri.
 */
import { createElement, type ReactNode } from 'react';
import { View } from 'react-native';

type Fn = (...args: unknown[]) => unknown;

/** Objek tiruan: setiap properti dan pemanggilan mengembalikan tiruan lagi. */
function chain(): unknown {
  const target = function () {} as unknown as Fn;
  const proxy: unknown = new Proxy(target, {
    get: (_t, key) => (key === Symbol.toPrimitive ? () => 0 : key === 'then' ? undefined : proxy),
    apply: () => proxy,
  });
  return proxy;
}

function sharedValue(initial: unknown) {
  let v = initial;
  return {
    value: v,
    get: () => v,
    set: (next: unknown) => {
      v = next;
    },
  };
}

export function createSkiaMock() {
  const Canvas = ({ children, ...props }: { children?: ReactNode }) => createElement(View, props, children);
  const Nothing = () => null;
  const named: Record<string, unknown> = {
    __esModule: true,
    Canvas,
    Skia: chain(),
    vec: (x = 0, y = 0) => ({ x, y }),
    rect: (x = 0, y = 0, width = 0, height = 0) => ({ x, y, width, height }),
    useClock: () => sharedValue(0),
    useFont: () => null,
    useImage: () => null,
  };
  return new Proxy(named, {
    get(target, key) {
      if (typeof key !== 'string') return undefined;
      if (key in target) return target[key];
      if (key.startsWith('use')) return () => sharedValue(0);
      if (/^[A-Z]/.test(key)) return Nothing;
      return chain();
    },
  });
}
