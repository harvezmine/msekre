import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { getAnimatedStyle as animatedStyle } from 'react-native-reanimated';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { BigNumber, Enter, PressableScale, RemoteKey } from '@/ui/kit';

// "Kurangi gerakan" dari HP: tiruan yang bisa diatur per tes (pola yang sama dengan launch-splash.test).
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  const useReducedMotion = jest.fn(() => true);
  return new Proxy(actual, { get: (target, key) => (key === 'useReducedMotion' ? useReducedMotion : target[key]) });
});

type AnimatedStyle = { opacity?: number; transform?: Record<string, number>[] };
const getAnimatedStyle = animatedStyle as unknown as (el: unknown) => AnimatedStyle;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
});

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

test('kurangi gerakan: isi langsung tampil tanpa naik-memudar', async () => {
  await render(
    <Enter index={4} testID="masuk">
      <Text>Isi</Text>
    </Enter>,
  );
  expect(getAnimatedStyle(screen.getByTestId('masuk')).opacity).toBe(1);
  expect(getAnimatedStyle(screen.getByTestId('masuk')).transform?.[0]?.translateY).toBe(0);
});

test('kurangi gerakan: tombol tidak mengecil, getar tetap', async () => {
  await render(
    <ThemeProvider>
      <PressableScale accessibilityRole="button" accessibilityLabel="Kirim" haptic="success" onPress={() => {}}>
        <Text>Kirim</Text>
      </PressableScale>
      <RemoteKey label="Daya" icon="power" variant="power" on />
    </ThemeProvider>,
  );
  const btn = screen.getByRole('button', { name: 'Kirim' });
  await fireEvent(btn, 'pressIn');
  await advance(600);
  expect(getAnimatedStyle(btn).transform?.[0]?.scale).toBe(1);
  await fireEvent.press(btn);
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  await fireEvent(screen.getByRole('switch', { name: 'Daya' }), 'pressIn');
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
});

test('kurangi gerakan: angka besar langsung berganti', async () => {
  function Demo() {
    const [v, setV] = useState(80);
    return (
      <ThemeProvider>
        <BigNumber value={v} unit="%" />
        <Text onPress={() => setV(60)}>redup</Text>
      </ThemeProvider>
    );
  }
  await render(<Demo />);
  await fireEvent.press(screen.getByText('redup'));
  expect(getAnimatedStyle(screen.getByText('60')).opacity).toBe(1);
});
