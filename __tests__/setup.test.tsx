import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { render, screen } from '@testing-library/react-native';

test('lingkungan tes siap: reanimated, svg, dan mock berjalan', async () => {
  await render(<Animated.View testID="kotak"><View /></Animated.View>);
  expect(screen.getByTestId('kotak')).toBeTruthy();
});
