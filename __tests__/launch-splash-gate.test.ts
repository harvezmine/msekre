import { isAlarmTarget, RESUME_MIN_MS, showOnResume, skipOnLaunch } from '@/ui/launchSplashGate';

describe('isAlarmTarget', () => {
  test.each(['sekretarisai://alarm?id=a1', '/alarm', '/alarm?id=1', 'sekretarisai:///alarm', 'alarm'])('%s', (t) =>
    expect(isAlarmTarget(t)).toBe(true),
  );
  test.each(['/', '/chat', '/alarmku', 'sekretarisai://terhubung/tersambung', '', null, undefined])('%s', (t) =>
    expect(isAlarmTarget(t)).toBe(false),
  );
});

describe('skipOnLaunch', () => {
  test('mulai biasa tampil', () => {
    expect(skipOnLaunch({ initialUrl: null, hasNotificationResponse: false })).toBe(false);
  });
  test('dari alarm atau ketukan notifikasi dilewati', () => {
    expect(skipOnLaunch({ initialUrl: 'sekretarisai://alarm?id=1', hasNotificationResponse: false })).toBe(true);
    expect(skipOnLaunch({ initialUrl: null, hasNotificationResponse: true })).toBe(true);
  });
  test('tautan lain tidak melewati', () => {
    expect(skipOnLaunch({ initialUrl: 'sekretarisai://chat', hasNotificationResponse: false })).toBe(false);
  });
});

describe('showOnResume', () => {
  const now = 10_000_000;
  test('30 menit atau lebih tampil, kurang tidak', () => {
    expect(showOnResume({ backgroundedAt: now - RESUME_MIN_MS, now, pathname: '/' })).toBe(true);
    expect(showOnResume({ backgroundedAt: now - RESUME_MIN_MS + 1, now, pathname: '/' })).toBe(false);
    expect(showOnResume({ backgroundedAt: now - 5 * 60_000, now, pathname: '/' })).toBe(false);
  });
  test('tanpa catatan latar atau saat alarm terbuka tidak tampil', () => {
    expect(showOnResume({ backgroundedAt: null, now, pathname: '/' })).toBe(false);
    expect(showOnResume({ backgroundedAt: 0, now, pathname: '/alarm' })).toBe(false);
  });
});
