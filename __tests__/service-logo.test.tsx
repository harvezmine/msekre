import { render, screen } from '@testing-library/react-native';
import { getAnimatedStyle as animatedStyle } from 'react-native-reanimated';
import * as Reanimated from 'react-native-reanimated';
import { ThemeProvider, type Scheme } from '@/theme/ThemeProvider';
import { dark } from '@/theme/tokens';
import { JOIN_MS, JoinMark } from '@/ui/connect/JoinMark';
import { capabilityIcon, cardName, LOGOS, logoFor } from '@/ui/connect/logos';
import { LogoDock } from '@/ui/connect/ServiceCard';
import { LOGO_SIZES, logoRadius, ServiceLogo, type LogoStatus } from '@/ui/kit';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  const useReducedMotion = jest.fn(() => false);
  // Proxy, bukan salinan: ekspor reanimated berupa getter (termasuk `default`).
  return new Proxy(actual, { get: (target, key) => (key === 'useReducedMotion' ? useReducedMotion : target[key]) });
});

type AnimatedStyle = { opacity?: number; transform?: Record<string, number>[] };
const getAnimatedStyle = animatedStyle as unknown as (el: unknown) => AnimatedStyle;

const show = (ui: React.ReactElement, scheme: Scheme = 'light') =>
  render(<ThemeProvider scheme={scheme}>{ui}</ThemeProvider>);

describe('logoFor: satu tempat pemetaan layanan -> logo', () => {
  test.each([
    ['gcal', 'gcal'],
    ['gmail', 'gmail'],
    ['wa', 'wa'],
    ['gdrive', 'gdrive'],
    ['notion', 'notion'],
    ['plaud', 'plaud'],
    ['m365', 'm365'],
    ['github', 'github'],
    ['tiktok', 'tiktok'],
    ['smartthings', 'smartthings'],
    ['homeassistant', 'homeassistant'],
    ['imou', 'imou'],
    ['shopee', 'shopee'],
    ['instagram', 'instagram'],
    ['moka', 'moka'],
    ['accurate', 'accurate'],
    ['bca', 'bca'],
    ['kotak', 'sekretaris'],
    ['rapat', 'rapat'],
    // Nama lain dari server dan kunci sumber usaha.
    ['tiktok_shop', 'tiktok'],
    ['google_calendar', 'gcal'],
    ['Home-Assistant', 'homeassistant'],
    ['moota', 'moota'],
    ['gojek', 'gojek'],
  ])('%s -> %s', (id, key) => {
    expect(logoFor(id).key).toBe(key);
  });

  test('id tidak dikenal: dicocokkan lewat nama, lalu ubin huruf (bukan lingkaran kosong)', () => {
    expect(logoFor('ms_mail', 'Outlook Kantor').key).toBe('m365');
    expect(logoFor('x1', 'Pencatat rapat Zoom, Meet, Teams').key).toBe('rapat');
    const fallback = logoFor('baru', 'Layanan Baru');
    expect(fallback).toEqual({ kind: 'initial', key: 'huruf', text: 'LB', color: null });
  });

  test('logo berwarna merek tanpa logo bebas pakai memakai ubin huruf berwarna', () => {
    expect(LOGOS.bca).toMatchObject({ kind: 'initial', text: 'BCA', color: '#0060AF' });
    expect(LOGOS.moka).toMatchObject({ kind: 'initial', text: 'm' });
  });

  test('nama kartu pendek dan ikon kemampuan', () => {
    expect(cardName('tiktok', 'TikTok Shop & Tokopedia')).toBe('TikTok Shop');
    expect(cardName('gmail', 'Gmail')).toBe('Gmail');
    expect(capabilityIcon('Membaca email masuk.')).toBe('mail');
    expect(capabilityIcon('Melihat penjualan tiap kedai.')).toBe('receipt');
    expect(capabilityIcon('Sesuatu yang lain.')).toBe('check');
  });
});

describe('ServiceLogo', () => {
  test.each([
    ['gmail', 'Gmail', 'logo-gmail'],
    ['moka', 'Moka', 'logo-moka'],
    ['kotak', 'Kotak Sekretaris AI', 'logo-sekretaris'],
    ['plaud', 'Plaud', 'logo-plaud'],
    ['rapat', 'Pencatat rapat Zoom, Meet, Teams', 'logo-rapat'],
    ['aneh', 'Layanan Aneh', 'logo-huruf'],
  ])('%s memakai logonya sendiri', async (id, name, testID) => {
    await show(<ServiceLogo id={id} name={name} />);
    expect(screen.getByTestId(testID)).toBeOnTheScreen();
  });

  test('ubin persegi membulat 28% sisi (bukan lingkaran), di semua ukuran', async () => {
    for (const size of LOGO_SIZES) {
      await show(<ServiceLogo id="gmail" size={size} />);
      expect(screen.getByTestId('logo-gmail')).toHaveStyle({
        width: size,
        height: size,
        borderRadius: logoRadius(size),
      });
      expect(logoRadius(size)).toBeLessThan(size / 2);
    }
  });

  test('ubin huruf merek: huruf putih di atas warna merek', async () => {
    await show(<ServiceLogo id="bca" name="Mutasi rekening BCA" />);
    expect(screen.getByTestId('logo-bca')).toHaveStyle({ backgroundColor: '#0060AF' });
    expect(screen.getByText('BCA', { includeHiddenElements: true })).toHaveStyle({ color: '#FFFFFF' });
  });

  test.each<[LogoStatus | undefined, string | null]>([
    ['connected', 'lencana-tersambung'],
    ['attention', 'lencana-perhatian'],
    ['soon', null],
    [undefined, null],
  ])('keadaan %s', async (status, badge) => {
    await show(<ServiceLogo id="notion" status={status} />);
    for (const id of ['lencana-tersambung', 'lencana-perhatian']) {
      if (id === badge) expect(screen.getByTestId(id)).toBeOnTheScreen();
      else expect(screen.queryByTestId(id)).toBeNull();
    }
    if (status === 'soon') expect(screen.getByTestId('logo-notion')).toHaveStyle({ opacity: 0.45 });
    else expect(screen.getByTestId('logo-notion')).not.toHaveStyle({ opacity: 0.45 });
  });

  test('mode gelap: ubin di permukaan timbul; logo hitam satu warna diwarnai ulang dengan warna teks', async () => {
    await show(<ServiceLogo id="plaud" status="connected" />, 'dark');
    expect(screen.getByTestId('logo-plaud')).toHaveStyle({ backgroundColor: dark.raised });
    expect(screen.getByTestId('logo-gambar')).toHaveStyle({ tintColor: dark.text });
    expect(screen.getByTestId('lencana-tersambung')).toHaveStyle({ backgroundColor: dark.brand });
  });

  test('mode terang: logo hitam tetap hitam di ubin putih', async () => {
    await show(<ServiceLogo id="plaud" />);
    expect(screen.getByTestId('logo-plaud')).toHaveStyle({ backgroundColor: '#FFFFFF' });
    expect(screen.getByTestId('logo-gambar')).not.toHaveStyle({ tintColor: dark.text });
  });
});

describe('LogoDock', () => {
  const items = ['gcal', 'gmail', 'wa', 'moka', 'bca', 'kotak', 'imou'].map((id) => ({ id, name: id }));

  test('lebih dari batas: ubin +N', async () => {
    await show(<LogoDock items={items} max={4} />);
    expect(screen.getByText('+4')).toBeOnTheScreen();
    expect(screen.getByTestId('logo-wa')).toBeOnTheScreen();
    expect(screen.queryByTestId('logo-moka')).toBeNull();
  });

  test('tanpa +N: dipotong saja', async () => {
    await show(<LogoDock items={items} max={3} more={false} />);
    expect(screen.queryByText(/^\+/)).toBeNull();
    expect(screen.getByTestId('logo-wa')).toBeOnTheScreen();
    expect(screen.queryByTestId('logo-moka')).toBeNull();
  });
});

describe('JoinMark', () => {
  afterEach(() => jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false));

  test('bergabung: logo layanan mulai jauh dan tembus pandang, lalu meluncur ke tanda S; centang muncul terakhir', async () => {
    await show(<JoinMark id="tiktok" name="TikTok Shop" state="joined" animate />);
    expect(screen.getByTestId('logo-tiktok')).toBeOnTheScreen();
    expect(screen.getByTestId('logo-sekretaris')).toBeOnTheScreen();
    const start = getAnimatedStyle(screen.getByTestId('sambungan-layanan'));
    expect(start.opacity).toBe(0);
    expect(Object.assign({}, ...(start.transform ?? [])).translateX).toBeLessThan(0);
    expect(getAnimatedStyle(screen.getByTestId('sambungan-centang')).opacity).toBe(0);
    await jest.advanceTimersByTimeAsync(JOIN_MS.tickDelay + JOIN_MS.tick + 100);
    const end = getAnimatedStyle(screen.getByTestId('sambungan-layanan'));
    expect(end.opacity).toBe(1);
    expect(Object.assign({}, ...(end.transform ?? [])).translateX).toBeCloseTo(0);
    expect(getAnimatedStyle(screen.getByTestId('sambungan-centang')).opacity).toBe(1);
  });

  test('tanpa animate (sudah dianimasikan) atau gerak dikurangi: langsung keadaan akhir', async () => {
    await show(<JoinMark id="tiktok" name="TikTok Shop" state="joined" />);
    expect(getAnimatedStyle(screen.getByTestId('sambungan-layanan')).opacity).toBe(1);
    expect(getAnimatedStyle(screen.getByTestId('sambungan-centang')).opacity).toBe(1);

    jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
    await show(<JoinMark id="tiktok" name="TikTok Shop" state="joined" animate />);
    expect(getAnimatedStyle(screen.getByTestId('sambungan-layanan')).opacity).toBe(1);
    expect(getAnimatedStyle(screen.getByTestId('sambungan-centang')).opacity).toBe(1);
  });

  test('menyambung: titik hijau mengalir, tanpa centang; gerak dikurangi: tanpa titik', async () => {
    await show(<JoinMark id="notion" name="Notion" state="working" />);
    expect(screen.getByTestId('sambungan-titik')).toBeOnTheScreen();
    expect(screen.queryByTestId('sambungan-centang')).toBeNull();

    jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
    await show(<JoinMark id="notion" name="Notion" state="working" />);
    expect(screen.queryByTestId('sambungan-titik')).toBeNull();
  });
});
