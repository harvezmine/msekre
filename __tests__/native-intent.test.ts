import { AUTH_GRACE_MS, beginAuthSession, endAuthSession, resetAuthSession } from '@/api/authSession';
import { redirectSystemPath } from '../app/+native-intent';

const BACK = 'sekretarisai://terhubung/tersambung?id=gmail&ok=1';

beforeEach(() => resetAuthSession());

describe('redirectSystemPath', () => {
  test('mulai dingin tetap menuju Tersambung', () => {
    expect(redirectSystemPath({ path: BACK, initial: true })).toBe(BACK);
    beginAuthSession();
    expect(redirectSystemPath({ path: BACK, initial: true })).toBe(BACK);
  });

  test('aplikasi sudah berjalan, tanpa sesi masuk: tautan diteruskan', () => {
    expect(redirectSystemPath({ path: BACK, initial: false })).toBe(BACK);
  });

  test('sesi masuk dinanti: alamat kembali dibuang (null = tetap di layar sekarang), tautan lain diteruskan', () => {
    beginAuthSession();
    expect(redirectSystemPath({ path: BACK, initial: false })).toBeNull();
    expect(redirectSystemPath({ path: 'sekretarisai://chat', initial: false })).toBe('sekretarisai://chat');
  });

  test('sesudah sesi berakhir masih dibuang sebentar (tautan bisa tiba sesudah hasil), lalu diteruskan lagi', () => {
    beginAuthSession();
    endAuthSession(1000);
    jest.spyOn(Date, 'now').mockReturnValue(1000 + AUTH_GRACE_MS - 1);
    expect(redirectSystemPath({ path: BACK, initial: false })).toBeNull();
    jest.spyOn(Date, 'now').mockReturnValue(1000 + AUTH_GRACE_MS + 1);
    expect(redirectSystemPath({ path: BACK, initial: false })).toBe(BACK);
    jest.restoreAllMocks();
  });
});
