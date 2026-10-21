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
    canGoBack: jest.fn(() => true),
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
  AndroidNotificationVisibility: { PUBLIC: 1, PRIVATE: 2, SECRET: 3 },
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
  clearLastNotificationResponse: jest.fn(),
}));
// Berkas, pembuka, dan lembar bagikan tanpa modul native: tiruan di memori (tes dokumen mengatur hasilnya sendiri).
jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
    }
    create = jest.fn();
    exists = true;
    /** Folder yang dibuang (`delete`), dari yang pertama. */
    static deleted: string[] = [];
    delete() {
      Directory.deleted.push(this.uri);
    }
  }
  class File {
    uri: string;
    /** Berkas yang "sudah ada di HP": alamat -> ukuran (byte). Tes mengisinya sendiri. */
    static existing = new Map<string, number>();
    get exists() {
      return File.existing.has(this.uri);
    }
    get size() {
      return File.existing.get(this.uri) ?? 0;
    }
    constructor(...parts: unknown[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
    }
    create = jest.fn();
    write = jest.fn(() => Promise.resolve());
    /** Isi yang ditulis lewat `writeSync`, dari yang pertama. */
    static writes: { uri: string; content: unknown; options: unknown }[] = [];
    writeSync = jest.fn((content: unknown, options: unknown) => {
      File.writes.push({ uri: this.uri, content, options });
    });
    /** Berkas yang dibuang (`delete`), dari yang pertama. */
    static deleted: string[] = [];
    delete() {
      File.deleted.push(this.uri);
    }
    static downloadFileAsync = jest.fn((_url: string, destination: { uri: string }) =>
      Promise.resolve(new File(destination.uri)),
    );
  }
  return { Directory, File, Paths: { cache: new Directory('file:///cache') } };
});
jest.mock('expo-file-system/legacy', () => ({
  getContentUriAsync: jest.fn((uri: string) => Promise.resolve(uri.replace('file://', 'content://'))),
}));
jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn(() => Promise.resolve({ resultCode: -1 })) }));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

// Mikrofon, pemutar, dan layar menyala tanpa modul native. Keadaannya ada di `__audio` (lihat __tests__/audioMock.ts):
// tes memberi potongan suara mikrofon, menyelesaikan pemutaran, dan mengatur izin.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-audio', () => require('./__tests__/expoAudioMock').createExpoAudioMock());
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
