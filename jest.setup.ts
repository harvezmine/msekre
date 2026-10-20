import 'react-native-gesture-handler/jestSetup';
import { setUpTests } from 'react-native-reanimated';

setUpTests();

// Memasang pengikat ke runtime UI lewat timer mikro; di Jest worklets menolaknya dan merusak tes yang memajukan timer.
jest.mock('react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings', () => ({
  installUIRuntimeBindings: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// Only provides `router`, a no-op `Redirect`, a `useIsFocused` that is focused by default (a jest.fn: tests that need an unfocused screen use `jest.mocked(useIsFocused).mockReturnValue(false)` and must restore it) and a `usePathname` that returns '/' (tests of the sign-in gate override it and must restore it) and a `useLocalSearchParams` that returns `{}` (tests override it with
// `jest.mocked(useLocalSearchParams).mockReturnValue(...)` and must restore it) for screen/component tests. Tests that need real router components must
// mock per file (do not spread requireActual globally: it makes each test file ~9x slower).
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useIsFocused: jest.fn(() => true),
  usePathname: jest.fn(() => '/'),
  useLocalSearchParams: jest.fn(() => ({})),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    dismissTo: jest.fn(),
    dismissAll: jest.fn(),
  },
}));
jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
}));
// Notifikasi tanpa modul native: semuanya tiruan yang tidak berbuat apa-apa (tes notifikasi mengaturnya sendiri).
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 6, DEFAULT: 5 },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false, status: 'undetermined', canAskAgain: true })),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: false, status: 'undetermined', canAskAgain: true }),
  ),
  getDevicePushTokenAsync: jest.fn(() => Promise.resolve({ type: 'android', data: 'token-1' })),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  useLastNotificationResponse: jest.fn(() => null),
}));
