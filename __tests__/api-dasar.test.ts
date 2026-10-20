import { BACKOFF_MAX_MS, backoffDelay } from '@/api/backoff';
import { ERROR_TEXT, friendlyError, WRONG_CODE_TEXT } from '@/api/errors';
import { loadMode, readApiUrl, resolveMode, saveMode } from '@/api/mode';
import { createMemorySession, createSecureSession } from '@/api/session';
import { ApiFailure } from '@/api/transport';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

beforeEach(() => mockStore.clear());

describe('jeda sambung ulang', () => {
  test('1, 2, 4, 8, 16, lalu paling lama 30 detik', () => {
    const delays = [0, 1, 2, 3, 4, 5, 6, 12].map((attempt) => backoffDelay(attempt, () => 0.5));
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });

  test('goyangan paling banyak 10% dan tidak pernah lewat 30 detik', () => {
    expect(backoffDelay(0, () => 0)).toBe(900);
    expect(backoffDelay(0, () => 1)).toBe(1100);
    expect(backoffDelay(3, () => 0)).toBe(7200);
    expect(backoffDelay(10, () => 1)).toBe(BACKOFF_MAX_MS);
    expect(backoffDelay(10, () => 0)).toBe(27000);
  });
});

describe('sesi', () => {
  test('memberi tahu setiap token berubah, tidak saat sama', async () => {
    const session = createMemorySession('lama');
    const seen: (string | null)[] = [];
    const stop = session.onChange((t) => seen.push(t));
    expect(await session.get()).toBe('lama');
    await session.set('baru');
    await session.set('baru');
    await session.clear();
    expect(await session.get()).toBeNull();
    stop();
    await session.set('lagi');
    expect(seen).toEqual(['baru', null]);
  });

  test('tersimpan di secure-store dengan kuncinya sendiri dan bertahan setelah aplikasi dibuka ulang', async () => {
    await createSecureSession('sesi.uji').set('rahasia');
    expect(mockStore.get('sesi.uji')).toBe('rahasia');
    const reopened = createSecureSession('sesi.uji');
    expect(await reopened.get()).toBe('rahasia');
    expect(await createSecureSession('sesi.lain').get()).toBeNull();
    await reopened.clear();
    expect(mockStore.has('sesi.uji')).toBe(false);
    expect(await createSecureSession('sesi.uji').get()).toBeNull();
  });

  test('set selama pembacaan pertama tetap menang', async () => {
    mockStore.set('sesi.uji', 'lama');
    const session = createSecureSession('sesi.uji');
    const reading = session.get();
    await session.set('baru');
    expect(await reading).toBe('baru');
    expect(await session.get()).toBe('baru');
  });
});

describe('mode data', () => {
  test('alamat server dari app.json, bawaannya kosong', () => {
    expect(readApiUrl()).toBeNull();
    expect(readApiUrl({ apiUrl: '' })).toBeNull();
    expect(readApiUrl({ apiUrl: '  ' })).toBeNull();
    expect(readApiUrl({})).toBeNull();
    expect(readApiUrl({ apiUrl: 42 })).toBeNull();
    expect(readApiUrl({ apiUrl: 'ftp://app.sekertaris.com' })).toBeNull();
    expect(readApiUrl({ apiUrl: 'app.sekertaris.com' })).toBeNull();
    expect(readApiUrl({ apiUrl: ' https://app.sekertaris.com/ ' })).toBe('https://app.sekertaris.com');
    expect(readApiUrl({ apiUrl: 'http://192.168.1.5:3000' })).toBe('http://192.168.1.5:3000');
  });

  test('server hanya bila dipilih dan alamatnya ada', () => {
    expect(resolveMode(null, null)).toBe('contoh');
    expect(resolveMode(null, 'https://x.id')).toBe('contoh');
    expect(resolveMode('server', null)).toBe('contoh');
    expect(resolveMode('server', 'https://x.id')).toBe('server');
    expect(resolveMode('lain', 'https://x.id')).toBe('contoh');
  });

  test('pilihan tersimpan; server tanpa alamat ditolak', async () => {
    expect(await loadMode('https://x.id')).toBe('contoh');
    expect(await saveMode('server', null)).toBe(false);
    expect(await loadMode('https://x.id')).toBe('contoh');
    expect(await saveMode('server', 'https://x.id')).toBe(true);
    expect(await loadMode('https://x.id')).toBe('server');
    // Alamatnya dihapus dari app.json: kembali ke contoh walau pilihan tersimpan.
    expect(await loadMode(null)).toBe('contoh');
    expect(await saveMode('contoh', null)).toBe(true);
    expect(await loadMode('https://x.id')).toBe('contoh');
  });
});

describe('teks gagal', () => {
  test('kode salah punya teks sendiri', () => {
    expect(friendlyError(new ApiFailure('kode_salah', { status: 400, error: 'kode_salah' }))).toBe(WRONG_CODE_TEXT);
  });

  test.each<[string, unknown]>([
    ['jaringan', new ApiFailure('network')],
    ['batas waktu', new ApiFailure('timeout')],
    ['sesi', new ApiFailure('unauthorized', { status: 401, error: 'tidak_masuk' })],
    ['server', new ApiFailure('server', { status: 409, error: 'status_draf' })],
    ['error lain', new Error('boom')],
    ['bukan error', 'aneh'],
  ])('%s memakai teks umum tanpa kode', (_, e) => {
    const text = friendlyError(e);
    expect(text).toBe(ERROR_TEXT);
    expect(text).not.toMatch(/\d{3}|status_draf|tidak_masuk|boom|network|timeout/);
  });
});
