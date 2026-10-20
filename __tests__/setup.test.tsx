import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { render, screen } from '@testing-library/react-native';

function Probe() {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View testID="kotak">
      <Svg width={10} height={10} testID="svg">
        <Circle cx={5} cy={5} r={4} />
      </Svg>
      <Text>{`atas ${insets.top}`}</Text>
      <View />
    </Animated.View>
  );
}

test('lingkungan tes siap: reanimated, svg, safe area, dan mock berjalan', async () => {
  await render(<Probe />);
  expect(screen.getByTestId('kotak')).toBeTruthy();
  expect(screen.getByTestId('svg')).toBeTruthy();
  expect(screen.getByText(/^atas \d+$/)).toBeTruthy();
  expect(jest.isMockFunction(router.push)).toBe(true);
  expect(jest.isMockFunction(Haptics.impactAsync)).toBe(true);
});
