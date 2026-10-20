import { setUpTests } from 'react-native-reanimated';

setUpTests();

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// Only provides `router`, a no-op `Redirect` and an always-focused `useIsFocused` for screen/component tests. Tests that need real router components must
// mock per file (do not spread requireActual globally: it makes each test file ~9x slower).
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useIsFocused: () => true,
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() },
}));
jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
}));
