/**
 * Tiruan `expo-notifications` untuk Jest, dipasang di jest.setup.ts. Semua fungsi `jest.fn`; notifikasi terjadwal, yang
 * tampil, saluran, dan kategori disimpan di memori (`__mock`), supaya tes pengingat bisa memeriksa dan "membunyikan"
 * notifikasi. Tes lain yang mengatur jawaban sendiri (`mockResolvedValue`) tetap bisa.
 */

interface Request {
  identifier: string;
  content: { title?: string | null; body?: string | null; data?: Record<string, unknown>; [k: string]: unknown };
  trigger: Record<string, unknown> | null;
}

export interface NotificationsMockState {
  scheduled: Map<string, Request>;
  presented: Map<string, { date: number; request: Request }>;
  channels: Map<string, Record<string, unknown>>;
  categories: Map<string, { identifier: string; actions: unknown[]; options?: unknown }>;
  /** Kosongkan semuanya (awal tiap tes pengingat). */
  reset(): void;
  /** Notifikasi terjadwal `identifier` berbunyi: pindah ke yang tampil. */
  fire(identifier: string, at?: number): void;
}

export function createNotificationsMock() {
  const state: NotificationsMockState = {
    scheduled: new Map(),
    presented: new Map(),
    channels: new Map(),
    categories: new Map(),
    reset() {
      state.scheduled.clear();
      state.presented.clear();
      state.channels.clear();
      state.categories.clear();
    },
    fire(identifier, at = Date.now()) {
      const request = state.scheduled.get(identifier);
      if (!request) throw new Error(`tidak ada notifikasi terjadwal ${identifier}`);
      state.scheduled.delete(identifier);
      state.presented.set(identifier, { date: at, request });
    },
  };
  let seq = 0;
  return {
    __mock: state,
    AndroidImportance: { UNKNOWN: 0, UNSPECIFIED: 1, NONE: 2, MIN: 3, LOW: 4, DEFAULT: 5, HIGH: 6, MAX: 7 },
    AndroidNotificationVisibility: { UNKNOWN: 0, PUBLIC: 1, PRIVATE: 2, SECRET: 3 },
    AndroidNotificationPriority: { MIN: 'min', LOW: 'low', DEFAULT: 'default', HIGH: 'high', MAX: 'max' },
    SchedulableTriggerInputTypes: {
      CALENDAR: 'calendar',
      DAILY: 'daily',
      WEEKLY: 'weekly',
      MONTHLY: 'monthly',
      YEARLY: 'yearly',
      DATE: 'date',
      TIME_INTERVAL: 'timeInterval',
    },
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async (id: string, channel: Record<string, unknown>) => {
      const next = { id, ...state.channels.get(id), ...channel };
      state.channels.set(id, next);
      return next;
    }),
    getNotificationChannelAsync: jest.fn(async (id: string) => state.channels.get(id) ?? null),
    setNotificationCategoryAsync: jest.fn(async (identifier: string, actions: unknown[], options?: unknown) => {
      const category = { identifier, actions, options };
      state.categories.set(identifier, category);
      return category;
    }),
    scheduleNotificationAsync: jest.fn(
      async ({
        identifier,
        content,
        trigger,
      }: {
        identifier?: string;
        content: Request['content'];
        trigger: never;
      }) => {
        const id = identifier ?? `notif-${++seq}`;
        state.scheduled.set(id, { identifier: id, content, trigger });
        return id;
      },
    ),
    cancelScheduledNotificationAsync: jest.fn(async (identifier: string) => {
      state.scheduled.delete(identifier);
    }),
    getAllScheduledNotificationsAsync: jest.fn(async () => [...state.scheduled.values()]),
    getPresentedNotificationsAsync: jest.fn(async () => [...state.presented.values()]),
    dismissNotificationAsync: jest.fn(async (identifier: string) => {
      state.presented.delete(identifier);
    }),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false, status: 'undetermined', canAskAgain: true })),
    requestPermissionsAsync: jest.fn(() =>
      Promise.resolve({ granted: false, status: 'undetermined', canAskAgain: true }),
    ),
    getDevicePushTokenAsync: jest.fn(() => Promise.resolve({ type: 'android', data: 'token-1' })),
    addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
    useLastNotificationResponse: jest.fn(() => null),
    clearLastNotificationResponse: jest.fn(),
  };
}
