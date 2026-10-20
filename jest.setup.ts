import 'react-native-gesture-handler/jestSetup';
import { setUpTests } from 'react-native-reanimated';

setUpTests();

// Memasang pengikat ke runtime UI lewat timer mikro; di Jest worklets menolaknya dan merusak tes yang memajukan timer.
jest.mock('react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings', () => ({
  installUIRuntimeBindings: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// Only provides `router`, a no-op `Redirect`, a `useIsFocused` that is focused by default (a jest.fn: tests that need an unfocused screen use `jest.mocked(useIsFocused).mockReturnValue(false)` and must restore it) and a `useLocalSearchParams` that returns `{}` (tests override it with
// `jest.mocked(useLocalSearchParams).mockReturnValue(...)` and must restore it) for screen/component tests. Tests that need real router components must
// mock per file (do not spread requireActual globally: it makes each test file ~9x slower).
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useIsFocused: jest.fn(() => true),
  useLocalSearchParams: jest.fn(() => ({})),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), dismissTo: jest.fn() },
}));
jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
}));
