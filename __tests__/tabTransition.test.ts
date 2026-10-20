import { Animated } from 'react-native';
import { tabSceneInterpolator, tabTransitionSpec } from '@/ui/tabTransition';

type Node = { __getValue(): number };

function at(progress: number) {
  const { sceneStyle } = tabSceneInterpolator({ current: { progress: new Animated.Value(progress) } });
  const style = sceneStyle as unknown as { opacity: Node; transform: { translateX: Node }[] };
  return { opacity: style.opacity.__getValue(), x: style.transform[0]!.translateX.__getValue() };
}

test('layar aktif utuh, layar yang pergi memudar dan bergeser 8 dp', () => {
  expect(at(0)).toEqual({ opacity: 1, x: 0 });
  expect(at(-1)).toEqual({ opacity: 0, x: -8 });
  expect(at(1)).toEqual({ opacity: 0, x: 8 });
  expect(at(0.5).opacity).toBeCloseTo(0.5);
  expect(at(0.5).x).toBeCloseTo(4);
});

test('durasi 220 ms', () => {
  expect(tabTransitionSpec).toMatchObject({ animation: 'timing', config: { duration: 220 } });
});
