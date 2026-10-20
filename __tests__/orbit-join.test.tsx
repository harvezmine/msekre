import { render, screen } from '@testing-library/react-native';
import { getAnimatedStyle as animatedStyle } from 'react-native-reanimated';
import * as Reanimated from 'react-native-reanimated';
import { orbitLayout } from '@/ui/orbit/geometry';
import { Orbit } from '@/ui/orbit/Orbit';
import type { OrbitNode } from '@/ui/orbit/types';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  const useReducedMotion = jest.fn(() => false);
  // Proxy, bukan salinan: ekspor reanimated berupa getter (termasuk `default`).
  return new Proxy(actual, { get: (target, key) => (key === 'useReducedMotion' ? useReducedMotion : target[key]) });
});

type AnimatedStyle = { opacity?: number; transform?: Record<string, number>[] };
const getAnimatedStyle = animatedStyle as unknown as (el: unknown) => AnimatedStyle;

const nodes: OrbitNode[] = [
  { key: 'a', icon: 'calendar', label: 'Google Kalender' },
  { key: 'b', icon: 'mail', label: 'Gmail' },
  { key: 'c', icon: 'bag', label: 'TikTok Shop' },
  { key: 'd', icon: 'bank', label: 'Bank' },
];

test('simpul yang bergabung mulai 70 dp ke arah luar, kecil dan tembus pandang', async () => {
  await render(<Orbit nodes={nodes} flowEveryMs={0} joinKey="c" />);
  const s = getAnimatedStyle(screen.getByTestId('simpul-c'));
  const angle = orbitLayout(4).nodes[2]!.angle;
  const t = Object.assign({}, ...(s.transform ?? []));
  expect(s.opacity).toBe(0);
  expect(t.scale).toBeCloseTo(0.4);
  expect(t.translateX).toBeCloseTo(Math.cos(angle) * 70);
  expect(t.translateY).toBeCloseTo(Math.sin(angle) * 70);
  // Simpul lain tidak beranimasi.
  expect(getAnimatedStyle(screen.getByTestId('simpul-a')).transform).toBeUndefined();
});

test('setelah 900 ms simpul sudah di tempatnya', async () => {
  await render(<Orbit nodes={nodes} flowEveryMs={0} joinKey="c" />);
  await jest.advanceTimersByTimeAsync(1000);
  const s = getAnimatedStyle(screen.getByTestId('simpul-c'));
  const t = Object.assign({}, ...(s.transform ?? []));
  expect(s.opacity).toBe(1);
  expect(t.scale).toBeCloseTo(1);
  expect(t.translateX).toBeCloseTo(0);
});

test('gerak dikurangi: simpul langsung di tempatnya', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  await render(<Orbit nodes={nodes} flowEveryMs={0} joinKey="c" />);
  const s = getAnimatedStyle(screen.getByTestId('simpul-c'));
  const t = Object.assign({}, ...(s.transform ?? []));
  expect(s.opacity).toBe(1);
  expect(t.scale).toBeCloseTo(1);
  expect(t.translateX).toBeCloseTo(0);
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
});

test('tanpa joinKey tidak ada simpul yang beranimasi', async () => {
  await render(<Orbit nodes={nodes} flowEveryMs={0} />);
  expect(getAnimatedStyle(screen.getByTestId('simpul-c')).transform).toBeUndefined();
});
