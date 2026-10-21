import type { StreamEvent } from '@/api/contract';
import { cleanPhone, formatJam, greetingFor, formatPhoneDisplay, formatTanggal, groupPhone } from '@/api/format';
import { applyThinking, isThinking, NO_RUNS } from '@/api/thinking';

describe('formatJam', () => {
  afterEach(() => jest.restoreAllMocks());
  /** Jam HP yang selisih zonanya `offsetHours` jam di timur UTC (WIB 7, WITA 8, WIT 9). */
  const inZone = (offsetHours: number, iso: string) => {
    jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-offsetHours * 60);
    return formatJam(iso);
  };
  const WIB = 7;
  const WITA = 8;
  const WIT = 9;

  test('jam menurut zona waktu HP: WIB, WITA, WIT', () => {
    const iso = '2026-10-20T03:47:00.000Z';
    expect(inZone(WIB, iso)).toBe('10.47');
    expect(inZone(WITA, iso)).toBe('11.47');
    expect(inZone(WIT, iso)).toBe('12.47');
  });

  test('waktu dengan offset sendiri dibaca sebagai saat yang sama', () => {
    expect(inZone(WIB, '2026-10-20T10:47:00+07:00')).toBe('10.47');
    expect(inZone(WITA, '2026-10-20T10:47:00+07:00')).toBe('11.47');
    expect(inZone(WIB, '2026-10-20T11:47:00+08:00')).toBe('10.47');
  });

  test('melewati tengah malam: 23.58 + 5 menit menjadi 00.03 di hari berikutnya', () => {
    expect(inZone(WIB, '2026-10-20T16:58:00.000Z')).toBe('23.58');
    expect(inZone(WIB, '2026-10-20T17:03:00.000Z')).toBe('00.03');
    // Pengguna WITA melihat jam yang berbeda untuk saat yang sama.
    expect(inZone(WITA, '2026-10-20T16:03:00.000Z')).toBe('00.03');
    expect(inZone(WITA, '2026-10-20T17:03:00.000Z')).toBe('01.03');
  });

  test('dua digit selalu, juga untuk 00.00 dan 09.05', () => {
    expect(inZone(0, '2026-10-20T00:00:00Z')).toBe('00.00');
    expect(inZone(0, '2026-10-20T09:05:00Z')).toBe('09.05');
  });

  test('dengan zona waktu pengguna dari server: jamnya menurut zona itu, apa pun zona HP', () => {
    const iso = '2026-10-20T03:47:00.000Z';
    // HP di WIT, tapi pengguna WIB (420): jam menurut WIB.
    jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-WIT * 60);
    expect(formatJam(iso, 420)).toBe('10.47');
    expect(formatJam(iso, 480)).toBe('11.47');
    expect(formatJam(iso, 0)).toBe('03.47');
    expect(formatJam(iso, -300)).toBe('22.47');
    // Lewat tengah malam di zona pengguna.
    expect(formatJam('2026-10-20T17:05:00.000Z', 420)).toBe('00.05');
    // Tanpa zona dari server: zona HP.
    expect(formatJam(iso)).toBe('12.47');
    expect(formatJam(iso, null)).toBe('12.47');
  });

  test('sapaan menurut jam: pagi 04-10, siang 11-14, sore 15-17, selain itu malam', () => {
    const at = (h: number) => greetingFor(h);
    expect([4, 10].map(at)).toEqual(['Selamat pagi', 'Selamat pagi']);
    expect([11, 14].map(at)).toEqual(['Selamat siang', 'Selamat siang']);
    expect([15, 17].map(at)).toEqual(['Selamat sore', 'Selamat sore']);
    expect([18, 23, 0, 3].map(at)).toEqual(['Selamat malam', 'Selamat malam', 'Selamat malam', 'Selamat malam']);
  });

  test('waktu yang tidak terbaca', () => {
    expect(formatJam('kemarin')).toBe('--.--');
    expect(formatJam('')).toBe('--.--');
  });
});

describe('proses berpikir menurut runId', () => {
  const think = (runId: string, on: boolean): StreamEvent => ({ type: 'thinking', runId, on });

  test('berpikir selama masih ada proses aktif; dua proses tidak saling menimpa', () => {
    let runs = NO_RUNS;
    expect(isThinking(runs)).toBe(false);
    runs = applyThinking(runs, think('app', true));
    runs = applyThinking(runs, think('wa', true));
    expect(isThinking(runs)).toBe(true);
    runs = applyThinking(runs, think('app', false));
    expect(isThinking(runs)).toBe(true);
    runs = applyThinking(runs, think('wa', false));
    expect(isThinking(runs)).toBe(false);
  });

  test('on dua kali satu proses dihitung sekali; off tanpa on diabaikan; himpunan lama tidak berubah', () => {
    const one = applyThinking(NO_RUNS, think('a', true));
    expect(applyThinking(one, think('a', true))).toBe(one);
    expect(applyThinking(NO_RUNS, think('x', false))).toBe(NO_RUNS);
    expect(applyThinking(one, think('a', false)).size).toBe(0);
    expect(one.size).toBe(1);
    expect(NO_RUNS.size).toBe(0);
  });

  test('event selain thinking tidak mengubah apa pun', () => {
    const one = applyThinking(NO_RUNS, think('a', true));
    expect(applyThinking(one, { type: 'ping' })).toBe(one);
  });
});

describe('nomor dan tanggal', () => {
  test('cleanPhone: 0812, +62 812, 62 0812, dan 62812 semuanya menjadi 812…', () => {
    for (const text of ['0812 2045 7781', '+62 812 2045 7781', '62 0812 2045 7781', '6281220457781', '812-2045-7781']) {
      expect(cleanPhone(text)).toBe('81220457781');
    }
    expect(cleanPhone('')).toBe('');
    expect(cleanPhone('6')).toBe('6');
    expect(cleanPhone('62')).toBe('');
    expect(cleanPhone('081222222222222222')).toBe('8122222222222');
  });

  test('tampilan nomor', () => {
    expect(groupPhone('81220457781')).toBe('812-2045-7781');
    expect(formatPhoneDisplay('6281220457781')).toBe('+62 812-2045-7781');
    expect(formatPhoneDisplay('14155550123')).toBe('+14155550123');
  });

  test('formatTanggal: tanggal pendek Indonesia menurut zona HP; waktu rusak null', () => {
    jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-420);
    expect(formatTanggal('2027-01-12T05:00:00.000Z')).toMatch(/^\d{1,2} (Jan|Des) 202[67]$/);
    expect(formatTanggal('bukan tanggal')).toBeNull();
    jest.restoreAllMocks();
  });
});
